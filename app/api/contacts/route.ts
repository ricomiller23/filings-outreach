// app/api/contacts/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status");
    const securityType = searchParams.get("securityType");
    const source = searchParams.get("source");
    const isIndividual = searchParams.get("isIndividual");
    const sortBy = searchParams.get("sortBy") || "created_at";
    const sortOrder = searchParams.get("sortOrder") || "DESC";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(contact_name ILIKE $${paramIndex} OR company ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (securityType) {
      conditions.push(`security_type = $${paramIndex}`);
      params.push(securityType);
      paramIndex++;
    }

    if (source) {
      conditions.push(`source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    if (isIndividual !== null && isIndividual !== undefined && isIndividual !== "") {
      conditions.push(`is_individual = $${paramIndex}`);
      params.push(isIndividual === "true");
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Allowed sort columns for safety
    const allowedSortColumns = [
      "created_at",
      "updated_at",
      "contact_name",
      "company",
      "deal_value",
      "priority",
      "last_contact_date",
      "next_follow_up_date",
      "status"
    ];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : "created_at";
    const safeSortOrder = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Priority ordering custom sort if selected
    let orderByStr = `ORDER BY ${safeSortBy} ${safeSortOrder}`;
    if (sortBy === "priority") {
      orderByStr = `ORDER BY CASE priority 
        WHEN 'High' THEN 1 
        WHEN 'Medium' THEN 2 
        WHEN 'Low' THEN 3 
        ELSE 4 END ${safeSortOrder}`;
    }

    const sql = `
      SELECT * FROM crm_contacts
      ${whereClause}
      ${orderByStr}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM crm_contacts
      ${whereClause}
    `;

    const [rows, countRow] = await Promise.all([
      query(sql, [...params, limit, offset]),
      queryOne<{ count: string }>(countSql, params)
    ]);

    const total = parseInt(countRow?.count ?? "0");

    return NextResponse.json({
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      contactName,
      title,
      company,
      email,
      phone,
      source = "manual_entry",
      isIndividual = true,
      isDecisionMaker = false,
      influenceLevel = "influencer",
      securityType,
      positionSize = 0,
      estimatedValue = 0,
      securityDescription,
      status = "Warm",
      priority = "Medium",
      dealValue = 0,
      closeProbability = 0,
      expectedCloseDate,
      actualCloseDate,
      notes,
      tags = [],
      followUpSequence = "none",
      automationEnabled = true
    } = body;

    if (!contactName || !email) {
      return NextResponse.json({ error: "contactName and email are required" }, { status: 400 });
    }

    const sql = `
      INSERT INTO crm_contacts (
        contact_name, title, company, email, phone, source,
        is_individual, is_decision_maker, influence_level, security_type,
        position_size, estimated_value, security_description, status, priority,
        deal_value, close_probability, expected_close_date, actual_close_date,
        notes, tags, follow_up_sequence, automation_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `;

    const newContact = await queryOne(sql, [
      contactName,
      title || null,
      company || null,
      email,
      phone || null,
      source,
      isIndividual,
      isDecisionMaker,
      influenceLevel,
      securityType || null,
      positionSize,
      estimatedValue,
      securityDescription || null,
      status,
      priority,
      dealValue,
      closeProbability,
      expectedCloseDate || null,
      actualCloseDate || null,
      notes || null,
      tags,
      followUpSequence,
      automationEnabled
    ]);

    return NextResponse.json({ data: newContact }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
