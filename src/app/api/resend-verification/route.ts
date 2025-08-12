// src/app/api/resend-verification/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendVerificationEmail } from "@/lib/verify-email";
import Redis from "ioredis";

const prisma = new PrismaClient();
const REDIS_COOLDOWN_SECONDS = 60;

// Verbindung zu Redis herstellen
// Die URL wird automatisch aus process.env.REDIS_URL gelesen
const redis = new Redis(process.env.REDIS_URL as string);

const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    console.log("Received email:", email);

    if (!email) {
      return NextResponse.json({ message: "E-Mail ist erforderlich." }, { status: 400 });
    }

    const cooldownKey = `resend_cooldown:${email}`;

    // 1. Cooldown-Check in Redis
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
      return NextResponse.json({ message: "Benutzer nicht gefunden." }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "E-Mail ist bereits verifiziert." }, { status: 400 });
    }

    const verificationCode = generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // 2. Vorhandene Tokens löschen und neues erstellen
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

    // 3. E-Mail senden und Cooldown in Redis setzen
    await sendVerificationEmail(email, verificationCode);
    await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1"); // Wert ist egal, solange der Schlüssel existiert

    return NextResponse.json({ message: "Neuer Verifizierungscode gesendet." }, { status: 200 });
  } catch (error) {
    console.error("Fehler beim erneuten Senden des Codes:", error);
    return NextResponse.json({ message: "Interner Serverfehler." }, { status: 500 });
  }
}