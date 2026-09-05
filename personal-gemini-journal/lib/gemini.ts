// Server-only. Wraps @google/genai so API routes never touch the raw key.
import { GoogleGenAI } from "@google/genai";
import { getGeminiApiKey } from "./secrets";

let client: GoogleGenAI | null = null;

async function getClient(): Promise<GoogleGenAI> {
  if (client) return client;
  const apiKey = await getGeminiApiKey();
  client = new GoogleGenAI({ apiKey });
  return client;
}

const MAX_TURN_CHARS = 4000; // basic abuse/cost guardrail

export type ChatTurn = { role: "user" | "model"; text: string };

export async function chatReply(
  history: ChatTurn[],
  message: string
): Promise<string> {
  if (message.length > MAX_TURN_CHARS) {
    throw new Error("Message too long.");
  }
  const ai = await getClient();
  const chat = ai.chats.create({
    model: "gemini-2.0-flash",
    history: history.map((t) => ({
      role: t.role,
      parts: [{ text: t.text }],
    })),
    config: {
      systemInstruction:
        "You are a warm, reflective journaling companion. Ask gentle " +
        "follow-up questions, don't lecture, and keep replies concise " +
        "(2-5 sentences) so the person keeps writing, not reading.",
    },
  });
  const res = await chat.sendMessage({ message });
  return res.text ?? "";
}

export async function summarizeAndTag(
  transcript: ChatTurn[]
): Promise<{ summary: string; mood: string; themes: string[] }> {
  const ai = await getClient();
  const transcriptText = transcript
    .map((t) => `${t.role === "user" ? "Me" : "Journal"}: ${t.text}`)
    .join("\n");

  const res = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Summarize this journal conversation in 2-3 sentences, " +
              "first person, as if the writer is recapping their own " +
              "entry. Then classify the overall mood in one or two words " +
              "and list 1-3 short themes. Respond ONLY as JSON with keys " +
              'summary, mood, themes (array of strings). No markdown.' +
              "\n\n" +
              transcriptText,
          },
        ],
      },
    ],
  });

  const raw = (res.text ?? "{}").trim();
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(cleaned);
    return {
      summary: String(parsed.summary ?? ""),
      mood: String(parsed.mood ?? "unspecified"),
      themes: Array.isArray(parsed.themes) ? parsed.themes.map(String) : [],
    };
  } catch {
    return { summary: raw.slice(0, 500), mood: "unspecified", themes: [] };
  }
}

export async function embedText(text: string): Promise<number[]> {
  const ai = await getClient();
  const res = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return res.embeddings?.[0]?.values ?? [];
}

export type RetrievedEntry = {
  index: number;
  date: string | null;
  mood: string;
  summary: string;
};

/**
 * RAG answer generation: grounds Gemini's answer strictly in the retrieved
 * past entries passed in `context`, and asks it to cite which entry
 * (by index) each part of the answer draws from, and to say plainly when
 * the context doesn't cover the question rather than guessing.
 */
export async function answerFromContext(
  question: string,
  context: RetrievedEntry[]
): Promise<string> {
  const ai = await getClient();
  const contextBlock = context
    .map(
      (c) =>
        `[Entry ${c.index}] ${c.date ? new Date(c.date).toDateString() : "undated"} (mood: ${c.mood})\n${c.summary}`
    )
    .join("\n\n");

  const res = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "You are answering a question about the user's OWN past " +
              "journal entries, shown below. Answer only from these " +
              "entries — do not invent details that aren't there. Refer " +
              "to entries by their date when relevant (e.g. 'On Entry 2, " +
              "from March 4, you wrote...'). If the entries don't contain " +
              "an answer, say so plainly instead of guessing. Keep the " +
              "tone warm and reflective, 2-5 sentences.\n\n" +
              `PAST ENTRIES:\n${contextBlock}\n\n` +
              `QUESTION: ${question}`,
          },
        ],
      },
    ],
  });

  return res.text ?? "I couldn't find an answer in your past entries.";
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
