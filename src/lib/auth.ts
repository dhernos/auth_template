// src/auth.ts

import NextAuth, { type SessionStrategy } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { Adapter } from "next-auth/adapters";
import { randomUUID } from "crypto";
import redis from "@/lib/redis";
import { headers } from "next/headers";
import { db } from "@/lib/db"

const prisma = db

// Funktion zum Überprüfen der Sitzung in Redis
async function checkSessionInRedis(sessionId: string) {
  const session = await redis.hgetall(`session:${sessionId}`);
  return session;
}

// Funktion zum Widerrufen der Sitzung aus Redis
async function invalidateSession(sessionId: string) {
  await redis.del(`session:${sessionId}`);
}

const LOGIN_ATTEMPT_LIMIT = 3;
const LOGIN_BAN_DURATION_SECONDS = 60 * 60; // 1 hour

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
          throw new Error("Please provide an email and password.");
        }

        const userAgent = (await headers()).get("user-agent") || "unknown";
        const forwardedFor = (await headers()).get("x-forwarded-for");
        const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : (await headers()).get("x-real-ip");

        if (!ip) {
          throw new Error("Could not determine IP address.");
        }

        const banKey = `login_ban:${ip}`;
        const loginAttemptsKey = `login_attempts:${ip}`;

        const isBanned = await redis.exists(banKey);
        if (isBanned) {
          console.warn(`Login attempt from banned IP: ${ip}`);
          throw new Error("IP_BANNED");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password || !(await bcrypt.compare(credentials.password, user.password))) {
          const attempts = await redis.incr(loginAttemptsKey);
          if (attempts >= LOGIN_ATTEMPT_LIMIT) {
            console.warn(`IP ${ip} has ${LOGIN_ATTEMPT_LIMIT} failed attempts. Banning for 1 hour.`);
            await redis.setex(banKey, LOGIN_BAN_DURATION_SECONDS, "1");
            await redis.expire(loginAttemptsKey, LOGIN_BAN_DURATION_SECONDS);
            throw new Error("IP_BANNED");
          }
          if (attempts === 1) {
            await redis.expire(loginAttemptsKey, 10 * 60);
          }
          throw new Error("Invalid login credentials.");
        }

        await redis.del(loginAttemptsKey);

        if (!user.emailVerified) {
          console.error("Login failed: Email is not verified.");
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        // Rückgabe des Benutzerobjekts, NextAuth.js JWT-Callback erstellt die Redis-Sitzung
        return user;
      },
    }),
    GitHubProvider({
      clientId: process.env.AUTH_GITHUB_ID as string,
      clientSecret: process.env.AUTH_GITHUB_SECRET as string,
    }),
  ],
  session: {
    strategy: "jwt" as SessionStrategy,
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // WICHTIG: Erzeuge und speichere die Redis-Sitzung nur, wenn der Benutzer neu angemeldet wurde
      if (user) {
        const sessionId = randomUUID();
        const now = Date.now();
        const maxAgeInSeconds = 7 * 24 * 60 * 60; // Einheitliche Lebensdauer für alle Provider
        const sessionExpiresAt = now + maxAgeInSeconds * 1000;

        await redis.hmset(`session:${sessionId}`, {
          userId: user.id,
          expires: sessionExpiresAt.toString(),
          loginTime: now.toString(),
          role: user.role,
          // Hinweis: IP und User-Agent sind im JWT-Callback nicht einfach verfügbar
          // Du kannst sie bei Bedarf im Credentials-Provider setzen oder weglassen
        });

        await redis.expire(`session:${sessionId}`, maxAgeInSeconds);

        token.sessionId = sessionId;
        token.id = user.id;
        token.role = user.role;
        token.exp = Math.floor(sessionExpiresAt / 1000);
      }

      // Überprüfe die Gültigkeit der Redis-Sitzung bei jedem Request
      if (token.sessionId) {
        const sessionData = await checkSessionInRedis(token.sessionId as string);
        if (sessionData && sessionData.userId === token.id) {
          // Token ist gültig, aktualisiere die Daten falls nötig
          token.exp = Math.floor(parseInt(sessionData.expires) / 1000);
          return token;
        } else {
          // Sitzung in Redis wurde gelöscht, invalider Token
          console.warn("JWT callback: Session not found or mismatched in Redis. Invalidating token.");
          return { ...token, error: "InvalidSessionError" as const };
        }
      }

      // Falls das Token aus einem unbekannten Grund keine sessionId hat
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