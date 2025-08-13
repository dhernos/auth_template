// src/app/api/resend-verification/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendVerificationEmail } from "@/lib/verify-email";
import Redis from "ioredis";

const prisma = new PrismaClient();
const REDIS_COOLDOWN_SECONDS = 60;

// Connect to Redis
// The URL is automatically read from process.env.REDIS_URL
const redis = new Redis(process.env.REDIS_URL as string);

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    console.log("Received email:", email);

    if (!email) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const cooldownKey = `resend_cooldown:${email}`;

    // 1. Cooldown check in Redis
    const remainingTime = await redis.ttl(cooldownKey);
    if (remainingTime > 0) {
      return NextResponse.json(
        { cooldown: remainingTime},
        { status: 429 } // HTTP 429: Too Many Requests
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email is already verified." }, { status: 400 });
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // 2. Delete existing tokens and create a new one
    await prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { userId: user.id },
      });
      await tx.verificationToken.create({
        data: {
          userId: user.id,
          token: verificationCode,
          expires: expiresAt,
        },
      });
    });

    // 3. Send email and set cooldown in Redis
    await sendVerificationEmail(email, verificationCode);
    await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1"); // Value doesn't matter as long as the key exists

    return NextResponse.json({ message: "New verification code sent." }, { status: 200 });
  } catch (error) {
    console.error("Error resending the code:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}