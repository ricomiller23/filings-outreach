import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { isGenericEmail } from "@/lib/email-validator";

export const dynamic = "force-dynamic";

// GET /api/research — List all pending research items
export async function GET() {
  try {
    const rows = await query(
      `SELECT queue_id, issuer_cik, issuer_name, ticker, form_type, 
              filing_date, likely_contact_person, likely_paper, 
              filing_url, notes, status, created_at, last_seen_at, whalewisdom_stock_id
       FROM outreach_research_queue
       WHERE status = 'needs_research'
       ORDER BY last_seen_at DESC, created_at DESC`
    );
    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/research — Promote a researched company to a live seed in the watchlist
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      queue_id,
      target_company,
      contact_person,
      email,
      phone,
      likely_paper,
      best_angle,
      notes,
      issuer_cik,
      whalewisdom_stock_id,
    } = body;

    // Validate required fields
    if (!target_company || !email) {
      return NextResponse.json(
        { error: "target_company and email are required to create a seed watchlist contact." },
        { status: 400 }
      );
    }

    if (isGenericEmail(email)) {
      return NextResponse.json(
        { error: "Emails to generic/role-based addresses (like ir@, info@, contact@) are not allowed." },
        { status: 400 }
      );
    }

    if (!queue_id) {
      return NextResponse.json({ error: "Missing queue_id to resolve." }, { status: 400 });
    }

    // 1. Insert seed contact into outreach_seed_watchlist
    // Use target_company and email uniqueness constraint to handle conflicts (ON CONFLICT DO UPDATE)
    const seedResult = await queryOne<{ seed_id: string }>(
      `INSERT INTO outreach_seed_watchlist (
         target_company, target_context, contact_person, title, email, phone,
         filing_link, contact_source_link, likely_paper, best_angle,
         live_enabled, issuer_cik, whalewisdom_stock_id, notes, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13, now())
       ON CONFLICT (target_company, email) DO UPDATE SET
         contact_person = EXCLUDED.contact_person,
         phone = EXCLUDED.phone,
         likely_paper = EXCLUDED.likely_paper,
         best_angle = EXCLUDED.best_angle,
         live_enabled = true,
         issuer_cik = EXCLUDED.issuer_cik,
         whalewisdom_stock_id = EXCLUDED.whalewisdom_stock_id,
         notes = COALESCE(outreach_seed_watchlist.notes || ' | ', '') || EXCLUDED.notes,
         updated_at = now()
       RETURNING seed_id`,
      [
        target_company,
        `Researched from filing for ${target_company}`,
        contact_person || "Investor Relations",
        "Investor Relations",
        email.trim(),
        phone || "unknown",
        null, // filing_link
        null, // contact_source_link
        likely_paper || "OTC company paper",
        best_angle || "Inquiry regarding potential block sale or capital structure optimization",
        issuer_cik || null,
        whalewisdom_stock_id || null,
        notes || "Promoted from manual research queue.",
      ]
    );

    const newSeedId = seedResult?.seed_id;
    if (!newSeedId) {
      throw new Error("Failed to insert or update seed watchlist record.");
    }

    // 2. Mark the research queue item as resolved
    await query(
      `UPDATE outreach_research_queue
       SET status = 'researched',
           resolved_seed_id = $1,
           whalewisdom_stock_id = COALESCE(whalewisdom_stock_id, $2)
       WHERE queue_id = $3`,
      [newSeedId, whalewisdom_stock_id || null, queue_id]
    );

    console.log(`[research-queue] Successfully promoted ${target_company} (CIK: ${issuer_cik}) to watchlist. Seed ID: ${newSeedId}`);
    return NextResponse.json({ success: true, seed_id: newSeedId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[research-queue] Promotion failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
