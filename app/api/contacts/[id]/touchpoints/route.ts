// app/api/contacts/[id]/touchpoints/route.ts

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
    const { date = new Date().toISOString(), type, notes, outcome } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const current = await queryOne<{ touchpoints: unknown[] }>(
      `SELECT touchpoints FROM crm_contacts WHERE id = $1`,
      [id]
    );

    if (!current) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const touchpoint = {
      date,
      type,
      notes: notes || "",
      outcome: outcome || "neutral"
    };

    const newTouchpoints = Array.isArray(current.touchpoints)
      ? [...current.touchpoints, touchpoint]
      : [touchpoint];

    const sql = `
      UPDATE crm_contacts SET
        touchpoints = $1,
        last_contact_date = $2,
        last_contact_method = $3,
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `;

    const updated = await queryOne(sql, [
      JSON.stringify(newTouchpoints),
      date,
      type,
      id
    ]);

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
