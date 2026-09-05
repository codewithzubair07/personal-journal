import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError, adminDb } from "@/lib/firebaseAdmin";
import { cosineSimilarity, embedText } from "@/lib/gemini";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const uid = await requireUid(req);
    const similarTo = req.nextUrl.searchParams.get("similarTo");

    // Every query is scoped to this user's own subtree — isolation is
    // structural (path includes uid), not just a filter that could be
    // forgotten.
    const snap = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("entries")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const entries = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        summary: data.summary,
        mood: data.mood,
        themes: data.themes,
        embedding: data.embedding as number[] | undefined,
      };
    });

    if (!similarTo || !similarTo.trim()) {
      return NextResponse.json({
        entries: entries.map(({ embedding, ...rest }) => rest),
      });
    }

    // Phase 3: semantic recall — embed the query, rank stored entries by
    // cosine similarity instead of keyword match.
    const queryVec = await embedText(similarTo);
    const ranked = entries
      .filter((e) => e.embedding && e.embedding.length > 0)
      .map((e) => ({
        ...e,
        score: cosineSimilarity(queryVec, e.embedding as number[]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ embedding, ...rest }) => rest);

    return NextResponse.json({ entries: ranked });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("entries route error", err);
    return NextResponse.json(
      { error: "Couldn't load entries." },
      { status: 500 }
    );
  }
}
