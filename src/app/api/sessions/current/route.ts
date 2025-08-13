// src/app/api/sessions/current/route.ts

import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { protectedRoute } from "@/lib/protected-api";
import { getToken } from "next-auth/jwt";

// The handler now receives the request, session, and params from the wrapper
const handler = async (
  req: Request,
  params: { id: string }
) => {
  // We get the JWT directly to obtain the sessionId
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Check if the token exists and contains a sessionId
  if (!token || !token.sessionId) {
    return NextResponse.json(
      { error: "Session ID not found in token." },
      { status: 400 }
    );
  }

  const sessionId = token.sessionId as string;

  try {
    const sessionData = await redis.hgetall(`session:${sessionId}`);
    const ttl = await redis.ttl(`session:${sessionId}`);

    // Check if the session was found in Redis
    if (!sessionData || Object.keys(sessionData).length === 0) {
      return NextResponse.json(
        { error: "Session not found in Redis." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...sessionData,
      ttlInSeconds: ttl,
    });
  } catch (error) {
    console.error("Failed to fetch session details from Redis:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
};

// Export the wrapped handler
export const GET = protectedRoute(handler);