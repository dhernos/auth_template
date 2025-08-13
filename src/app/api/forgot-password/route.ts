// src/app/api/forgot-password/route.ts

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";
import Redis from "ioredis";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const REDIS_COOLDOWN_SECONDS = 60; // 1 Minute Cooldown pro E-Mail-Anfrage

// Verbindung zu Redis herstellen
const redis = new Redis(process.env.REDIS_URL as string);

const generatePasswordResetToken = async () => {
    // Generiere einen sicheren, zufälligen Token
    const token = crypto.randomBytes(32).toString('hex');
    // Hashe den Token, bevor er in der Datenbank gespeichert wird, um ihn vor Brute-Force-Angriffen zu schützen
    const hashedToken = await bcrypt.hash(token, 10);
    return { token, hashedToken };
};

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json({ message: "E-Mail ist erforderlich." }, { status: 400 });
        }

        const cooldownKey = `forgot_password_cooldown:${email}`;
        
        // Cooldown-Check in Redis
        const remainingTime = await redis.ttl(cooldownKey);
        if (remainingTime > 0) {
            console.warn(`Rate-Limit überschritten für Passwort-Anfrage von E-Mail: ${email}`);
            return NextResponse.json(
                { cooldown: remainingTime, message: `Bitte warte ${remainingTime} Sekunden, bevor du eine neue Anfrage stellst.`},
                { status: 429 } // Too Many Requests
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        // Um das Ausnutzen der API zu verhindern, geben wir auch bei nicht gefundenem Benutzer 
        // eine Erfolgsmeldung aus und setzen das Cooldown.
        if (!user) {
            console.warn(`Passwort-Anfrage für nicht existierende E-Mail: ${email}`);
            await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1");
            return NextResponse.json({ message: "Wenn die E-Mail-Adresse existiert, wurde eine E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet." }, { status: 200 });
        }

        const { token, hashedToken } = await generatePasswordResetToken();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token ist 1 Stunde gültig

        // Token und Ablaufdatum in der Datenbank speichern
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: expiresAt,
            },
        });

        // E-Mail senden und Cooldown in Redis setzen
        await sendPasswordResetEmail(email, token); // Sende den unverschlüsselten Token per E-Mail
        await redis.setex(cooldownKey, REDIS_COOLDOWN_SECONDS, "1");

        return NextResponse.json({ message: "Wenn die E-Mail-Adresse existiert, wurde eine E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet." }, { status: 200 });

    } catch (error) {
        console.error("Fehler bei der Passwort-Anfrage:", error);
        return NextResponse.json({ message: "Interner Serverfehler." }, { status: 500 });
    }
}