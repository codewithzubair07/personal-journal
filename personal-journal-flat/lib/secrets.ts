// Server-only. Resolves the Gemini API key from Google Cloud Secret Manager
// in production, falling back to a plain env var for local development so
// contributors aren't forced to wire up real GCP infra to run the app.
// The key is cached in-memory for the life of the server process — it is
// never written to disk, logged, or sent to the client.

import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

let cachedKey: string | null = null;
let client: SecretManagerServiceClient | null = null;

export async function getGeminiApiKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const secretName = process.env.GEMINI_SECRET_NAME || "gemini-api-key";

  if (project) {
    client ??= new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
      name: `projects/${project}/secrets/${secretName}/versions/latest`,
    });
    const value = version.payload?.data?.toString();
    if (!value) {
      throw new Error(
        `Secret Manager returned no value for ${secretName} in ${project}`
      );
    }
    cachedKey = value;
    return cachedKey;
  }

  // Local/dev fallback only — production deploys should set
  // GOOGLE_CLOUD_PROJECT so the real Secret Manager path is used.
  const devKey = process.env.GEMINI_API_KEY;
  if (!devKey) {
    throw new Error(
      "No Gemini API key available: set GOOGLE_CLOUD_PROJECT (Secret " +
        "Manager) or GEMINI_API_KEY (local dev fallback)."
    );
  }
  cachedKey = devKey;
  return cachedKey;
}
