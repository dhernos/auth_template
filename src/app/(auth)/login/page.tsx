// src/app/(auth)/login/page.tsx

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { ForgotPasswordDialog } from "@/components/forgot-password-dialog";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isForgotPasswordDialogOpen, setIsForgotPasswordDialogOpen] = useState(false);
  
  const signupSuccess = searchParams.get("signupSuccess");
  const verificationSuccess = searchParams.get("verificationSuccess");
  const initialMessage = signupSuccess ? "Registrierung erfolgreich! Bitte verifiziere deine E-Mail." : 
                        verificationSuccess ? "E-Mail verifiziert! Du kannst dich jetzt anmelden." : null;
  const [successMessage, setSuccessMessage] = useState<string | null>(initialMessage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      rememberMe,
    });

    if (result?.error) {
      if (result.error === "EMAIL_NOT_VERIFIED") {
        // NEUE LOGIK: Weiterleitung zur Verifizierungsseite bei diesem spezifischen Fehler
        console.warn("Anmeldeversuch mit nicht verifizierter E-Mail. Leite zur Verifizierungsseite weiter.");
        try {
          const response = await fetch("api/resend-verification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email }),
          });
        } catch (err) {
          throw new Error("Fehler beim Senden des neuen Codes. Bitte versuche es später erneut.");
        }
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      } else {
        // Bei allen anderen Fehlern (z.B. falsche Anmeldeinformationen)
        setError("E-Mail oder Passwort ist falsch.");
        console.error("Login fehlgeschlagen:", result.error);
      }
    } else if (result?.ok) {
      router.push(callbackUrl);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md mx-auto p-4 space-y-4 shadow-lg rounded-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Anmelden</CardTitle>
          <CardDescription>Melde dich bei deinem Konto an</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="mb-2 block text-sm font-bold">E-Mail:</label>
              <Input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                className="w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="mb-6">
              <label htmlFor="password" className="mb-2 block text-sm font-bold">Passwort:</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  className="w-full"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute bottom-1 right-1 h-7 w-7 cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  <span className="sr-only">Toggle password visibility</span>
                </Button>
              </div>
            </div>
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  className="mr-2 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                />
                <label htmlFor="rememberMe" className="text-sm cursor-pointer">
                  Angemeldet bleiben
                </label>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotPasswordDialogOpen(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-500 cursor-pointer"
              >
                Passwort vergessen?
              </button>
            </div>
            
            {error && <p className="mb-4 text-center text-red-500">{error}</p>}
            {successMessage && <p className="mb-4 text-center text-green-600">{successMessage}</p>}
            
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={loading}
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm">
            Noch kein Konto?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              Jetzt registrieren
            </Link>
          </p>
        </CardContent>
      </Card>
      
      <ForgotPasswordDialog
        isOpen={isForgotPasswordDialogOpen}
        onClose={() => setIsForgotPasswordDialogOpen(false)}
      />
    </div>
  );
}