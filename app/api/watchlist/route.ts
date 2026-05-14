// app/api/watchlist/route.ts

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await query(
      `SELECT seed_id, target_company, target_context, contact_person, title, 
              email, phone, filing_link, contact_source_link, likely_paper, 
              best_angle, live_enabled, issuer_cik, notes, created_at, updated_at
       FROM outreach_seed_watchlist
       ORDER BY live_enabled DESC, target_company`
    );
    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
