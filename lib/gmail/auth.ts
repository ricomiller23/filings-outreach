// lib/gmail/auth.ts — Gmail OAuth2 client

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

let _client: OAuth2Client | null = null;

export function getOAuth2Client(): OAuth2Client {
  if (_client) return _client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. " +
        "Set these in your .env or Vercel environment variables."
    );
  }

  _client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:4321/oauth2callback"
  );

  if (refreshToken) {
    _client.setCredentials({ refresh_token: refreshToken });
  }

  return _client;
}

export function isAuthConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN
  );
}

/**
 * Check if the authorized Gmail account has ricomiller@icloud.com configured
 * as a verified "Send mail as" alias.
 */
export async function checkSendAsAlias(targetEmail: string): Promise<{
  found: boolean;
  verified: boolean;
  allAliases: string[];
  error?: string;
}> {
  try {
    const auth = getOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth });
    const res = await gmail.users.settings.sendAs.list({ userId: "me" });
    const aliases = res.data.sendAs ?? [];
    const allAliases = aliases.map((a) => a.sendAsEmail ?? "");
    const match = aliases.find(
      (a) => a.sendAsEmail?.toLowerCase() === targetEmail.toLowerCase()
    );
    // The Gmail API returns verificationStatus as a string field
    const matchAny = match as Record<string, unknown> | undefined;
    const verified =
      matchAny?.verificationStatus === "accepted" ||
      matchAny?.isVerified === true ||
      matchAny?.isPrimary === true;
    return {
      found: !!match,
      verified,
      allAliases,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { found: false, verified: false, allAliases: [], error: message };
  }
}
