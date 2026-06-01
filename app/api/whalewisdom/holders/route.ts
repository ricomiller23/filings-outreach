// app/api/whalewisdom/holders/route.ts
// Retrieves and caches WhaleWisdom institutional holders for a given CIK/ticker.

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { WhaleWisdomClient, WhaleWisdomHolder } from "@/lib/whalewisdom";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cik = searchParams.get("cik");
  const ticker = searchParams.get("ticker");

  if (!cik) {
    return NextResponse.json({ error: "Missing issuer CIK (cik parameter)" }, { status: 400 });
  }

  try {
    // 1. Check local cache first (freshness: 14 days)
    const cacheRows = await query<{
      holder_name: string;
      shares: string;
      percent_ownership: string;
      change_shares: string;
      updated_at: string;
    }>(
      `SELECT holder_name, shares, percent_ownership, change_shares, updated_at
       FROM outreach_company_holders
       WHERE issuer_cik = $1
       ORDER BY percent_ownership DESC`,
      [cik]
    );

    if (cacheRows.length > 0) {
      const cacheTime = new Date(cacheRows[0].updated_at).getTime();
      const freshnessWindow = 14 * 24 * 60 * 60 * 1000; // 14 days
      const isFresh = Date.now() - cacheTime < freshnessWindow;

      if (isFresh) {
        console.log(`[whalewisdom-api] Serving holders from cache for CIK: ${cik}`);
        const data: WhaleWisdomHolder[] = cacheRows.map((r) => ({
          holder_name: r.holder_name,
          shares: Number(r.shares),
          percent_ownership: Number(r.percent_ownership),
          change_shares: Number(r.change_shares),
        }));
        return NextResponse.json({
          success: true,
          data,
          cached: true,
          configured: true,
          updated_at: cacheRows[0].updated_at,
        });
      }
    }

    // 2. Fetch fresh data
    const client = new WhaleWisdomClient();
    if (!client.isConfigured()) {
      // Return high-quality mock data with a warning if API keys are not set
      console.log(`[whalewisdom-api] API keys not set. Generating mock holders for CIK ${cik} (${ticker || 'unknown'}).`);
      const mockHolders = generateMockHolders(ticker || "COMP");
      
      return NextResponse.json({
        success: true,
        data: mockHolders,
        cached: false,
        configured: false,
        api_warning: "Showing mock demo data. Set WHALEWISDOM_SHARED_KEY and WHALEWISDOM_SECRET_KEY in env to connect to live API.",
        updated_at: new Date().toISOString(),
      });
    }

    // 3. Query the WhaleWisdom API
    let holders: WhaleWisdomHolder[] = [];
    let stockId: number | null = null;
    let apiWarning: string | undefined = undefined;
    let isMockFallback = false;

    const companyInfo = await resolveCompanyFromCik(cik);
    const targetTicker = ticker || companyInfo?.ticker;
    const targetName = companyInfo?.name || undefined;

    if (!targetTicker) {
      return NextResponse.json(
        { error: `Could not resolve ticker for CIK ${cik} to call WhaleWisdom.` },
        { status: 400 }
      );
    }

    try {
      stockId = await client.lookupStockId(targetTicker, targetName);
      if (!stockId) {
        throw new Error(`Ticker ${targetTicker} not found in WhaleWisdom database.`);
      }
      holders = await client.getHolders(stockId, 10);
    } catch (err: any) {
      console.warn(`[whalewisdom-api] WhaleWisdom API query failed, falling back to mock data:`, err.message);
      holders = generateMockHolders(targetTicker);
      isMockFallback = true;
      apiWarning = `Showing mock demo data. (Live API failed: ${err.message})`;
    }

    if (!isMockFallback && stockId) {
      // 4. Update local cache (delete old entries & insert new ones)
      await query(`DELETE FROM outreach_company_holders WHERE issuer_cik = $1`, [cik]);
      
      for (const h of holders) {
        await query(
          `INSERT INTO outreach_company_holders (issuer_cik, holder_name, shares, percent_ownership, change_shares, updated_at)
           VALUES ($1, $2, $3, $4, $5, now())
           ON CONFLICT (issuer_cik, holder_name) DO UPDATE SET
             shares = EXCLUDED.shares,
             percent_ownership = EXCLUDED.percent_ownership,
             change_shares = EXCLUDED.change_shares,
             updated_at = now()`,
          [cik, h.holder_name, h.shares, h.percent_ownership, h.change_shares]
        );
      }

      // Save stock ID in related tables
      await query(`UPDATE outreach_research_queue SET whalewisdom_stock_id = $1 WHERE issuer_cik = $2`, [stockId, cik]);
      await query(`UPDATE outreach_seed_watchlist SET whalewisdom_stock_id = $1 WHERE issuer_cik = $2`, [stockId, cik]);
    }

    console.log(`[whalewisdom-api] Returning ${holders.length} holders for CIK: ${cik} (mock=${isMockFallback})`);
    return NextResponse.json({
      success: true,
      data: holders,
      cached: false,
      configured: true,
      whalewisdom_stock_id: stockId,
      api_warning: apiWarning,
      updated_at: new Date().toISOString(),
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[whalewisdom-api] Fatal Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Helper to lookup ticker and name in database by CIK
 */
async function resolveCompanyFromCik(cik: string): Promise<{ ticker: string | null; name: string | null } | null> {
  const result = await query<{ ticker: string | null; name: string | null }>(
    `SELECT ticker, issuer_name as name FROM outreach_research_queue WHERE issuer_cik = $1
     UNION
     SELECT issuer_cik as ticker, target_company as name FROM outreach_seed_watchlist WHERE issuer_cik = $1
     LIMIT 1`,
    [cik]
  );
  return result[0] ?? null;
}

/**
 * Generate high-quality mock data for demo mode
 */
function generateMockHolders(ticker: string): WhaleWisdomHolder[] {
  const cleanTicker = ticker.toUpperCase().trim();
  const baseHolders = [
    { name: "Vanguard Group Inc", basePct: 8.4 },
    { name: "BlackRock Inc", basePct: 6.2 },
    { name: "Dimensional Fund Advisors LP", basePct: 4.5 },
    { name: "Geode Capital Management LLC", basePct: 2.1 },
    { name: "Renaissance Technologies LLC", basePct: 1.8 },
    { name: "State Street Corp", basePct: 1.5 },
    { name: "Citadel Advisors LLC", basePct: 1.1 },
    { name: "Millennium Management LLC", basePct: 0.9 },
  ];

  // Introduce small randomness based on ticker hash to keep it consistent for the same ticker
  let seed = 0;
  for (let i = 0; i < cleanTicker.length; i++) {
    seed += cleanTicker.charCodeAt(i);
  }

  return baseHolders.map((h, index) => {
    const factor = 0.8 + ((seed + index) % 5) * 0.1; // 0.8 to 1.2
    const percent = Math.round(h.basePct * factor * 100) / 100;
    
    // Distribute total shares based on percent and arbitrary stock price
    const totalCompanyShares = 50_000_000 + (seed % 10) * 10_000_000;
    const shares = Math.round(totalCompanyShares * (percent / 100));
    
    const changeDirection = (seed + index) % 3 === 0 ? -1 : (seed + index) % 3 === 1 ? 1 : 0;
    const changePct = 0.05 + ((seed * index) % 10) * 0.03; // 5% to 35%
    const change_shares = changeDirection * Math.round(shares * changePct);

    return {
      holder_name: h.name,
      shares,
      percent_ownership: percent,
      change_shares,
    };
  });
}
