// app/api/run-log/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20");
  try {
    const rows = await query(
      `SELECT run_id, run_at, filings_scanned, matched_targets, emails_sent, 
              suppressed_dupes, bounces, auth_errors, send_errors, status, 
              completed_at, notes
       FROM outreach_run_log
       ORDER BY run_at DESC
       LIMIT $1`,
      [limit]
    );
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
