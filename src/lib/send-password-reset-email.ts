// src/lib/send-password-reset-email.ts

import nodemailer from "nodemailer";

// Configure the transporter with environment variables
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
        subject: "Password Reset",
        html: `<p>Hello,</p>
               <p>You have requested a password reset.</p>
               <p>Click the following link to reset your password:</p>
               <a href="${resetLink}">Reset Password</a>
               <p>This link is valid for one hour.</p>
               <p>If you did not request this, please ignore this email.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to ${email}`);
    } catch (error) {
        console.error("Error sending password reset email:", error);
        throw new Error("Could not send email.");
    }
};