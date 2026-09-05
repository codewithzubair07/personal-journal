"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";

type Entry = {
  id: string;
  createdAt: string | null;
  summary: string;
  mood: string;
  themes: string[];
  score?: number;
};

export function EntryList({ refreshKey }: { refreshKey: number }) {
  const { getIdToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(
    async (similarTo?: string) => {
      const token = await getIdToken();
      const url = similarTo
        ? `/api/entries?similarTo=${encodeURIComponent(similarTo)}`
        : "/api/entries";
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
    },
    [getIdToken]
  );

  useEffect(() => {
    setLoading(true);
    loadEntries().finally(() => setLoading(false));
  }, [loadEntries, refreshKey]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      loadEntries();
      return;
    }
    setSearching(true);
    try {
      await loadEntries(query.trim());
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSearch} className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a past entry like this…"
          className="w-full bg-transparent border-b border-rule focus:border-teal outline-none py-1.5 text-sm text-ink placeholder:text-inkSoft/60"
        />
        {searching && (
          <p className="text-xs text-inkSoft mt-1">Searching by meaning…</p>
        )}
      </form>

      <div className="flex-1 overflow-y-auto space-y-4">
        {loading && <p className="text-sm text-inkSoft">Loading entries…</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-inkSoft italic">
            No entries yet — save your first one.
          </p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="border-b border-rule/70 pb-3">
            <div className="flex items-center justify-between text-xs text-inkSoft/70 mb-1">
              <span>
                {entry.createdAt
                  ? new Date(entry.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Just now"}
              </span>
              <span className="text-ochre">{entry.mood}</span>
            </div>
            <p className="font-serif text-sm text-ink leading-relaxed">
              {entry.summary}
            </p>
            {entry.themes?.length > 0 && (
              <p className="text-xs text-teal mt-1">
                {entry.themes.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
