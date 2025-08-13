// src/lib/protected-api.ts

import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from "@/lib/auth";
import { JWT } from 'next-auth/jwt'; // Import the JWT type

// We define the type for your handler function.
// It receives the Request, the Session, and the params as arguments.
type ProtectedHandler = (
  req: Request,
  session: Session,
  params: { id: string }
) => Promise<NextResponse>;

// The wrapper is now a function that returns a handler,
// which fulfills the signature of the Next.js API route.
export const protectedRoute = (handler: ProtectedHandler) => {
  // This anonymous function is exported as the handler.
  // It receives req and params from Next.js.
  return async (req: Request, context: { params: { id: string } }) => {
    const session = await getServerSession(authOptions);

    // NEW: Check for 'InvalidSessionError'
    // The session is considered invalid if it's null or contains an error.
    if (!session || (session as any).error === "InvalidSessionError") {
      return NextResponse.json({
        error: 'Unauthorized: Session is invalid or has been revoked.'
      }, { status: 401 });
    }

    // Passing the arguments:
    // The original handler is called with the Request, the Session, and the params.
    return handler(req, session, context.params);
  };
};