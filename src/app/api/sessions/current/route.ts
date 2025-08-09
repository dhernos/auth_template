// src/app/api/sessions/current/route.ts

import { NextResponse } from "next/server";
import redis from "@/lib/redis";
import { protectedRoute } from "@/lib/protected-api";
import { getToken } from "next-auth/jwt";

// Der Handler empfängt nun die Request, Session und params vom Wrapper
const handler = async (
  req: Request,
  params: { id: string }
) => {
  // Wir holen das JWT direkt, um die sessionId zu erhalten
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Überprüfen, ob der Token existiert und eine sessionId enthält
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

    // Überprüfen, ob die Session in Redis gefunden wurde
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

// Exportiere den gewrappten Handler
export const GET = protectedRoute(handler);