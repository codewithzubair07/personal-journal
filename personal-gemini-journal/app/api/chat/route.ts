import { NextRequest, NextResponse } from "next/server";
import { requireUid, AuthError } from "@/lib/firebaseAdmin";
import { chatReply, type ChatTurn } from "@/lib/gemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Verified uid is only used here to confirm the caller is authenticated;
    // chat itself is stateless per-request (history comes from the client's
    // in-progress session), so no cross-user data is touched at all.
    await requireUid(req);

    const body = await req.json();
    const message: unknown = body?.message;
    const history: unknown = body?.history;

    if (typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "history must be an array" }, { status: 400 });
    }

    const safeHistory: ChatTurn[] = history
      .filter(
        (t): t is ChatTurn =>
          t &&
          (t.role === "user" || t.role === "model") &&
          typeof t.text === "string"
      )
      .slice(-30); // cap context sent per request

    const reply = await chatReply(safeHistory, message);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("chat route error", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
