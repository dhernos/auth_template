// src/types/next-auth.d.ts

import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT as NextAuthJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Extends the default Session interface.
   */
  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
    error?: "InvalidSessionError";
  }

  /**
   * Extends the default User interface.
   * The `sessionId` is optional because it may not always exist (e.g., with OAuth providers).
   */
  interface User extends DefaultUser {
    id: string;
    role?: string;
    sessionId?: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * Extends the default JWT interface.
   */
  interface JWT extends NextAuthJWT {
    id: string;
    role?: string;
    sessionId?: string;
    error?: "InvalidSessionError";
  }
}