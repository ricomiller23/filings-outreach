// app/api/analytics/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const totalContactsQuery = `SELECT COUNT(*)::int as count FROM crm_contacts`;
    const winRateQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'Closed_Won' THEN 1 END)::int as won,
        COUNT(CASE WHEN status IN ('Closed_Won', 'Closed_Lost') THEN 1 END)::int as total_closed
      FROM crm_contacts
    `;
    const sourceBreakdownQuery = `
      SELECT source, COUNT(*)::int as count, SUM(deal_value)::numeric as total_value
      FROM crm_contacts
      GROUP BY source
      ORDER BY count DESC
    `;
    const securityBreakdownQuery = `
      SELECT security_type, COUNT(*)::int as count, SUM(deal_value)::numeric as total_value
      FROM crm_contacts
      GROUP BY security_type
      ORDER BY count DESC
    `;
    const monthlyDealsQuery = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*)::int as count,
        SUM(deal_value)::numeric as total_value
      FROM crm_contacts
      GROUP BY month
      ORDER BY month ASC
    `;

    const [totalRes, winRes, sourceRes, securityRes, monthlyRes] = await Promise.all([
      queryOne<{ count: number }>(totalContactsQuery),
      queryOne<{ won: number; total_closed: number }>(winRateQuery),
      query(sourceBreakdownQuery),
      query(securityBreakdownQuery),
      query(monthlyDealsQuery)
    ]);

    const total = totalRes?.count ?? 0;
    const won = winRes?.won ?? 0;
    const closed = winRes?.total_closed ?? 0;
    const winRate = closed > 0 ? (won / closed) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalContacts: total,
        closedDeals: closed,
        wonDeals: won,
        winRate: parseFloat(winRate.toFixed(1))
      },
      sources: sourceRes,
      securities: securityRes,
      monthly: monthlyRes
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
