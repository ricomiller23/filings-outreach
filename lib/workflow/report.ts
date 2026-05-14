// lib/workflow/report.ts — Stage 7: Daily Summary Email

import { sendEmail } from "../gmail/sender";
import { query } from "../db";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "ricomiller@icloud.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://filings-outreach.vercel.app";

export interface RunSummary {
  runId: string;
  filingsScanned: number;
  matchedTargets: number;
  emailsSent: number;
  suppressedDupes: number;
  bounces: number;
  authErrors?: string;
  sendErrors?: string;
  status: string;
  sentEmails?: Array<{
    to: string;
    company: string;
    subject: string;
    issuer: string;
  }>;
}

export async function sendDailyReport(summary: RunSummary): Promise<void> {
  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const subject = `Filings Outreach Report — ${date} [${summary.emailsSent} sent]`;

  const sentList =
    summary.sentEmails && summary.sentEmails.length > 0
      ? summary.sentEmails
          .map(
            (e, i) =>
              `  ${i + 1}. ${e.company} → ${e.to}\n     Subject: ${e.subject}\n     Issuer: ${e.issuer}`
          )
          .join("\n")
      : "  (none)";

  const body = `Daily Filings Outreach Report
${date}
${"─".repeat(50)}

SUMMARY
  Filings scanned:     ${summary.filingsScanned}
  Matched targets:     ${summary.matchedTargets}
  Emails sent:         ${summary.emailsSent}
  Suppressed (dupes):  ${summary.suppressedDupes}
  Bounces:             ${summary.bounces}
  Run status:          ${summary.status.toUpperCase()}

EMAILS SENT THIS RUN
${sentList}

${summary.authErrors ? `AUTH ISSUES\n${summary.authErrors}\n` : ""}
${summary.sendErrors ? `SEND ERRORS\n${summary.sendErrors}\n` : ""}

LINKS
  CRM Dashboard:  ${APP_URL}/dashboard
  Outreach Log:   ${APP_URL}/dashboard?view=log

${"─".repeat(50)}
Rico Miller
ricomiller@icloud.com
`;

  try {
    await sendEmail({
      to: OWNER_EMAIL,
      subject,
      body,
    });
    console.log("[report] Daily summary sent to", OWNER_EMAIL);
  } catch (err) {
    console.error("[report] Failed to send daily report:", err);
  }
}

export async function getRecentOutreach(limit = 20) {
  return query(
    `SELECT outreach_id, target_company, contact_person, email, issuer_name, 
            filing_date, form_type, email_subject, sent_at, reply_status, delivery_status
     FROM outreach_crm
     ORDER BY sent_at DESC
     LIMIT $1`,
    [limit]
  );
}
