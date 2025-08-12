// src/app/api/register/route.ts
import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "E-Mail und Passwort sind erforderlich." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        return NextResponse.json({ message: "Benutzer existiert bereits. Bitte überprüfe deine E-Mails oder melde dich an, um den Code erneut zu senden." }, { status: 409 });
      }
      return NextResponse.json({ message: "Benutzer mit dieser E-Mail existiert bereits." }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        emailVerified: null,
      }
    });

    const resendResponse = await fetch(`${req.nextUrl.origin}/api/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newUser.email }),
    });

    if (!resendResponse.ok) {
        // Bei einem Fehler der resend-verification API, loggen wir ihn und geben eine Fehlermeldung zurück
        console.error("Fehler beim Aufruf der resend-verification API:", await resendResponse.text());
        return NextResponse.json({ message: "Registrierung fehlgeschlagen: Fehler beim Senden des Verifizierungscodes." }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Registrierung erfolgreich! Bitte überprüfe deine E-Mails, um deinen Account zu verifizieren.", 
      user: { id: newUser.id, email: newUser.email } 
    }, { status: 201 });

  } catch (error) {
    console.error("Registrierungsfehler:", error);
    return NextResponse.json({ message: "Interner Serverfehler." }, { status: 500 });
  }
}