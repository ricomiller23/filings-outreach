// lib/workflow/crm.ts — Stage 5: CRM operations

import { query, queryOne } from "../db";
import { GeneratedEmail } from "./generate";
import { SendResult } from "../gmail/sender";

export interface OutreachRecord {
  outreach_id: string;
  seed_id: string;
  target_company: string;
  contact_person: string;
  email: string;
  issuer_name: string;
  ticker: string | null;
  filing_date: string;
  form_type: string;
  score: number;
  email_subject: string;
  sent_at: string;
  delivery_status: string;
  reply_status: string;
}

/**
 * Check if an outreach already exists for this contact + issuer + filing date.
 * Suppresses if sent within 30 days (unless reply requested follow-up).
 */
export async function isDuplicate(params: {
  email: string;
  issuerName: string;
  filingDate: string;
}): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM outreach_crm
     WHERE email = $1
       AND issuer_name = $2
       AND filing_date = $3::date`,
    [params.email, params.issuerName, params.filingDate]
  );
  return parseInt(row?.count ?? "0") > 0;
}

/**
 * Check 30-day suppression window (same contact + issuer, any filing date).
 */
export async function isSuppressed(params: {
  email: string;
  issuerName: string;
}): Promise<boolean> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM outreach_crm
     WHERE email = $1
       AND issuer_name = $2
       AND sent_at > NOW() - INTERVAL '30 days'
       AND reply_status NOT IN ('interested')`,
    [params.email, params.issuerName]
  );
  return parseInt(row?.count ?? "0") > 0;
}

/**
 * Write a new outreach record to outreach_crm.
 * Only called after a successful email send.
 */
export async function createOutreachRecord(
  email: GeneratedEmail,
  sendResult: SendResult,
  seedId: string
): Promise<string | null> {
  const { match } = email;
  const { filing, seed } = match;

  const filingDate = new Date(filing.filedAt).toISOString().split("T")[0];

  // followup_due_at: 7 days from now for initial cold outreach
  const followupDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const row = await queryOne<{ outreach_id: string }>(
      `INSERT INTO outreach_crm (
         seed_id, target_company, contact_person, title, email, phone,
         issuer_name, ticker, filing_date, filing_url, form_type, score, flags,
         likely_paper, outreach_angle, email_subject, email_body,
         sent_at, gmail_message_id, gmail_thread_id,
         delivery_status, reply_status, followup_due_at, owner
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14,$15,$16,$17,
         NOW(),$18,$19,'sent','awaiting',$20,'ricomiller@icloud.com'
       )
       ON CONFLICT (email, issuer_name, filing_date) DO NOTHING
       RETURNING outreach_id`,
      [
        seedId,
        seed.target_company,
        seed.contact_person,
        seed.title,
        seed.email,
        seed.phone === "unknown" ? null : seed.phone,
        filing.issuerName,
        filing.ticker,
        filingDate,
        filing.filingUrl,
        filing.formType,
        filing.score,
        `{${filing.flags.join(",")}}`,
        seed.likely_paper,
        seed.best_angle,
        email.subject,
        email.body,
        sendResult.messageId ?? null,
        sendResult.threadId ?? null,
        followupDue,
      ]
    );

    return row?.outreach_id ?? null;
  } catch (err) {
    console.error("[crm] Failed to create outreach record:", err);
    return null;
  }
}

/**
 * Get last successful run timestamp (for filtering new filings).
 */
export async function getLastRunAt(): Promise<Date | undefined> {
  const row = await queryOne<{ run_at: string }>(
    `SELECT run_at FROM outreach_run_log
     WHERE status = 'completed'
     ORDER BY run_at DESC
     LIMIT 1`
  );
  return row ? new Date(row.run_at) : undefined;
}

export async function createRunLog(): Promise<string> {
  const row = await queryOne<{ run_id: string }>(
    `INSERT INTO outreach_run_log (status) VALUES ('running') RETURNING run_id`
  );
  return row!.run_id;
}

export async function updateRunLog(
  runId: string,
  data: {
    filingsScanned: number;
    matchedTargets: number;
    emailsSent: number;
    suppressedDupes: number;
    bounces: number;
    authErrors?: string;
    sendErrors?: string;
    status: "completed" | "failed" | "partial";
  }
): Promise<void> {
  await query(
    `UPDATE outreach_run_log SET
       filings_scanned = $1,
       matched_targets = $2,
       emails_sent = $3,
       suppressed_dupes = $4,
       bounces = $5,
       auth_errors = $6,
       send_errors = $7,
       status = $8,
       completed_at = NOW()
     WHERE run_id = $9`,
    [
      data.filingsScanned,
      data.matchedTargets,
      data.emailsSent,
      data.suppressedDupes,
      data.bounces,
      data.authErrors ?? null,
      data.sendErrors ?? null,
      data.status,
      runId,
    ]
  );
}
