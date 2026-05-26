// lib/workflow/match.ts — Stage 2: Target Matching

import { FilingRecord } from "./ingest";
import { SeedContact, LIVE_SEEDS } from "../seeds";
import { query } from "../db";

export interface MatchedOutreach {
  filing: FilingRecord;
  seed: SeedContact;
  seedId: string;
  matchedBy: "cik" | "name";
}

/**
 * Match a list of new filings against live seed contacts.
 * Only returns matches where live_enabled = true and email exists.
 */
export async function matchFilingsToSeeds(
  filings: FilingRecord[]
): Promise<MatchedOutreach[]> {
  if (!filings.length) {
    console.log("[match] No filings to match.");
    return [];
  }

  // Load live seeds from DB (source of truth after seed-db.ts runs)
  const dbSeeds = await query<{
    seed_id: string;
    target_company: string;
    target_context: string | null;
    contact_person: string | null;
    title: string | null;
    email: string;
    phone: string | null;
    filing_link: string | null;
    contact_source_link: string | null;
    likely_paper: string | null;
    best_angle: string | null;
    live_enabled: boolean;
    issuer_cik: string | null;
    notes: string | null;
  }>(
    `SELECT seed_id, target_company, target_context, contact_person, title, email, phone, 
            filing_link, contact_source_link, likely_paper, best_angle, live_enabled, issuer_cik, notes
     FROM outreach_seed_watchlist WHERE live_enabled = true AND email IS NOT NULL`
  );

  const matches: MatchedOutreach[] = [];
  const seen = new Set<string>(); // dedupe: filing.id + seed.seed_id

  for (const filing of filings) {
    for (const dbSeed of dbSeeds) {
      // Find the in-memory seed config for email templates as fallback/reference if available
      const staticSeed = LIVE_SEEDS.find(
        (s) =>
          s.target_company === dbSeed.target_company &&
          s.email === dbSeed.email
      );

      // Build the SeedContact config using DB fields, falling back to staticSeed or defaults
      const seedConfig: SeedContact = {
        target_company: dbSeed.target_company,
        target_context: dbSeed.target_context || staticSeed?.target_context || "Form 144 / Insider transaction seller",
        contact_person: dbSeed.contact_person || staticSeed?.contact_person || "Investor Relations",
        title: dbSeed.title || staticSeed?.title || "Investor Relations",
        email: dbSeed.email,
        phone: dbSeed.phone || staticSeed?.phone || "unknown",
        filing_link: dbSeed.filing_link || staticSeed?.filing_link || "",
        contact_source_link: dbSeed.contact_source_link || staticSeed?.contact_source_link || "",
        likely_paper: dbSeed.likely_paper || staticSeed?.likely_paper || "Rule 144 restricted stock / block position",
        best_angle: dbSeed.best_angle || staticSeed?.best_angle || "Inquiry regarding potential block sale or capital structure optimization",
        live_enabled: dbSeed.live_enabled,
        issuer_cik: dbSeed.issuer_cik || staticSeed?.issuer_cik || "",
        issuer_name_patterns: staticSeed?.issuer_name_patterns || [dbSeed.target_company.toLowerCase()],
        notes: dbSeed.notes || staticSeed?.notes || undefined,
      };

      const key = `${filing.id}::${dbSeed.seed_id}`;
      if (seen.has(key)) continue;

      // Match by CIK (preferred — exact)
      if (
        dbSeed.issuer_cik &&
        filing.issuerCik &&
        dbSeed.issuer_cik === filing.issuerCik
      ) {
        seen.add(key);
        matches.push({
          filing,
          seed: seedConfig,
          seedId: dbSeed.seed_id,
          matchedBy: "cik",
        });
        continue;
      }

      // Fallback: issuer name pattern match
      const issuerLower = filing.issuerName.toLowerCase();
      const nameMatch = seedConfig.issuer_name_patterns.some((p) =>
        issuerLower.includes(p.toLowerCase())
      );
      if (nameMatch) {
        seen.add(key);
        matches.push({
          filing,
          seed: seedConfig,
          seedId: dbSeed.seed_id,
          matchedBy: "name",
        });
      }
    }
  }

  console.log(`[match] ${matches.length} target matches found across ${filings.length} filings`);
  return matches;
}
