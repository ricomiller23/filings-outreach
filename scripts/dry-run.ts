// scripts/dry-run.ts
// Simulate today's workflow without sending any emails.
// Usage: npx tsx scripts/dry-run.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { ingestFilings } from "../lib/workflow/ingest";
import { matchFilingsToSeeds } from "../lib/workflow/match";
import { generateEmail } from "../lib/workflow/generate";
import { isDuplicate, isSuppressed, getLastRunAt } from "../lib/workflow/crm";

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("DRY RUN — No emails will be sent");
  console.log("═".repeat(60) + "\n");

  // Stage 1: Ingest
  const lastRunAt = await getLastRunAt();
  console.log(`[1] Last successful run: ${lastRunAt?.toISOString() ?? "never (using 48h lookback)"}`);
  const filings = await ingestFilings({ lastRunAt });
  console.log(`[1] Ingested ${filings.length} filings\n`);

  if (filings.length === 0) {
    console.log("ℹ No new filings in window. Nothing to match.");
    process.exit(0);
  }

  // Show sample filings
  console.log("SAMPLE FILINGS (first 5):");
  filings.slice(0, 5).forEach((f) => {
    console.log(`  • ${f.issuerName} (${f.ticker ?? "—"}) | CIK: ${f.issuerCik} | ${f.formType} | score: ${f.score} | ${f.filedAt.slice(0, 10)}`);
  });

  // Stage 2: Match
  console.log("\n[2] Matching against seed targets...");
  const matches = await matchFilingsToSeeds(filings);

  if (matches.length === 0) {
    console.log("ℹ No matches found. No outreach would be generated.");
    process.exit(0);
  }

  console.log(`\n✅ ${matches.length} match(es) found:\n`);

  // Stage 3–5: Generate + Dedup check
  let wouldSend = 0;
  let suppressed = 0;
  const emailPreviews: { to: string; subject: string; preview: string; suppressed: boolean; reason?: string }[] = [];

  for (const match of matches) {
    const email = generateEmail(match);
    const filingDate = new Date(match.filing.filedAt).toISOString().split("T")[0];

    const dup = await isDuplicate({ email: email.to, issuerName: match.filing.issuerName, filingDate });
    const sup = !dup && await isSuppressed({ email: email.to, issuerName: match.filing.issuerName });

    if (dup || sup) {
      suppressed++;
      emailPreviews.push({
        to: email.to,
        subject: email.subject,
        preview: email.body.split("\n")[0],
        suppressed: true,
        reason: dup ? "exact duplicate (same email+issuer+date)" : "30-day suppression window active",
      });
    } else {
      wouldSend++;
      emailPreviews.push({
        to: email.to,
        subject: email.subject,
        preview: email.body,
        suppressed: false,
      });
    }
  }

  // Output results
  emailPreviews.forEach((e, i) => {
    console.log(`\n[${ e.suppressed ? "⏭ SUPPRESSED" : "📧 WOULD SEND"}] Match ${i + 1}`);
    console.log(`  To:      ${e.to}`);
    console.log(`  Subject: ${e.subject}`);
    if (e.suppressed) {
      console.log(`  Reason:  ${e.reason}`);
    } else {
      console.log(`  Body:\n`);
      e.preview.split("\n").forEach((line) => console.log(`    ${line}`));
    }
    console.log("─".repeat(60));
  });

  console.log(`\nDRY RUN SUMMARY`);
  console.log(`  Filings scanned:   ${filings.length}`);
  console.log(`  Matches found:     ${matches.length}`);
  console.log(`  Would send:        ${wouldSend}`);
  console.log(`  Suppressed:        ${suppressed}`);
  console.log(`\nNo emails were sent. To send live, run: npx tsx scripts/live-send.ts\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Dry run failed:", e.message);
  process.exit(1);
});
