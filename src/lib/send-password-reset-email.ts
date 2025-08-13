// src/lib/send-password-reset-email.ts

import nodemailer from "nodemailer";

// Konfiguration des Transporters mit den Umgebungsvariablen
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
    secure: process.env.EMAIL_SERVER_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
    },
});

export const sendPasswordResetEmail = async (email: string, token: string) => {
    const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Passwort zurücksetzen",
        html: `<p>Hallo,</p>
               <p>Du hast eine Anfrage zum Zurücksetzen deines Passworts gestellt.</p>
               <p>Klicke auf den folgenden Link, um dein Passwort zurückzusetzen:</p>
               <a href="${resetLink}">Passwort zurücksetzen</a>
               <p>Dieser Link ist eine Stunde lang gültig.</p>
               <p>Wenn du diese Anfrage nicht gestellt hast, ignoriere diese E-Mail bitte.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Passwort-Reset-E-Mail gesendet an ${email}`);
    } catch (error) {
        console.error("Fehler beim Senden der Passwort-Reset-E-Mail:", error);
        throw new Error("E-Mail konnte nicht gesendet werden.");
    }
};