// app/api/pipeline/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sql = `
      SELECT 
        status, 
        COUNT(*)::int as count, 
        SUM(deal_value)::numeric as total_value,
        AVG(deal_value)::numeric as avg_value
      FROM crm_contacts
      GROUP BY status
    `;

    const rows = await query(sql);

    // Format stats as key-value for easy frontend use
    const stats: Record<string, { count: number; total_value: number; avg_value: number }> = {
      Hot: { count: 0, total_value: 0, avg_value: 0 },
      Warm: { count: 0, total_value: 0, avg_value: 0 },
      Cold: { count: 0, total_value: 0, avg_value: 0 },
      Closed_Won: { count: 0, total_value: 0, avg_value: 0 },
      Closed_Lost: { count: 0, total_value: 0, avg_value: 0 },
      Dead: { count: 0, total_value: 0, avg_value: 0 }
    };

    rows.forEach((row: any) => {
      if (row.status in stats) {
        stats[row.status] = {
          count: parseInt(row.count ?? "0"),
          total_value: parseFloat(row.total_value ?? "0"),
          avg_value: parseFloat(row.avg_value ?? "0")
        };
      }
    });

    return NextResponse.json({ stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
