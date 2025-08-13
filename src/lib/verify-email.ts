// src/lib/verify-email.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: parseInt(process.env.EMAIL_SERVER_PORT || "587", 10),
  secure: process.env.EMAIL_SERVER_SECURE === "true",
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export const sendVerificationEmail = async (email: string, code: string) => {
  // Update the verification link to include both email and code
  const verificationLink = `${process.env.NEXTAUTH_URL}/verify-email?email=${encodeURIComponent(email)}&code=${code}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify Your Email Address",
    html: `
      <div style="font-family: sans-serif; text-align: center; color: #333;">
        <h2 style="color: #007bff;">Welcome!</h2>
        <p>Thank you for registering. Please use the following code or click the button to verify your email address:</p>
        <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; padding: 15px; background-color: #f0f0f0; border-radius: 8px; display: inline-block; margin-bottom: 20px;">
          ${code}
        </div>
        <p>
          <a href="${verificationLink}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email Address
          </a>
        </p>
        <p>The code is valid for <b>only 10 minutes</b>.</p>
        <p>If you did not register, you can ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};