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

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(contact_person ILIKE $${paramIndex} OR target_company ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      // Map mock status to real reply_status roughly
      // Hot = interested, Warm = awaiting, Cold = passed, etc.
      if (status === 'Hot') conditions.push(`reply_status = 'interested'`);
      else if (status === 'Warm') conditions.push(`reply_status = 'awaiting'`);
      else if (status === 'Cold') conditions.push(`reply_status = 'passed'`);
      else if (status === 'Dead') conditions.push(`reply_status = 'bounced'`);
      else if (status === 'Closed_Won') conditions.push(`reply_status = 'won'`);
      else conditions.push(`reply_status = $${paramIndex}`);
      
      if (!['Hot', 'Warm', 'Cold', 'Dead', 'Closed_Won'].includes(status)) {
        params.push(status);
        paramIndex++;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // We map outreach_crm to look like crm_contacts
    const sql = `
      SELECT 
        outreach_id as id,
        contact_person as contact_name,
        title,
        target_company as company,
        email,
        phone,
        'outreach' as source,
        true as is_individual,
        false as is_decision_maker,
        'influencer' as influence_level,
        'Rule_144' as security_type,
        0 as position_size,
        0 as estimated_value,
        likely_paper as security_description,
        filing_url,
        CASE 
          WHEN reply_status = 'interested' THEN 'Hot'
          WHEN reply_status = 'passed' THEN 'Cold'
          WHEN reply_status = 'bounced' THEN 'Dead'
          WHEN reply_status = 'won' THEN 'Closed_Won'
          ELSE 'Warm' 
        END as status,
        CASE 
          WHEN score >= 80 THEN 'High'
          WHEN score >= 50 THEN 'Medium'
          ELSE 'Low'
        END as priority,
        score * 10000 as deal_value,
        sent_at as created_at,
        notes
      FROM outreach_crm
      ${whereClause}
      ORDER BY 
        CASE 
          WHEN email ILIKE 'ir@%' OR email ILIKE 'info@%' OR email ILIKE 'contact@%' OR email ILIKE 'investor%' THEN 3
          WHEN phone IS NOT NULL AND phone != '' AND phone != 'unknown' THEN 1
          ELSE 2
        END ASC,
        sent_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countSql = `
      SELECT COUNT(*) as count FROM outreach_crm
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

    if (!contactName) {
      return NextResponse.json({ error: "contactName is required" }, { status: 400 });
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
      email || null,
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
