"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center font-mono text-terminal-green">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-terminal-green border-t-transparent animate-spin" />
        <p className="text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
          Initializing_Finance_OS...
        </p>
      </div>
    </div>
  );
}
