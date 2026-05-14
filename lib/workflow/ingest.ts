// lib/workflow/ingest.ts — Stage 1: Filing Ingestion

export interface FilingRecord {
  id: string;
  filedAt: string;
  ticker: string | null;
  issuerName: string;
  issuerCik: string;
  score: number;
  formType: string;
  flags: string[];
  filingUrl: string;
  hasAgedDebt: boolean;
  hasRestricted: boolean;
  has3a10: boolean;
}

const FILINGS_API = process.env.FILINGS_API_URL ?? "https://edgar-insider-scout.vercel.app/api/filings";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

async function fetchWithRetry(url: string, attempt = 1): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FilingsOutreachBot/1.0 (ricomiller@icloud.com)" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    console.warn(`[ingest] Attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS / 1000}s...`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
    return fetchWithRetry(url, attempt + 1);
  }
}

/**
 * Fetch filings from the edgar-insider-scout API.
 * Returns all filings from the last 24 hours (or since lastRunAt if provided).
 */
export async function ingestFilings(lastRunAt?: Date): Promise<FilingRecord[]> {
  console.log("[ingest] Fetching filings from API...");

  // Fetch up to 100 recent filings
  const url = `${FILINGS_API}?limit=100`;
  const res = await fetchWithRetry(url);
  const json = await res.json();

  const raw: Record<string, unknown>[] = json.data ?? [];

  // Filter to filings newer than lastRunAt (or last 48 hours as fallback)
  const cutoff = lastRunAt ?? new Date(Date.now() - 48 * 60 * 60 * 1000);

  const filings: FilingRecord[] = raw
    .filter((f) => {
      const filedAt = new Date(f.filedAt as string);
      return filedAt >= cutoff;
    })
    .map((f) => ({
      id: String(f.id ?? ""),
      filedAt: String(f.filedAt ?? ""),
      ticker: (f.Issuer as Record<string, unknown>)?.ticker as string | null ?? null,
      issuerName: ((f.Issuer as Record<string, unknown>)?.name as string) ?? "",
      issuerCik: (((f.Issuer as Record<string, unknown>)?.cik as string) ?? "").padStart(10, "0"),
      score: Number(f.score ?? 0),
      formType: String(f.formType ?? ""),
      flags: buildFlags(f),
      filingUrl: String(f.primaryDocUrl ?? f.rawHtmlUrl ?? ""),
      hasAgedDebt: Boolean(f.hasAgedDebt),
      hasRestricted: Boolean(f.hasRestricted),
      has3a10: Boolean(f.has3a10),
    }));

  console.log(`[ingest] Found ${filings.length} new filings since ${cutoff.toISOString()}`);
  return filings;
}

function buildFlags(f: Record<string, unknown>): string[] {
  const flags: string[] = [];
  if (f.hasAgedDebt) flags.push("aged_debt");
  if (f.hasRestricted) flags.push("restricted_shares");
  if (f.has3a10) flags.push("3a10");
  if (Number(f.score) >= 80) flags.push("high_score");
  return flags;
}
