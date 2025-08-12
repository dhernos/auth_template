// src/app/api/verify/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ message: "E-Mail und Code sind erforderlich." }, { status: 400 });
    }

    const verificationToken = await prisma.verificationToken.findFirst({
      where: {
        token: code,
        user: { email },
        expires: { gt: new Date() } // Überprüft, ob das Token noch gültig ist
      },
      include: { user: true }
    });

    if (!verificationToken) {
      return NextResponse.json({ message: "Ungültiger oder abgelaufener Code." }, { status: 400 });
    }

    // Benutzer als verifiziert markieren und Token löschen
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() }
      });
      await tx.verificationToken.delete({
        where: { id: verificationToken.id }
      });
    });

    return NextResponse.json({ message: "E-Mail erfolgreich verifiziert." }, { status: 200 });
  } catch (error) {
    console.error("Verifizierungsfehler:", error);
    return NextResponse.json({ message: "Interner Serverfehler." }, { status: 500 });
  }
}