"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace("/journal");
    } catch {
      setError("Couldn't sign you in — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-parchment flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-3xl text-ink mb-1">
          Personal Journal
        </h1>
        <p className="text-inkSoft text-sm mb-8">
          A private space to think out loud with Gemini.
        </p>

        {/* Federated sign-in only — no password is ever collected, stored,
            or handled by this application's code. */}
        <button
          onClick={handleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-ink hover:bg-inkSoft text-parchment py-2.5 rounded-sm disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#fff"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62Z"
            />
            <path
              fill="#fff"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.98v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#fff"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.05l2.99-2.33Z"
            />
            <path
              fill="#fff"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.59-2.59A9 9 0 0 0 .98 4.95l2.99 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>

        {error && <p className="text-sm text-red-700 mt-4">{error}</p>}
      </div>
    </main>
  );
}
