// src/app/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import SessionTTL from "@/components/SessionTTL";

// Define a type for the additional session data we're fetching from the backend
interface SessionInfo {
  expires: string;
  loginTime: string;
  role: string;
  ttlInSeconds: number;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [loadingSessionInfo, setLoadingSessionInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle session errors that the JWT callback might set
  useEffect(() => {
    if (session?.error) {
      setError(
        "Your session has expired or is invalid. Please log in again."
      );
      // Optional, automatic sign out
      // signOut({ callbackUrl: "/login?error=InvalidSessionError" });
    } else {
      setError(null);
    }
  }, [session]);

  // Function to fetch the session details from your new API
  // This would get the actual TTLs from Redis
  const fetchSessionDetails = async () => {
    setLoadingSessionInfo(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions/current");
      if (!response.ok) {
        throw new Error("Failed to retrieve session details.");
      }
      const data = await response.json();
      setSessionInfo(data);
    } catch (err) {
      console.error(err);
      setError("Could not load session details.");
    } finally {
      setLoadingSessionInfo(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  if (status === "loading") {
    return <p className="p-8 text-center">Loading session...</p>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
      <h1 className="mb-8 text-4xl font-bold">Welcome to the Next.js Template!</h1>

      {session ? (
        <div className="rounded-lg bg-white p-8 shadow-md text-center max-w-xl w-full">
          <p className="mb-4 text-lg">
            Logged in as: <span className="font-semibold">{session.user?.email}</span>
            {session.user?.role && (
              <span className="ml-2 text-sm text-gray-500">({session.user.role})</span>
            )}
          </p>

          <p className="mb-4 text-lg">
            Session valid until:{" "}
            <span className="font-semibold">
              {session.expires
                ? new Date(session.expires).toLocaleString()
                : "Unknown"}
            </span>
          </p>

          {/* Display the error if it exists */}
          {error && (
            <p className="mb-4 mt-4 text-center text-red-600 font-bold">
              Error: {error}
            </p>
          )}

          {/* Buttons to fetch and display the Redis session information */}
          <div className="mt-6">
            <h2 className="mb-2 text-xl font-bold">Redis Session Details</h2>
            <button
              onClick={fetchSessionDetails}
              disabled={loadingSessionInfo}
              className="rounded-md bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-600 disabled:opacity-50 cursor-pointer"
            >
              {loadingSessionInfo ? "Loading..." : "Show Redis Session Details"}
            </button>

            {sessionInfo && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md text-left border border-gray-200">
                <p>
                  <span className="font-semibold">Login Time:</span>{" "}
                  {new Date(parseInt(sessionInfo.loginTime)).toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold">Expires At:</span>{" "}
                  {new Date(parseInt(sessionInfo.expires)).toLocaleString()}
                </p>
                  <SessionTTL ttlInSeconds={sessionInfo.ttlInSeconds} />
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="mt-6 rounded-md bg-red-500 px-6 py-3 font-bold text-white hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 cursor-pointer"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-4 text-lg">You are not logged in.</p>
          <Link
            href="/login"
            className="rounded-md bg-blue-500 px-6 py-3 font-bold text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 cursor-pointer"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="ml-4 rounded-md bg-purple-500 px-6 py-3 font-bold text-white hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 cursor-pointer"
          >
            Register
          </Link>
        </div>
      )}
    </div>
  );
}