// app/api/contacts/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const contact = await queryOne(
      `SELECT * FROM crm_contacts WHERE id = $1`,
      [id]
    );

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ data: contact });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const {
      contactName,
      title,
      company,
      email,
      phone,
      source,
      isIndividual,
      isDecisionMaker,
      influenceLevel,
      securityType,
      positionSize,
      estimatedValue,
      securityDescription,
      status,
      priority,
      dealValue,
      closeProbability,
      expectedCloseDate,
      actualCloseDate,
      notes,
      tags,
      followUpSequence,
      automationEnabled
    } = body;

    const current = await queryOne(`SELECT * FROM crm_contacts WHERE id = $1`, [id]);
    if (!current) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const sql = `
      UPDATE crm_contacts SET
        contact_name = COALESCE($1, contact_name),
        title = COALESCE($2, title),
        company = COALESCE($3, company),
        email = COALESCE($4, email),
        phone = COALESCE($5, phone),
        source = COALESCE($6, source),
        is_individual = COALESCE($7, is_individual),
        is_decision_maker = COALESCE($8, is_decision_maker),
        influence_level = COALESCE($9, influence_level),
        security_type = COALESCE($10, security_type),
        position_size = COALESCE($11, position_size),
        estimated_value = COALESCE($12, estimated_value),
        security_description = COALESCE($13, security_description),
        status = COALESCE($14, status),
        priority = COALESCE($15, priority),
        deal_value = COALESCE($16, deal_value),
        close_probability = COALESCE($17, close_probability),
        expected_close_date = COALESCE($18, expected_close_date),
        actual_close_date = COALESCE($19, actual_close_date),
        notes = COALESCE($20, notes),
        tags = COALESCE($21, tags),
        follow_up_sequence = COALESCE($22, follow_up_sequence),
        automation_enabled = COALESCE($23, automation_enabled),
        updated_at = NOW()
      WHERE id = $24
      RETURNING *
    `;

    const updated = await queryOne(sql, [
      contactName !== undefined ? contactName : null,
      title !== undefined ? title : null,
      company !== undefined ? company : null,
      email !== undefined ? email : null,
      phone !== undefined ? phone : null,
      source !== undefined ? source : null,
      isIndividual !== undefined ? isIndividual : null,
      isDecisionMaker !== undefined ? isDecisionMaker : null,
      influenceLevel !== undefined ? influenceLevel : null,
      securityType !== undefined ? securityType : null,
      positionSize !== undefined ? positionSize : null,
      estimatedValue !== undefined ? estimatedValue : null,
      securityDescription !== undefined ? securityDescription : null,
      status !== undefined ? status : null,
      priority !== undefined ? priority : null,
      dealValue !== undefined ? dealValue : null,
      closeProbability !== undefined ? closeProbability : null,
      expectedCloseDate !== undefined ? expectedCloseDate : null,
      actualCloseDate !== undefined ? actualCloseDate : null,
      notes !== undefined ? notes : null,
      tags !== undefined ? tags : null,
      followUpSequence !== undefined ? followUpSequence : null,
      automationEnabled !== undefined ? automationEnabled : null,
      id
    ]);

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const current = await queryOne(`SELECT id FROM crm_contacts WHERE id = $1`, [id]);
    if (!current) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    await queryOne(`DELETE FROM crm_contacts WHERE id = $1`, [id]);
    return NextResponse.json({ success: true, message: "Contact deleted successfully" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
