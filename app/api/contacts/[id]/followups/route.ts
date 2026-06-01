// app/api/contacts/[id]/followups/route.ts

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { nextFollowUpDate, nextFollowUpAction } = body;

    if (!nextFollowUpDate) {
      return NextResponse.json({ error: "nextFollowUpDate is required" }, { status: 400 });
    }

    const current = await queryOne(`SELECT id FROM crm_contacts WHERE id = $1`, [id]);
    if (!current) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const sql = `
      UPDATE crm_contacts SET
        next_follow_up_date = $1,
        next_follow_up_action = $2,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    const updated = await queryOne(sql, [
      nextFollowUpDate,
      nextFollowUpAction || null,
      id
    ]);

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
