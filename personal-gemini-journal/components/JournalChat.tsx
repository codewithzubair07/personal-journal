"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type Turn = { role: "user" | "model"; text: string };

export function JournalChat({ onSaved }: { onSaved: () => void }) {
  const { getIdToken } = useAuth();
  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const message = draft.trim();
    if (!message || sending) return;
    setError(null);
    setDraft("");
    const nextHistory: Turn[] = [...history, { role: "user", text: message }];
    setHistory(nextHistory);
    setSending(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) throw new Error("chat failed");
      const data = await res.json();
      setHistory([...nextHistory, { role: "model", text: data.reply }]);
    } catch {
      setError("Gemini didn't respond — please try again.");
    } finally {
      setSending(false);
    }
  }

  async function saveEntry() {
    if (history.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript: history }),
      });
      if (!res.ok) throw new Error("save failed");
      setHistory([]);
      onSaved();
    } catch {
      setError("Couldn't save this entry — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-5 pb-4">
        {history.length === 0 && (
          <p className="font-serif italic text-inkSoft">
            What's on your mind today?
          </p>
        )}
        {history.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "" : "pl-4 border-l-2 border-teal"}>
            <p className="text-xs uppercase tracking-wide text-inkSoft/70 mb-1">
              {turn.role === "user" ? "You" : "Journal"}
            </p>
            <p className="font-serif text-ink leading-relaxed whitespace-pre-wrap">
              {turn.text}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-700 mb-2">{error}</p>}

      <div className="border-t border-rule pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          placeholder="Write freely — press Enter to send, Shift+Enter for a new line."
          className="w-full bg-transparent outline-none resize-none text-ink font-serif placeholder:text-inkSoft/60"
        />
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={send}
            disabled={sending || !draft.trim()}
            className="text-sm bg-teal hover:bg-tealDark text-parchment px-4 py-1.5 rounded-sm disabled:opacity-50"
          >
            {sending ? "Thinking…" : "Send"}
          </button>
          <button
            onClick={saveEntry}
            disabled={saving || history.length === 0}
            className="text-sm text-ochre underline underline-offset-2 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save & summarize this entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
