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
    issuer_cik: string | null;
    email: string | null;
    live_enabled: boolean;
  }>(
    `SELECT seed_id, target_company, issuer_cik, email, live_enabled
     FROM outreach_seed_watchlist WHERE live_enabled = true AND email IS NOT NULL`
  );

  const matches: MatchedOutreach[] = [];
  const seen = new Set<string>(); // dedupe: filing.id + seed.seed_id

  for (const filing of filings) {
    for (const dbSeed of dbSeeds) {
      // Find the in-memory seed config for email templates
      const seedConfig = LIVE_SEEDS.find(
        (s) =>
          s.target_company === dbSeed.target_company &&
          s.email === dbSeed.email
      );
      if (!seedConfig) continue;

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
