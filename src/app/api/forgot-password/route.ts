// src/app/api/forgot-password/route.ts

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";
import Redis from "ioredis";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const REDIS_COOLDOWN_SECONDS = 60; // 1 minute cooldown per email request

// Connect to Redis
const redis = new Redis(process.env.REDIS_URL as string);

const generatePasswordResetToken = async () => {
    // Generate a secure, random token
    const token = crypto.randomBytes(32).toString('hex');
    // Hash the token before it's stored in the database to protect it from brute-force attacks
    const hashedToken = await bcrypt.hash(token, 10);
    return { token, hashedToken };
};

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ message: "Email is required." }, { status: 400 });
        }

        const cooldownKey = `forgot_password_cooldown:${email}`;
        
        // Cooldown check in Redis
        const remainingTime = await redis.ttl(cooldownKey);
        if (remainingTime > 0) {
            console.warn(`Rate limit exceeded for password request from email: ${email}`);
            return NextResponse.json(
                { cooldown: remainingTime, message: `Please wait ${remainingTime} seconds before making another request.`},
                { status: 429 } // Too Many Requests
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        // To prevent API abuse, we also send a success message and set the cooldown
        // even if the user is not found.
        if (!user) {
            console.warn(`Password request for non-existent email: ${email}`);
            await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1");
            return NextResponse.json({ message: "If the email address exists, a password reset email has been sent with instructions." }, { status: 200 });
        }

        const { token, hashedToken } = await generatePasswordResetToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token is valid for 1 hour

        // Store token and expiration date in the database
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: expiresAt,
            },
        });

        // Send email and set cooldown in Redis
        await sendPasswordResetEmail(email, token); // Send the unhashed token via email
        await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1");

        return NextResponse.json({ message: "If the email address exists, a password reset email has been sent with instructions." }, { status: 200 });

    } catch (error) {
        console.error("Error during password request:", error);
        return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
}