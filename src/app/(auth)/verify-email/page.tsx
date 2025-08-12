// src/app/(auth)/verify-email/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const initialCode = searchParams.get("code") || "";

  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Function to handle the verification process
  const verifyAccount = async (verificationCode: string) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (!verificationCode || verificationCode.length !== 6) {
      setError("Bitte gib einen 6-stelligen Code ein.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("E-Mail erfolgreich verifiziert! Du wirst weitergeleitet...");
        setTimeout(() => {
          router.push("/login?verificationSuccess=true");
        }, 2000);
      } else {
        setError(data.message || "Verifizierung fehlgeschlagen. Bitte versuche es erneut.");
      }
    } catch (err) {
      setError("Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If no email is in the query parameters, redirect to register
    if (!email) {
      router.push("/register");
    }

    // Automatically verify if both email and code are in the URL
    if (email && initialCode) {
      verifyAccount(initialCode);
    }
  }, [email, router, initialCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyAccount(code);
  };

  const [cooldown, setCooldown] = useState(0);

  const handleResend = async () => {
    if (!email || resendLoading || cooldown > 0) return;
    setResendLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Neuer Verifizierungscode wurde gesendet. Bitte überprüfe dein Postfach.");
        // Start the client-side countdown
        setCooldown(60);
      }else if (response.status === 429){
        setCooldown(data.cooldown); 
      } else {
        setError(data.message || "Senden des neuen Codes fehlgeschlagen.");
      }
    } catch (err) {
      setError("Fehler beim Senden des neuen Codes. Bitte versuche es später erneut.");
    } finally {
      setResendLoading(false);
    }
  };

  // Add a useEffect to manage the countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md mx-auto p-4 space-y-4 shadow-lg rounded-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">E-Mail verifizieren</CardTitle>
          <CardDescription>
            Bitte gib den 6-stelligen Code ein, den wir an deine E-Mail-Adresse <b>{email}</b> gesendet haben.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="code" className="mb-2 block text-sm font-bold">
                Verifizierungscode:
              </label>
              <Input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={loading}
                maxLength={6}
                pattern="\d{6}"
                inputMode="numeric"
                className="text-center text-lg font-mono"
              />
            </div>
            
            {error && <p className="mb-4 text-center text-red-500">{error}</p>}
            {success && <p className="mb-4 text-center text-green-600">{success}</p>}
            
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading || code.length !== 6}
            >
              {loading ? "Verifizieren..." : "Account verifizieren"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm">
            Keinen Code erhalten?{" "}
            <Button
              variant="link"
              onClick={handleResend}
              disabled={resendLoading || !email || cooldown > 0}
              className="text-blue-600 hover:text-blue-500 cursor-pointer"
            >
              {resendLoading
                ? "Sende erneut..."
                : cooldown > 0
                ? `Erneut senden in ${cooldown}s`
                : "Code erneut senden"}
            </Button>
          </p>
          <p className="mt-2 text-center text-sm">
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Zurück zur Registrierung
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}