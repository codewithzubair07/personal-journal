"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/journal" : "/login");
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-parchment">
      <p className="font-serif text-inkSoft italic">Opening your journal…</p>
    </main>
  );
}
