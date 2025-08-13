// src/app/admin/sessions/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SessionTTL from "@/components/SessionTTL";

interface SessionData {
  sessionId: string;
  userId: string;
  expires: string;
  loginTime: string;
  role: string;
  ttlInSeconds: number;
  ipAddress: string;
  userAgent: string;
}

export default function AdminSessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wenn der Status 'loading' ist, warten wir einfach
    if (status === "loading") {
      return;
    }
    
    // Prüfen, ob der Benutzer authentifiziert und ein Admin ist
    if (status === "authenticated") {
      fetchSessions();
    } else {
      // Wenn nicht, wird der Ladevorgang beendet, aber die Seite nicht gerendert
      setLoading(false);
    }
  }, [status, router, session?.user?.role]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sessions");
      if (!res.ok) {
        throw new Error("Failed to fetch sessions");
      }
      const data = await res.json();
      setSessions(data.sessions);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm(`Are you sure you want to delete session ${sessionId}?`)) {
      try {
        const res = await fetch("/api/sessions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          throw new Error("Failed to delete session");
        }
        fetchSessions(); // Sessions nach dem Löschen neu laden
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // Wenn NextAuth noch lädt oder wir auf Daten vom Server warten
  if (status === "loading" || loading) {
    return <div className="p-8">Loading sessions...</div>;
  }

  // Zugriff verweigern, wenn der Benutzer nicht authentifiziert oder kein USER ist
  if (status !== "authenticated") {
    // Weiterleiten, falls unauthentifiziert, sonst "Access Denied" anzeigen
    if (status === "unauthenticated") {
        router.push("/login");
    }
    return <div className="p-8">Access Denied.</div>;
  }
  
  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Active Sessions</h1>
      <p className="mb-4">This page displays all active sessions stored in Redis.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Session ID</th>
              <th className="py-2 px-4 border-b">User ID</th>
              <th className="py-2 px-4 border-b">Role</th>
              <th className="py-2 px-4 border-b">Login Time</th>
              <th className="py-2 px-4 border-b">Expires At</th>
              <th className="py-2 px-4 border-b">Time Left (s)</th>
              <th className="py-2 px-4 border-b">IP Address</th>
              <th className="py-2 px-4 border-b">User Agent</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.sessionId}>
                <td className="py-2 px-4 border-b text-sm break-all">{s.sessionId}</td>
                <td className="py-2 px-4 border-b text-sm break-all">{s.userId}</td>
                <td className="py-2 px-4 border-b text-sm">{s.role}</td>
                <td className="py-2 px-4 border-b text-sm">{new Date(parseInt(s.loginTime)).toLocaleString()}</td>
                <td className="py-2 px-4 border-b text-sm">{new Date(parseInt(s.expires)).toLocaleString()}</td>
                <td className="py-2 px-4 border-b text-sm"><SessionTTL ttlInSeconds={s.ttlInSeconds} /></td>
                <td className="py-2 px-4 border-b text-sm">{s.ipAddress}</td>
                <td className="py-2 px-4 border-b text-sm break-all">{s.userAgent}</td>
                <td className="py-2 px-4 border-b text-center">
                  <button
                    onClick={() => handleDeleteSession(s.sessionId)}
                    className="bg-red-500 text-white px-3 py-1 rounded-md text-xs hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}