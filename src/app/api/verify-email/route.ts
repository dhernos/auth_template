// src/app/api/verify-email/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ message: "Email and code are required." }, { status: 400 });
    }

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: code,
        user: { email },
        expires: { gt: new Date() } // Checks if the token is still valid
      },
      include: { user: true }
    });

    if (!verificationToken) {
      return NextResponse.json({ message: "Invalid or expired code." }, { status: 400 });
    }

    // Mark user as verified and delete the token
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() }
      });
      await tx.verificationToken.delete({
        where: { id: verificationToken.id }
      });
    });

    return NextResponse.json({ message: "Email successfully verified." }, { status: 200 });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}