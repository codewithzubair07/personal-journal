"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Source = {
  id: string;
  createdAt: string | null;
  summary: string;
  mood: string;
  score: number;
};

export function AskJournal() {
  const { getIdToken } = useAuth();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("ask failed");
      const data = await res.json();
      setAnswer(data.answer);
      setSources(data.sources ?? []);
    } catch {
      setError("Couldn't answer that — please try again.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="border border-rule rounded-sm p-4 bg-parchmentDark/40">
      <h2 className="font-serif text-sm uppercase tracking-wide text-inkSoft/70 mb-2">
        Ask your journal
      </h2>
      <form onSubmit={handleAsk} className="flex gap-2 mb-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What have I said about feeling anxious at work?"
          className="flex-1 bg-transparent border-b border-rule focus:border-teal outline-none py-1.5 text-sm text-ink placeholder:text-inkSoft/60"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="text-sm bg-teal hover:bg-tealDark text-parchment px-3 py-1.5 rounded-sm disabled:opacity-50"
        >
          {asking ? "Thinking…" : "Ask"}
        </button>
      </form>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {answer && (
        <div className="space-y-3">
          <p className="font-serif text-ink leading-relaxed">{answer}</p>
          {sources.length > 0 && (
            <div>
              <p className="text-xs text-inkSoft/70 uppercase tracking-wide mb-1">
                Drawn from
              </p>
              <ul className="space-y-1">
                {sources.map((s) => (
                  <li key={s.id} className="text-xs text-inkSoft">
                    <span className="text-ochre">
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "undated"}
                    </span>{" "}
                    ({s.mood}) — {s.summary.slice(0, 80)}
                    {s.summary.length > 80 ? "…" : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
