// lib/gmail/sender.ts — Gmail API email sender

import { google } from "googleapis";
import { getOAuth2Client, checkSendAsAlias } from "./auth";

const SEND_AS_EMAIL = process.env.SEND_AS_EMAIL ?? "ricomiller@icloud.com";
const BCC_EMAIL = process.env.BCC_EMAIL ?? "ricomiller@icloud.com";
const GMAIL_LABEL = process.env.GMAIL_LABEL ?? "AntiGravity/Filings-Outreach";
const MAX_EMAILS_PER_RUN = 10;
const MIN_DELAY_MS = 60 * 1000; // 60 seconds between sends

let emailsSentThisRun = 0;
let lastSentAt = 0;

export interface SendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

export function resetRunCounter() {
  emailsSentThisRun = 0;
  lastSentAt = 0;
}

/**
 * Validate that Gmail auth + send-as alias are ready.
 * Returns a blocking error message if not ready, or null if OK.
 */
export async function validateSendReadiness(): Promise<string | null> {
  const alias = await checkSendAsAlias(SEND_AS_EMAIL);

  if (alias.error) {
    return (
      `Gmail authentication failed: ${alias.error}\n\n` +
      `FIX REQUIRED:\n` +
      `1. Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN are set.\n` +
      `2. Run: npx tsx scripts/setup-gmail.ts\n` +
      `3. Add the printed GOOGLE_REFRESH_TOKEN to your .env and Vercel env vars.`
    );
  }

  if (!alias.found) {
    const aliasListStr =
      alias.allAliases.length > 0
        ? `\n   Configured aliases: ${alias.allAliases.join(", ")}`
        : "\n   No send-as aliases found.";

    return (
      `BLOCKING: ${SEND_AS_EMAIL} is NOT configured as a "Send mail as" alias in Gmail.\n${aliasListStr}\n\n` +
      `FIX REQUIRED:\n` +
      `1. Open Gmail → Settings (gear) → See all settings → Accounts and Import\n` +
      `2. Under "Send mail as", click "Add another email address"\n` +
      `3. Enter: ${SEND_AS_EMAIL}\n` +
      `4. Choose "Send through Gmail" (or configure SMTP if required)\n` +
      `5. Complete the verification email confirmation\n` +
      `6. Re-run the daily workflow`
    );
  }

  if (!alias.verified) {
    return (
      `BLOCKING: ${SEND_AS_EMAIL} alias found but NOT verified in Gmail.\n\n` +
      `FIX REQUIRED:\n` +
      `1. Check ${SEND_AS_EMAIL} for a Gmail verification email\n` +
      `2. Click the confirmation link\n` +
      `3. Re-run the daily workflow`
    );
  }

  return null; // All good
}

/**
 * Send a single email via Gmail API using the verified send-as identity.
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  body: string;
  isTest?: boolean;
}): Promise<SendResult> {
  if (emailsSentThisRun >= MAX_EMAILS_PER_RUN) {
    return { success: false, error: `Rate limit: max ${MAX_EMAILS_PER_RUN} emails per run` };
  }

  // Enforce minimum delay between sends
  const now = Date.now();
  const elapsed = now - lastSentAt;
  if (lastSentAt > 0 && elapsed < MIN_DELAY_MS) {
    const wait = MIN_DELAY_MS - elapsed;
    console.log(`[sender] Waiting ${Math.ceil(wait / 1000)}s before next send...`);
    await new Promise((r) => setTimeout(r, wait));
  }

  try {
    const auth = getOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth });

    // Build RFC 2822 MIME message
    const fromHeader = `Rico Miller <${SEND_AS_EMAIL}>`;
    const bccHeader = BCC_EMAIL !== params.to ? `Bcc: ${BCC_EMAIL}\r\n` : "";

    const rawMessage = [
      `From: ${fromHeader}`,
      `To: ${params.to}`,
      `Subject: ${params.isTest ? "[TEST] " : ""}${params.subject}`,
      `${bccHeader}MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      "",
      params.body,
    ].join("\r\n");

    const encoded = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded },
    });

    const messageId = res.data.id ?? undefined;
    const threadId = res.data.threadId ?? undefined;

    // Apply label
    if (messageId) {
      await applyLabel(gmail, messageId);
    }

    emailsSentThisRun++;
    lastSentAt = Date.now();
    console.log(`[sender] ✅ Sent to ${params.to} (msg: ${messageId})`);

    return { success: true, messageId, threadId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sender] ❌ Failed to send to ${params.to}:`, message);
    return { success: false, error: message };
  }
}

async function applyLabel(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<void> {
  try {
    // Get or create the label
    const labelsRes = await gmail.users.labels.list({ userId: "me" });
    let labelId = labelsRes.data.labels?.find((l) => l.name === GMAIL_LABEL)?.id;

    if (!labelId) {
      const created = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: GMAIL_LABEL,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      labelId = created.data.id ?? undefined;
    }

    if (labelId) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: { addLabelIds: [labelId] },
      });
    }
  } catch {
    // Non-fatal — label application failure doesn't block the send
    console.warn("[sender] Could not apply Gmail label (non-fatal)");
  }
}
