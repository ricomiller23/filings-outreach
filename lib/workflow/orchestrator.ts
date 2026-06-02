// lib/workflow/orchestrator.ts — Main workflow orchestrator
// Runs all 7 stages in order. Used by the Vercel cron API route.

import { ingestFilings } from "./ingest";
import { query, queryOne } from "../db";
import { matchFilingsToSeeds, isRealPersonName } from "./match";
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
import { enrichResearchQueue } from "./enrich";

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

  // ─── Stage 1 & 2: Ingestion & Target Matching with Dynamic Lookback ────────
  const lastRunAt = await getLastRunAt();
  let matches: import("./match").MatchedOutreach[] = [];
  filingsScanned = 0;
  let enriched = false;
  
  // Try dynamic lookback windows to find at least 20 unsent matches:
  const lookbackTiers = [
    { name: "normal", lookbackDays: undefined, limit: 100 },
    { name: "30-day", lookbackDays: 30, limit: 500 },
    { name: "90-day", lookbackDays: 90, limit: 1000 },
    { name: "360-day", lookbackDays: 360, limit: 1000 },
  ];

  for (const tier of lookbackTiers) {
    console.log(`[workflow] Ingestion tier: ${tier.name} (limit=${tier.limit})`);
    try {
      const filings = await ingestFilings({
        lastRunAt: tier.lookbackDays ? undefined : lastRunAt,
        limit: tier.limit,
        lookbackDays: tier.lookbackDays,
      });
      filingsScanned = Math.max(filingsScanned, filings.length);
      
      await ensureSeedsForFilings(filings);

      // Automatically run web research and enrichment for pending items in the queue
      if (!enriched) {
        try {
          console.log("[workflow] Running automated research queue enrichment...");
          // Enrich up to 30 pending queue items in this run to stay within timeouts and rate limits
          const enrichResult = await enrichResearchQueue(30);
          console.log(`[workflow] Enrichment complete: enriched ${enrichResult.enrichedCount} contacts, ${enrichResult.errors.length} errors`);
          if (enrichResult.errors.length > 0) {
            errors.push(...enrichResult.errors.map(e => `Enrichment error: ${e}`));
          }
        } catch (err: any) {
          console.error("[workflow] ❌ Enrichment error:", err.message || String(err));
          errors.push(`Enrichment failed: ${err.message || String(err)}`);
        }
        enriched = true;
      }
      
      const potentialMatches = await matchFilingsToSeeds(filings);
      
      // Filter to only those that are not duplicates in outreach_crm
      const unsentMatches: import("./match").MatchedOutreach[] = [];
      for (const m of potentialMatches) {
        const generated = generateEmail(m);
        const filingDate = new Date(m.filing.filedAt).toISOString().split("T")[0];
        const dup = await isDuplicate({
          email: generated.to,
          issuerName: m.filing.issuerName,
          filingDate,
        });
        if (!dup) {
          unsentMatches.push(m);
        }
      }

      console.log(`[workflow] Tier ${tier.name}: Found ${potentialMatches.length} matches, of which ${unsentMatches.length} are unsent.`);
      
      // If we found at least 20 unsent matches, or we are on the final tier, select these matches.
      if (unsentMatches.length >= 20 || tier.name === "360-day") {
        matches = potentialMatches;
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Ingest failed on tier ${tier.name}: ${msg}`);
      console.error(`[workflow] ❌ Ingest error on tier ${tier.name}:`, msg);
    }
  }

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

// ─── IMPORTANT: No placeholder / guessed emails ────────────────────────────
// Seeds MUST have a real, researched email address for a named individual.
// We NEVER fabricate ir@ticker.com or ir@companyname.com addresses —
// those domains often don't exist and cause bounce-backs.
// New companies discovered via filings are logged to outreach_research_queue
// for manual research. Only after a real contact email is found should a seed
// be added to outreach_seed_watchlist with live_enabled = true.
// ────────────────────────────────────────────────────────────────────────────

async function ensureSeedsForFilings(filings: import("./ingest").FilingRecord[]) {
  // 1. Get all filings that meet the target criteria
  const targetFilings = filings.filter(f => f.score >= 50 || f.hasRestricted || f.hasAgedDebt);
  if (targetFilings.length === 0) return;

  const uniqueCiks = Array.from(new Set(targetFilings.map(f => f.issuerCik)));

  // 2. Fetch existing seeds AND existing research-queue entries for these CIKs
  const [existingSeeds, existingQueue] = await Promise.all([
    query<{ issuer_cik: string }>(
      `SELECT issuer_cik FROM outreach_seed_watchlist WHERE issuer_cik = ANY($1)`,
      [uniqueCiks]
    ),
    query<{ issuer_cik: string }>(
      `SELECT issuer_cik FROM outreach_research_queue WHERE issuer_cik = ANY($1)`,
      [uniqueCiks]
    ).catch(() => [] as { issuer_cik: string }[]), // table may not exist yet; non-fatal
  ]);

  const existingCiks = new Set([
    ...existingSeeds.map(s => s.issuer_cik),
    ...existingQueue.map(s => s.issuer_cik),
  ]);

  // 3. For any CIK not already known, add to research queue — NEVER create a
  //    seed with a guessed/fabricated email address.
  for (const filing of targetFilings) {
    if (existingCiks.has(filing.issuerCik)) continue;

    const insiderIsRealPerson = isRealPersonName(filing.insiderName, filing.issuerName);
    const contactPerson = insiderIsRealPerson
      ? filing.insiderName!.trim()
      : null; // unknown until researched

    console.log(
      `[workflow] 🔎 New company needs research before outreach: ${filing.issuerName} (CIK: ${filing.issuerCik})` +
      (contactPerson ? ` — likely contact: ${contactPerson}` : "")
    );

    // Log to research queue so the dashboard can surface it for manual follow-up.
    // live_enabled stays false until a real email is confirmed.
    await query(
      `INSERT INTO outreach_research_queue
         (issuer_cik, issuer_name, ticker, form_type, filing_date,
          likely_contact_person, likely_paper, filing_url, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (issuer_cik) DO UPDATE SET
         last_seen_at = now(),
         filing_date = EXCLUDED.filing_date,
         form_type = EXCLUDED.form_type`,
      [
        filing.issuerCik,
        filing.issuerName,
        filing.ticker ?? null,
        filing.formType,
        new Date(filing.filedAt).toISOString().split("T")[0],
        contactPerson,
        filing.hasRestricted ? "Rule 144 restricted stock / block position" : "OTC company paper",
        filing.filingUrl ?? null,
        "Auto-detected via filing scan. Needs real contact email before outreach.",
      ]
    ).catch((err: Error) => {
      // If the outreach_research_queue table doesn't exist yet, just warn — don't crash.
      console.warn(`[workflow] Could not log to research queue (table may need migration): ${err.message}`);
    });

    existingCiks.add(filing.issuerCik);
  }
}
