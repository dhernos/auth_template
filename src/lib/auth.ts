// src/auth.ts

import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { Adapter } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import { randomUUID } from "crypto";
import redis from "@/lib/redis";
import { headers } from "next/headers";

const prisma = new PrismaClient();

// Funktion zum Überprüfen der Session in Redis
async function checkSessionInRedis(sessionId: string) {
  const session = await redis.hgetall(`session:${sessionId}`);
  return session;
}

// Funktion zum Löschen der Session aus Redis
async function invalidateSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
}

const LOGIN_ATTEMPT_LIMIT = 3;
const LOGIN_BAN_DURATION_SECONDS = 60 * 60; // 1 Stunde

export const authOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "checkbox" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Bitte geben Sie E-Mail und Passwort an.");
        }

        // Korrekter Weg, um die IP-Adresse und den User-Agent direkt im async-Callback zu holen
        const userAgent = (await headers()).get("user-agent") || "unknown";
        const forwardedFor = (await headers()).get("x-forwarded-for");
        const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : (await headers()).get("x-real-ip");

        if (!ip) {
            throw new Error("IP-Adresse konnte nicht ermittelt werden.");
        }
        
        const banKey = `login_ban:${ip}`;
        const loginAttemptsKey = `login_attempts:${ip}`;

        // 1. IP-Sperre überprüfen
        const isBanned = await redis.exists(banKey);
        if (isBanned) {
            console.warn(`Anmeldeversuch von gesperrter IP: ${ip}`);
            throw new Error("IP_BANNED"); 
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // Prüfung auf ungültige Anmeldedaten
        if (!user || !user.password || !(await bcrypt.compare(credentials.password, user.password))) {
            const attempts = await redis.incr(loginAttemptsKey);
            if (attempts >= LOGIN_ATTEMPT_LIMIT) {
                console.warn(`IP ${ip} hat ${LOGIN_ATTEMPT_LIMIT} fehlgeschlagene Versuche. Sperre für 1 Stunde.`);
                await redis.setex(banKey, LOGIN_BAN_DURATION_SECONDS, "1");
                await redis.expire(loginAttemptsKey, LOGIN_BAN_DURATION_SECONDS); 
                throw new Error("IP_BANNED");
            }
            if (attempts === 1) {
                await redis.expire(loginAttemptsKey, 10 * 60); // Timeout nach 10 Minuten ohne weitere Versuche
            }
            throw new Error("Ungültige Anmeldeinformationen.");
        }

        // Bei erfolgreichem Login: Zähler für die IP zurücksetzen
        await redis.del(loginAttemptsKey); 

        if (!user.emailVerified) {
          console.error("Login fehlgeschlagen: E-Mail ist nicht verifiziert.");
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        const sessionId = randomUUID();
        const now = Date.now();
        const maxAgeInSeconds = credentials.rememberMe === "true" ? 30 * 24 * 60 * 60 : 7 * 60 * 60;
        const sessionExpiresAt = now + maxAgeInSeconds * 1000;

        await redis.hmset(`session:${sessionId}`, {
          userId: user.id,
          expires: sessionExpiresAt.toString(),
          loginTime: now.toString(),
          role: user.role,
          ipAddress: ip, // Hinzufügen der IP-Adresse
          userAgent: userAgent, // Hinzufügen des User-Agents
        });

        await redis.expire(`session:${sessionId}`, maxAgeInSeconds);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          sessionId: sessionId,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (token.error) {
        return token;
      }
      
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionId = (user as any).sessionId;
      }

      if (token.sessionId) {
        const sessionData = await checkSessionInRedis(token.sessionId as string);

        if (sessionData && sessionData.userId === token.id) {
          token.id = sessionData.userId;
          token.role = sessionData.role;
          token.exp = Math.floor(parseInt(sessionData.expires) / 1000);
          return token;
        } else {
          console.warn("JWT callback: Session not found or mismatched in Redis. Invalidating token.");
          return { ...token, error: "InvalidSessionError" as const };
        }
      }

      return { ...token, error: "InvalidSessionError" as const };
    },

    async session({ session, token }) {
      if (token.error) {
        return {
          ...session,
          user: null,
          expires: new Date(0).toISOString(),
          error: token.error as string,
        };
      }
      
      if (token?.id) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }

      if (token.exp) {
        session.expires = new Date(token.exp * 1000).toISOString();
      }

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};