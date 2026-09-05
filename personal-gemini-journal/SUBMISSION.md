# Submission: Personal Gemini Journal

**Challenge:** Build a Secure "Personal Gemini Journal" — Ideathon (Gen AI
Exchange, Cohort 3)

## One-liner

A private journal that talks back — and can answer questions about your own
past, grounded in what you actually wrote — built on an AI Studio
configuration that treats security as the default, not an afterthought.

## The problem this challenge is really testing

Most AI-generated apps demo well and fail in production: hardcoded keys, no
real auth boundary, one shared database with a `userId` column anyone could
forget to filter on. This submission treats that as the actual challenge —
not "can Gemini write a journaling app" (trivial) but "can I configure my
tools so the *first* version Gemini writes is already safe to put in front
of real users."

## What we built

### Phase 1 — The AI Studio "constitution"

Before writing any app code, we configured Google AI Studio's Custom
Instructions with an explicit security posture: threat-model before coding,
never hardcode secrets, verify identity server-side on every request, isolate
data structurally (not just by convention), and fail safely. Full text is in
`AI_STUDIO_CUSTOM_INSTRUCTIONS.md` — every downstream file traces back to a
specific rule in it (see the "why" comments in the code).

### Phase 2 — The four required pieces

| Requirement | How it's met |
|---|---|
| User authentication | Firebase Auth via **Google Sign-In (federated)** — the app never collects, stores, or handles a password; every API route verifies the Firebase ID token server-side via the Admin SDK — never trusts a client-supplied user ID |
| Multi-turn AI interaction | `/api/chat` holds a real back-and-forth with Gemini, journaling-companion persona, session-scoped history, resilient across a model fallback ladder (`lib/gemini.ts`) if the primary model is rate-limited or unavailable |
| Isolated data storage | Firestore path is `users/{uid}/entries/{entryId}` — isolation is structural, reinforced by deny-by-default Firestore Security Rules, not just an app-level filter |
| Secure key management | Gemini API key is fetched from Google Cloud Secret Manager at runtime (`lib/secrets.ts`); local dev falls back to an env var, but production never touches a hardcoded key |

### Phase 3 — Three features beyond the base spec

1. **Mood & Theme Insights** — every saved entry is auto-tagged by Gemini
   with a mood and 1–3 themes, so patterns become visible over time instead
   of a wall of undifferentiated text.
2. **Semantic Recall** — search past entries by *meaning*, not keywords
   (searching "burned out" surfaces an entry that said "running on empty").
3. **Ask Your Journal (RAG)** — the technical centerpiece. Ask a real
   question ("What have I said about feeling anxious at work?") and the app:
   - embeds the question,
   - retrieves the most relevant past entries from *that user's own*
     isolated data,
   - passes only that retrieved context into the prompt,
   - has Gemini answer strictly from it, citing entries by date, and
     explicitly saying when the journal doesn't cover the question.

   This is a complete, working retrieval-augmented-generation loop — not a
   chatbot bolted onto a database. It's also where the security posture and
   the product idea intersect: retrieval is *provably* scoped to one user's
   data, because the query itself is structurally incapable of reaching
   anyone else's Firestore subtree.

## Architecture

```
Browser (Next.js/React)
  │ Firebase Auth (client) — sign-in only, no secrets
  ▼
Next.js API routes (server, Node runtime)
  │ 1. Verify Firebase ID token → trusted uid
  │ 2. Fetch Gemini key from Secret Manager (cached)
  │ 3. Call Gemini — chat / summarize+tag / embed / RAG-answer
  │ 4. Read/write Firestore under users/{uid}/... only
  ▼
Firestore — Security Rules deny by default, allow only request.auth.uid == uid
```

## Why this stands out

- **The security work is real, not decorative.** Every one of the four
  required pieces has a concrete, inspectable mechanism behind it (verified
  tokens, deny-by-default rules, runtime secret fetch) — not just a claim in
  the README.
- **The bonus feature is technically substantive.** RAG over personal data
  with source citation is a genuine pattern used in production AI products,
  scaled down to a clean, demoable implementation — not a gimmick feature.
- **Phase 1 visibly shaped Phase 2.** The custom instructions aren't a
  standalone artifact; the code comments trace each security decision back
  to a specific rule in them, showing the AI Studio configuration actually
  did its job.

## Brief description (for the submission form field)

Personal Gemini Journal is a production-ready, authenticated journaling app
deployed on **Cloud Run**. Users sign in with **Firebase Authentication**
via federated Google Sign-In (no passwords ever handled by app code); their
conversations with the **Gemini API** (configured via custom
production-security instructions in **Google AI Studio**, including a
resilient multi-model fallback ladder) are auto-summarized, mood/theme-
tagged, and stored per-user in **Firestore** at
`users/{uid}/entries/{entryId}`, isolated by deny-by-default Firestore
Security Rules and server-side Firebase ID token verification on every
request. The Gemini API key is never hardcoded — it's fetched at runtime
from **Google Cloud Secret Manager** using a least-privilege Cloud Run
service account. Beyond the base spec, it includes mood/theme auto-tagging,
semantic recall search over past entries, and a retrieval-augmented
"Ask Your Journal" feature that answers questions grounded only in the
user's own retrieved entries, with cited sources.

## Demo script (for judges, ~2 minutes)

1. Show `AI_STUDIO_CUSTOM_INSTRUCTIONS.md` pasted into AI Studio — 15 sec.
2. Sign in live with Google (federated auth — point out there's no
   password form anywhere, and no key visible in the client) — 15 sec.
3. Journal a short entry with Gemini (2–3 exchanges), hit **Save & summarize**
   — show the auto mood/theme tag appear in the sidebar — 30 sec.
4. Use **Ask your journal** to ask a question about that entry — show the
   grounded answer and the cited source underneath it — 30 sec.
5. Briefly open `firestore.rules` and the token-verification line in
   `lib/firebaseAdmin.ts` — this is where "zero cross-user leakage" actually
   lives, not just in a sentence in the README — 30 sec.

## Tech stack

Next.js 14 (App Router, TypeScript) · Firebase Auth · Firebase Admin SDK ·
Cloud Firestore · Google Cloud Secret Manager · Gemini 2.0 Flash +
text-embedding-004 (via `@google/genai`) · Tailwind CSS
