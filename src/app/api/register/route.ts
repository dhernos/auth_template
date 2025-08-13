// src/app/api/register/route.ts
import { NextResponse, NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        return NextResponse.json({ message: "User already exists. Please check your emails or sign in to resend the code." }, { status: 409 });
      }
      return NextResponse.json({ message: "A user with this email already exists." }, { status: 409 });
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
        // In case of an error from the resend-verification API, we log it and return an error message
        console.error("Error calling the resend-verification API:", await resendResponse.text());
        return NextResponse.json({ message: "Registration failed: Error sending the verification code." }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Registration successful! Please check your emails to verify your account.", 
      user: { id: newUser.id, email: newUser.email } 
    }, { status: 201 });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}