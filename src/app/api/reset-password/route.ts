import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ message: "Token and password are required." }, { status: 400 });
    }

    // Get all users with a valid passwordResetToken
    const usersWithTokens = await prisma.user.findMany({
      where: {
        passwordResetToken: {
          not: null,
        },
      },
    });

    let user = null;
    // Iterate through the users to find the matching token
    for (const u of usersWithTokens) {
      if (u.passwordResetToken && await bcrypt.compare(token, u.passwordResetToken)) {
        user = u;
        break; // Once the user is found, we break the loop
      }
    }

    if (!user) {
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 400 });
    }

    // Manually check the expiration date
    if (user.passwordResetExpires && user.passwordResetExpires.getTime() < Date.now()) {
      return NextResponse.json({ message: "Invalid or expired token." }, { status: 400 });
    }

    // Hash and update the password
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({ message: "Password has been reset successfully." }, { status: 200 });
  } catch (error) {
    console.error("Error resetting the password:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}