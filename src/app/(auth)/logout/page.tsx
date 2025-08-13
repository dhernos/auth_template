"use client";

import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from 'next/navigation';

export default function LogOut() {
  const router = useRouter();

  useEffect(() => {
    // Call signOut with the redirect option to go to the login page
    signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-xl">You are being logged out...</h1>
    </div>
  );
}