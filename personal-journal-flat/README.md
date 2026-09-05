# Personal Gemini Journal

An authenticated journaling web app: sign in, brainstorm or journal in a
multi-turn chat with Gemini, and have the conversation automatically
summarized and saved — with per-user data isolation and no secrets in code.

Built to satisfy the Ideathon brief in three phases:

- **Phase 1** — `AI_STUDIO_CUSTOM_INSTRUCTIONS.md`: the security "constitution"
  pasted into Google AI Studio before any code was generated.
- **Phase 2** — the app itself (auth, multi-turn Gemini chat, isolated
  Firestore storage, Secret Manager–sourced API key).
- **Phase 3** — three added features, all beyond the base spec:
  1. **Mood & Theme Insights** — every saved entry is auto-tagged with a
     mood and 1–3 themes by Gemini.
  2. **Semantic Recall** — "Find a past entry like this" embeds the query
     and your past summaries to surface the most similar old entry by
     meaning, not keyword match.
  3. **Ask Your Journal (RAG)** — a real retrieval-augmented-generation
     feature: ask a natural-language question ("What have I said about
     feeling anxious at work?"), the app embeds the question, retrieves
     the most relevant past entries from *your own* isolated Firestore
     data, and Gemini answers grounded only in that retrieved context —
     citing which entry (by date) each part of the answer comes from, and
     saying plainly when your journal doesn't cover the question rather
     than inventing an answer. This is the technical centerpiece of the
     submission: it demonstrates retrieval + grounding, not just a chatbot
     wrapper.

## Architecture

```
Browser (React/Next.js)
  │  Firebase Auth (client SDK) — sign-in only, no secrets here
  ▼
Next.js API routes (server-side, Node runtime)
  │  1. Verify Firebase ID token (Admin SDK) → trusted uid
  │  2. Fetch Gemini API key from Secret Manager (cached in memory)
  │  3. Call Gemini (chat, then summarize + tag on "save")
  │  4. Read/write Firestore under users/{uid}/... only
  ▼
Firestore (Security Rules: request.auth.uid == uid, deny by default)
```

Nothing in the client bundle ever contains the Gemini API key. The Firebase
*client* config (`NEXT_PUBLIC_FIREBASE_*`) is not a secret by Firebase's own
design, but Firestore Security Rules are what actually protect data — the
config alone grants no read/write access.

## Stack

- Next.js 14 (App Router, TypeScript)
- Firebase Auth (client) + Firebase Admin SDK (server, token verification)
- Cloud Firestore (per-user isolated storage)
- Google Cloud Secret Manager (Gemini API key at runtime)
- `@google/genai` for Gemini calls (text chat + summarization/tagging +
  embeddings for semantic recall)
- Tailwind CSS for styling

## Setup

1. **Firebase project**
   - Create a Firebase project, enable **Authentication → Google** (federated
     sign-in only — this app never collects or stores a password; see
     `components/AuthProvider.tsx`) and **Firestore** (native mode).
   - Deploy `firestore.rules` (`firebase deploy --only firestore:rules`).
   - Create a **service account** (Project Settings → Service Accounts →
     Generate new private key) for the Admin SDK.

2. **Secrets**
   - Store the Gemini API key in **Google Cloud Secret Manager** as a secret
     named `gemini-api-key` (or set `GEMINI_API_KEY` directly in your deploy
     platform's env for local dev — see `lib/secrets.ts`, which falls back
     to the env var when `GOOGLE_CLOUD_PROJECT` isn't set, so you're never
     forced to touch real GCP infra just to run this locally).
   - Grant the runtime service account the **Secret Manager Secret Accessor**
     role only.

3. **Environment variables** — copy `.env.example` to `.env.local` and fill
   in:
   - `NEXT_PUBLIC_FIREBASE_*` — client Firebase config (from Firebase
     console, public by design).
   - `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
     `FIREBASE_ADMIN_PRIVATE_KEY` — from the service account JSON (server
     only, never `NEXT_PUBLIC_*`).
   - `GOOGLE_CLOUD_PROJECT` — enables Secret Manager lookup; omit locally to
     use `GEMINI_API_KEY` directly instead.
   - `GEMINI_API_KEY` — local/dev fallback only; in production this should
     live in Secret Manager, not here.

4. **Install & run locally**
   ```bash
   npm install
   npm run dev
   ```

## Deploying to Cloud Run

This submission requires deployment on **Cloud Run** specifically (not just
any Node host), per the ideathon's mandatory submission rules.

1. **Build and push the image** (from the project root, with `gcloud` and
   Docker configured for your project):
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/personal-gemini-journal \
     --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY
   ```
   or build locally and push:
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
     --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
     --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
     --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
     -t gcr.io/YOUR_PROJECT_ID/personal-gemini-journal .
   docker push gcr.io/YOUR_PROJECT_ID/personal-gemini-journal
   ```

2. **Create a dedicated runtime service account** (least privilege — only
   what the app needs, per the Phase 1 security constitution):
   ```bash
   gcloud iam service-accounts create gemini-journal-runtime
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:gemini-journal-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:gemini-journal-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/datastore.user"
   ```

3. **Deploy**, passing only the server-side, non-secret env vars — the
   Gemini key itself is never passed here, it's fetched from Secret Manager
   at runtime by `lib/secrets.ts`:
   ```bash
   gcloud run deploy personal-gemini-journal \
     --image gcr.io/YOUR_PROJECT_ID/personal-gemini-journal \
     --service-account gemini-journal-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com \
     --set-env-vars GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GEMINI_SECRET_NAME=gemini-api-key,FIREBASE_ADMIN_PROJECT_ID=...,FIREBASE_ADMIN_CLIENT_EMAIL=... \
     --set-secrets FIREBASE_ADMIN_PRIVATE_KEY=firebase-admin-key:latest \
     --allow-unauthenticated \
     --region YOUR_REGION
   ```
   (`--allow-unauthenticated` makes the *URL* public, as required for
   submission — the app's own Firebase Auth login still gates access to any
   actual journal data.)

4. Grab the public Cloud Run URL from the deploy output — that's your
   **Deployment Link** for submission.

5. **Apply the mandatory challenge verification label** — without this,
   the submission may not register with automated judging even if the app
   works correctly:
   ```bash
   gcloud run services update personal-gemini-journal \
     --update-labels=dev-tutorial=cloud-run-ai-challenge \
     --region=YOUR_REGION
   ```

## Submission checklist (per the ideathon's mandatory rules)

- [ ] Deployed, publicly accessible Cloud Run URL
- [ ] **Cloud Run label applied**: `dev-tutorial=cloud-run-ai-challenge`
      (required for automated verification — easy to forget)
- [ ] Public GitHub repo link (with this README committed)
- [ ] Demo post (LinkedIn/X/etc.) with hashtag **#AccelerateAIwithCloudRun**
- [ ] Brief description explicitly naming Firebase, Firestore, Cloud Run,
      and Gemini/AI Studio usage (see `SUBMISSION.md` for a ready-to-adapt
      version)


## Data model

```
users/{uid}/entries/{entryId}
  createdAt: Timestamp
  transcript: { role: 'user' | 'model', text: string }[]
  summary: string
  mood: string
  themes: string[]
  embedding: number[]   // for semantic recall (Phase 3)
```

Every read and write is scoped to `users/{uid}/...` where `uid` comes only
from the verified ID token — never from the client request body.

## Notes on the "beyond spec" features (Phase 3)

1. **Auto mood + theme tagging** — Gemini classifies the entry so the
   journal list can show a quiet mood indicator over time instead of a wall
   of undifferentiated text.
2. **Semantic recall** — `/api/entries?similarTo=...` embeds the query and
   compares it (cosine similarity) against stored entry embeddings to find
   "you wrote something like this before," which plain keyword search can't
   do (e.g. searching "burned out" can surface an entry that said "running
   on empty" without sharing a word).
3. **Ask Your Journal (RAG)** — `/api/ask` is a small but complete
   retrieval-augmented-generation pipeline:
   - Embed the user's question.
   - Retrieve the top-K most similar past entries from *that user's own*
     Firestore subtree only (isolation holds even for retrieval).
   - Pass just those retrieved summaries — not the whole journal history —
     into the prompt as grounding context.
   - Ask Gemini to answer strictly from that context, cite entries by date,
     and admit when the context doesn't cover the question.
   This is what separates it from "a chatbot with a database": the answer
   is provably grounded in the user's own retrieved data, with sources
   shown in the UI under "Drawn from."
