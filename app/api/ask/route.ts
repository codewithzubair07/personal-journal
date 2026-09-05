import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError, adminDb } from "@/lib/firebaseAdmin";
import { embedText, cosineSimilarity, answerFromContext } from "@/lib/gemini";

export const runtime = "nodejs";

const MAX_QUESTION_CHARS = 500;
const TOP_K = 4;

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUid(req);

    const body = await req.json();
    const question: unknown = body?.question;
    if (typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json({ error: "question too long" }, { status: 400 });
    }

    // Isolation: only ever reads this uid's own subtree, from the verified
    // token — never a client-supplied id.
    const snap = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("entries")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const entries = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
          summary: data.summary as string,
          mood: data.mood as string,
          embedding: data.embedding as number[] | undefined,
        };
      })
      .filter((e) => e.embedding && e.embedding.length > 0 && e.summary);

    if (entries.length === 0) {
      return NextResponse.json({
        answer:
          "You don't have any saved entries yet, so there's nothing for me to look back on. Journal a bit and save an entry, then ask again.",
        sources: [],
      });
    }

    const queryVec = await embedText(question);
    const ranked = entries
      .map((e) => ({ ...e, score: cosineSimilarity(queryVec, e.embedding!) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    // Only pass relevant retrieved context to the model — never the whole
    // journal history — keeping the prompt scoped and cheap.
    const context = ranked.map((e, i) => ({
      index: i + 1,
      date: e.createdAt,
      mood: e.mood,
      summary: e.summary,
    }));

    const answer = await answerFromContext(question, context);

    return NextResponse.json({
      answer,
      sources: ranked.map((e) => ({
        id: e.id,
        createdAt: e.createdAt,
        summary: e.summary,
        mood: e.mood,
        score: e.score,
      })),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("ask route error", err);
    return NextResponse.json(
      { error: "Couldn't answer that right now. Please try again." },
      { status: 500 }
    );
  }
}
