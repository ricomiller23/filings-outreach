// lib/workflow/orchestrator.ts — Main workflow orchestrator
// Runs all 7 stages in order. Used by the Vercel cron API route.

import { ingestFilings } from "./ingest";
import { matchFilingsToSeeds } from "./match";
import { generateEmail } from "./generate";
import {
  isDuplicate,
  isSuppressed,
  createOutreachRecord,
  getLastRunAt,
  createRunLog,
  updateRunLog,
} from "./crm";
import {
  validateSendReadiness,
  sendEmail,
  resetRunCounter,
} from "../gmail/sender";
import { checkReplies } from "../gmail/reply-tracker";
import { sendDailyReport, RunSummary } from "./report";
import { isAuthConfigured } from "../gmail/auth";

export interface WorkflowResult {
  success: boolean;
  runId?: string;
  filingsScanned: number;
  matchedTargets: number;
  emailsSent: number;
  suppressedDupes: number;
  bounces: number;
  authBlocked?: string;
  errors: string[];
  dryRun: boolean;
}

export async function runDailyWorkflow(opts: {
  dryRun?: boolean;
  isTest?: boolean;
}): Promise<WorkflowResult> {
  const { dryRun = false, isTest = false } = opts;
  const errors: string[] = [];
  let filingsScanned = 0;
  let matchedTargets = 0;
  let emailsSent = 0;
  let suppressedDupes = 0;
  let bounces = 0;
  const sentEmailDetails: RunSummary["sentEmails"] = [];

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[workflow] Starting ${dryRun ? "DRY RUN" : "LIVE"} workflow`);
  console.log(`[workflow] ${new Date().toISOString()}`);
  console.log(`${"═".repeat(60)}\n`);

  // Create run log entry
  const runId = await createRunLog().catch(() => "unknown");

  // ─── Stage 1: Auth Gate ────────────────────────────────────────────────────
  let authError: string | undefined;
  if (!dryRun) {
    if (!isAuthConfigured()) {
      authError =
        "Gmail credentials not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in environment variables. Run: npx tsx scripts/setup-gmail.ts";
      console.error(`[workflow] ❌ AUTH BLOCKED:\n${authError}`);
      await updateRunLog(runId, {
        filingsScanned: 0,
        matchedTargets: 0,
        emailsSent: 0,
        suppressedDupes: 0,
        bounces: 0,
        authErrors: authError,
        status: "failed",
      });
      return {
        success: false,
        runId,
        filingsScanned: 0,
        matchedTargets: 0,
        emailsSent: 0,
        suppressedDupes: 0,
        bounces: 0,
        authBlocked: authError,
        errors: [authError],
        dryRun,
      };
    }

    const sendReadinessError = await validateSendReadiness();
    if (sendReadinessError) {
      authError = sendReadinessError;
      console.error(`[workflow] ❌ SEND-AS BLOCKED:\n${authError}`);
      await updateRunLog(runId, {
        filingsScanned: 0,
        matchedTargets: 0,
        emailsSent: 0,
        suppressedDupes: 0,
        bounces: 0,
        authErrors: authError,
        status: "failed",
      });
      return {
        success: false,
        runId,
        filingsScanned: 0,
        matchedTargets: 0,
        emailsSent: 0,
        suppressedDupes: 0,
        bounces: 0,
        authBlocked: authError,
        errors: [authError],
        dryRun,
      };
    }

    resetRunCounter();
  }

  // ─── Stage 1: File Ingestion ──────────────────────────────────────────────
  const lastRunAt = await getLastRunAt();
  let filings: import("./ingest").FilingRecord[] = [];
  try {
    filings = await ingestFilings(lastRunAt);
    filingsScanned = filings.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Ingest failed: ${msg}`);
    console.error("[workflow] ❌ Ingest error:", msg);
  }

  // ─── Stage 2: Target Matching ─────────────────────────────────────────────
  const matches = filingsScanned > 0 ? await matchFilingsToSeeds(filings) : [];
  matchedTargets = matches.length;

  for (const match of matches) {
    const generated = generateEmail(match);

    const filingDate = new Date(match.filing.filedAt).toISOString().split("T")[0];

    // Duplicate check
    const dup = await isDuplicate({
      email: generated.to,
      issuerName: match.filing.issuerName,
      filingDate,
    });
    if (dup) {
      console.log(`[workflow] ⏭ Skipping duplicate: ${generated.to} / ${match.filing.issuerName}`);
      suppressedDupes++;
      continue;
    }



    if (dryRun) {
      console.log(`\n[DRY RUN] Would send to: ${generated.to}`);
      console.log(`Subject: ${generated.subject}`);
      console.log(`Body:\n${generated.body}\n`);
      continue;
    }

    // Live send
    const sendResult = await sendEmail({
      to: generated.to,
      subject: generated.subject,
      body: generated.body,
      isTest,
    });

    if (sendResult.success) {
      emailsSent++;
      await createOutreachRecord(generated, sendResult, match.seedId);
      sentEmailDetails!.push({
        to: generated.to,
        company: match.seed.target_company,
        subject: generated.subject,
        issuer: match.filing.issuerName,
      });
    } else {
      errors.push(`Send failed to ${generated.to}: ${sendResult.error}`);
      if (sendResult.error?.includes("bounce") || sendResult.error?.includes("invalid")) {
        bounces++;
      }
    }
  }

  // ─── Stage 6: Check Replies ───────────────────────────────────────────────
  if (!dryRun) {
    try {
      const replies = await checkReplies();
      const replyBounces = replies.filter((r) => r.classification === "bad_email").length;
      bounces += replyBounces;
      console.log(`[workflow] Reply check: ${replies.filter((r) => r.hasReply).length} replies found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("[workflow] Reply check failed (non-fatal):", msg);
    }
  }

  // ─── Stage 7: Update run log + Report ────────────────────────────────────
  const status = errors.length === 0 ? "completed" : emailsSent > 0 ? "partial" : "failed";
  await updateRunLog(runId, {
    filingsScanned,
    matchedTargets,
    emailsSent,
    suppressedDupes,
    bounces,
    sendErrors: errors.length ? errors.join("\n") : undefined,
    status,
  });

  if (!dryRun && emailsSent >= 0) {
    await sendDailyReport({
      runId,
      filingsScanned,
      matchedTargets,
      emailsSent,
      suppressedDupes,
      bounces,
      sendErrors: errors.length ? errors.join("\n") : undefined,
      status,
      sentEmails: sentEmailDetails,
    }).catch((e) => console.warn("[workflow] Report send failed:", e));
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[workflow] Run complete: ${emailsSent} sent, ${suppressedDupes} suppressed, ${errors.length} errors`);
  console.log(`${"═".repeat(60)}\n`);

  return {
    success: errors.length === 0 || emailsSent > 0,
    runId,
    filingsScanned,
    matchedTargets,
    emailsSent,
    suppressedDupes,
    bounces,
    errors,
    dryRun,
  };
}
