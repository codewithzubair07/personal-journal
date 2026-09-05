import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError, adminDb } from "@/lib/firebaseAdmin";
import { summarizeAndTag, embedText, type ChatTurn } from "@/lib/gemini";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const uid = await requireUid(req);

    const body = await req.json();
    const transcript: unknown = body?.transcript;
    if (!Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json(
        { error: "transcript is required" },
        { status: 400 }
      );
    }
    const safeTranscript: ChatTurn[] = transcript.filter(
      (t): t is ChatTurn =>
        t &&
        (t.role === "user" || t.role === "model") &&
        typeof t.text === "string"
    );

    const { summary, mood, themes } = await summarizeAndTag(safeTranscript);
    const embedding = await embedText(summary || safeTranscript.map(t => t.text).join(" "));

    // Isolation: written under this user's own subtree only, using the uid
    // taken from the verified token — never a client-supplied value.
    const docRef = await adminDb()
      .collection("users")
      .doc(uid)
      .collection("entries")
      .add({
        createdAt: FieldValue.serverTimestamp(),
        transcript: safeTranscript,
        summary,
        mood,
        themes,
        embedding,
      });

    return NextResponse.json({ id: docRef.id, summary, mood, themes });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("summarize route error", err);
    return NextResponse.json(
      { error: "Couldn't save this entry. Please try again." },
      { status: 500 }
    );
  }
}
