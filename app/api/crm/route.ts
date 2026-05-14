// app/api/crm/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");
  const status = req.nextUrl.searchParams.get("status");

  try {
    const whereClause = status ? `WHERE reply_status = $2` : "";
    const params = status ? [limit, status] : [limit];
    const sql = `
      SELECT outreach_id, seed_id, target_company, contact_person, title, email, 
             issuer_name, ticker, filing_date, form_type, score, email_subject, 
             sent_at, gmail_thread_id, delivery_status, reply_status, replied_at, 
             followup_due_at, last_action, notes, outreach_angle
      FROM outreach_crm
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT $1
    `;
    const rows = await query(sql, params);
    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
