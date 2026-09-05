"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { JournalChat } from "@/components/JournalChat";
import { EntryList } from "@/components/EntryList";
import { AskJournal } from "@/components/AskJournal";

export default function JournalPage() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-parchment">
        <p className="font-serif text-inkSoft italic">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-parchment">
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <h1 className="font-serif text-xl text-ink">Personal Journal</h1>
        <button
          onClick={() => logOut()}
          className="text-sm text-inkSoft underline underline-offset-2"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8 px-6 py-8">
        <section className="h-[70vh] flex flex-col gap-6">
          <div className="flex-1 min-h-0">
            <JournalChat onSaved={() => setRefreshKey((k) => k + 1)} />
          </div>
          <AskJournal />
        </section>
        <aside className="h-[70vh] border-l border-rule pl-6">
          <h2 className="font-serif text-sm uppercase tracking-wide text-inkSoft/70 mb-3">
            Past entries
          </h2>
          <EntryList refreshKey={refreshKey} />
        </aside>
      </div>
    </main>
  );
}
