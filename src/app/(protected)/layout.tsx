// src/app/dashboard/layout.tsx

"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import LoadingPage from '@/components/loading-page'; // A simple loading component

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If the session becomes invalid, we redirect
    if (status === "unauthenticated" || session?.error) {
      console.log("ProtectedLayout: Session invalid, redirecting.");
      router.push("/logout");
    }
  }, [status, session?.error, router]);

  // Show a loading page until the status is determined
  if (status === "loading") {
    return <LoadingPage />;
  }

  // Render the page only if the user is authenticated
  if (status === "authenticated") {
    return <>{children}</>;
  }

  // Default case if something is wrong (should be rarely reached)
  return null;
}