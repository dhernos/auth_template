// src/types/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Erweitert die Standard-Session-Schnittstelle.
   */
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
    error?: "InvalidSessionError";
  }

  /**
   * Erweitert die Standard-User-Schnittstelle.
   * Das `sessionId` ist optional, da es nicht immer existiert (z.B. bei OAuth-Anbietern).
   */
  interface User extends DefaultUser {
    id: string;
    role?: string;
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Erweitert die Standard-JWT-Schnittstelle.
   */
  interface JWT extends NextAuthJWT {
    id: string;
    role?: string;
    sessionId?: string;
    error?: "InvalidSessionError";
  }
}