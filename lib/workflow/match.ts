import { FilingRecord } from "./ingest";
import { SeedContact, LIVE_SEEDS } from "../seeds";
import { query } from "../db";
import { isGenericEmail } from "../email-validator";

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
  const rawDbSeeds = await query<{
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

  const dbSeeds = rawDbSeeds.filter(s => !isGenericEmail(s.email));


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

      // ── Insider personalization ──────────────────────────────────
      // If the filing has a real insider name from the SEC document,
      // override the generic "Investor Relations" placeholder so emails
      // are addressed to an actual person.
      // Guard: only use insiderName if it's a real person, not a company.
      const insiderIsRealPerson = isRealPersonName(filing.insiderName, filing.issuerName);
      if (insiderIsRealPerson) {
        const isGenericPerson =
          seedConfig.contact_person === "Investor Relations" ||
          seedConfig.contact_person.toLowerCase().includes("ir desk");
        if (isGenericPerson) {
          seedConfig.contact_person = filing.insiderName!.trim();
          seedConfig.title = "Filing Contact / Insider";
          console.log(`[match] 🎯 Personalized contact: "${seedConfig.contact_person}" (was generic)`);
        }
      }
      if (filing.insiderPhone && filing.insiderPhone.trim().length > 0) {
        if (seedConfig.phone === "unknown" || !seedConfig.phone) {
          seedConfig.phone = filing.insiderPhone.trim();
        }
      }

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

/**
 * Determine if an insider name is a real person vs. a company/entity name.
 * Returns true only if the name looks like a human being.
 */
export function isRealPersonName(insiderName: string | null, issuerName: string): boolean {
  if (!insiderName || insiderName.trim().length === 0) return false;
  const name = insiderName.trim();

  // If the insider name matches the issuer/company name, it's not a person
  if (name.toLowerCase() === issuerName.toLowerCase()) return false;

  // Check for corporate suffixes that indicate an entity
  const entityPatterns = [
    /\b(inc|corp|co|ltd|llc|lp|plc|holdings|group|trust|fund|capital|partners|ventures|gmbh|s\.a\.|n\.v\.|ag)\b/i,
    /\b(bank|association|foundation|committee|council)\b/i,
  ];
  for (const pat of entityPatterns) {
    if (pat.test(name)) return false;
  }

  // A person's name should have at least 2 tokens (first + last)
  const tokens = name.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length < 2) return false;

  return true;
}
