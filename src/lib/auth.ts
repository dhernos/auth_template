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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error("Ungültige Anmeldeinformationen.");
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.password);

        if (!isValidPassword) {
          throw new Error("Ungültige Anmeldeinformationen.");
        }

        if (!user.emailVerified) {
          console.error("Login fehlgeschlagen: E-Mail ist nicht verifiziert.");
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        //Session in Redis erstellen
        const sessionId = randomUUID();
        const now = Date.now();
        const maxAgeInSeconds = credentials.rememberMe === "true" ? 7 * 24 * 60 * 60 : 7 * 60 * 60;
        const sessionExpiresAt = now + maxAgeInSeconds * 1000;

        await redis.hmset(`session:${sessionId}`, {
          userId: user.id,
          expires: sessionExpiresAt.toString(),
          loginTime: now.toString(),
          role: user.role,
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
      // Wenn der JWT-Callback bereits einen Fehler erkannt hat, geben wir ihn zurück.
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
