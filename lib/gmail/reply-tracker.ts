// lib/gmail/reply-tracker.ts — Stage 6: Monitor Gmail threads for replies

import { google } from "googleapis";
import { getOAuth2Client } from "./auth";
import { query } from "../db";

export interface ReplyStatus {
  outreachId: string;
  threadId: string;
  hasReply: boolean;
  classification: "interested" | "declined" | "bad_email" | "other" | "none";
  repliedAt?: string;
  snippet?: string;
}

/**
 * Check all open outreach threads for new replies.
 * Updates outreach_crm accordingly.
 */
export async function checkReplies(): Promise<ReplyStatus[]> {
  // Get all threads with reply_status = 'awaiting' that have a gmail_thread_id
  const openThreads = await query<{
    outreach_id: string;
    gmail_thread_id: string;
    email: string;
    sent_at: string;
  }>(
    `SELECT outreach_id, gmail_thread_id, email, sent_at
     FROM outreach_crm
     WHERE reply_status = 'awaiting'
       AND gmail_thread_id IS NOT NULL
       AND sent_at > NOW() - INTERVAL '90 days'`
  );

  if (!openThreads.length) {
    console.log("[reply-tracker] No open threads to check.");
    return [];
  }

  const auth = getOAuth2Client();
  const gmail = google.gmail({ version: "v1", auth });
  const results: ReplyStatus[] = [];

  for (const thread of openThreads) {
    try {
      const threadRes = await gmail.users.threads.get({
        userId: "me",
        id: thread.gmail_thread_id,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject", "Date"],
      });

      const messages = threadRes.data.messages ?? [];
      // More than 1 message in thread = a reply exists
      if (messages.length <= 1) {
        results.push({
          outreachId: thread.outreach_id,
          threadId: thread.gmail_thread_id,
          hasReply: false,
          classification: "none",
        });
        continue;
      }

      // Find the reply (not the sent message)
      const reply = messages.find((m) => {
        const from = m.payload?.headers?.find((h) => h.name === "From")?.value ?? "";
        return !from.toLowerCase().includes("ricomiller");
      });

      if (!reply) {
        results.push({
          outreachId: thread.outreach_id,
          threadId: thread.gmail_thread_id,
          hasReply: false,
          classification: "none",
        });
        continue;
      }

      const snippet = reply.snippet ?? "";
      const classification = classifyReply(snippet, thread.email);
      const repliedAt =
        reply.payload?.headers?.find((h) => h.name === "Date")?.value ??
        new Date().toISOString();

      // Update CRM
      await updateReplyInCRM(thread.outreach_id, classification, repliedAt, snippet);

      results.push({
        outreachId: thread.outreach_id,
        threadId: thread.gmail_thread_id,
        hasReply: true,
        classification,
        repliedAt,
        snippet,
      });

      console.log(`[reply-tracker] Reply from ${thread.email}: ${classification}`);
    } catch (err) {
      console.error(`[reply-tracker] Error checking thread ${thread.gmail_thread_id}:`, err);
    }
  }

  return results;
}

function classifyReply(
  snippet: string,
  email: string
): "interested" | "declined" | "bad_email" | "other" {
  const lower = snippet.toLowerCase();

  // Bounce / undeliverable signals
  if (
    lower.includes("delivery failure") ||
    lower.includes("undeliverable") ||
    lower.includes("does not exist") ||
    lower.includes("no such user") ||
    lower.includes("bounce") ||
    lower.includes("mailer-daemon")
  ) {
    return "bad_email";
  }

  // Declined signals
  if (
    lower.includes("not interested") ||
    lower.includes("no thank") ||
    lower.includes("please remove") ||
    lower.includes("unsubscribe") ||
    lower.includes("do not contact") ||
    lower.includes("stop emailing") ||
    lower.includes("not the right") && lower.includes("wrong")
  ) {
    return "declined";
  }

  // Interest signals
  if (
    lower.includes("interest") ||
    lower.includes("tell me more") ||
    lower.includes("call") ||
    lower.includes("schedule") ||
    lower.includes("happy to") ||
    lower.includes("let's connect") ||
    lower.includes("can we")
  ) {
    return "interested";
  }

  return "other";
}

async function updateReplyInCRM(
  outreachId: string,
  classification: string,
  repliedAt: string,
  snippet: string
): Promise<void> {
  // Calculate suppression window based on classification
  let followupDue: string | null = null;
  if (classification === "interested") {
    // Follow up within 2 days
    followupDue = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  } else if (classification === "declined") {
    // Suppress for 180 days
    followupDue = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();
  } else if (classification === "bad_email") {
    followupDue = null; // Suppress permanently via delivery_status
  }

  await query(
    `UPDATE outreach_crm SET
       reply_status = $1,
       replied_at = $2,
       followup_due_at = $3,
       delivery_status = CASE WHEN $1 = 'bad_email' THEN 'bounced' ELSE delivery_status END,
       notes = COALESCE(notes || ' | ', '') || $4,
       last_action = 'reply_received'
     WHERE outreach_id = $5`,
    [
      classification,
      repliedAt,
      followupDue,
      `Reply received (${classification}): ${snippet.slice(0, 200)}`,
      outreachId,
    ]
  );

  // If bad_email, disable the seed from live outreach
  if (classification === "bad_email") {
    await query(
      `UPDATE outreach_seed_watchlist SET live_enabled = false, notes = COALESCE(notes || ' | ', '') || $1
       WHERE email = (SELECT email FROM outreach_crm WHERE outreach_id = $2)`,
      [`Email bounced on ${new Date().toISOString()}`, outreachId]
    );
  }
}
