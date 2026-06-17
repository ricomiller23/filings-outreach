import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const formType = url.searchParams.get("formType") || "";
    const marketTier = url.searchParams.get("marketTier") || "";
    const hasAgedDebt = url.searchParams.get("hasAgedDebt");
    const hasRestricted = url.searchParams.get("hasRestricted");
    const has3a10 = url.searchParams.get("has3a10");
    const minScore = url.searchParams.get("minScore");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const sortBy = url.searchParams.get("sortBy") || "filedAt";
    const sortDir = url.searchParams.get("sortDir") || "desc";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(
        `(i."name" ILIKE $${paramIdx} OR i."ticker" ILIKE $${paramIdx} OR ins."fullName" ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (formType) {
      conditions.push(`f."formType" = $${paramIdx}`);
      params.push(formType);
      paramIdx++;
    }

    if (marketTier) {
      conditions.push(`i."marketTier" = $${paramIdx}`);
      params.push(marketTier);
      paramIdx++;
    }

    if (hasAgedDebt === "true") {
      conditions.push(`f."hasAgedDebt" = true`);
    }

    if (hasRestricted === "true") {
      conditions.push(`f."hasRestricted" = true`);
    }

    if (has3a10 === "true") {
      conditions.push(`f."has3a10" = true`);
    }

    if (minScore) {
      conditions.push(`f."score" >= $${paramIdx}`);
      params.push(parseInt(minScore, 10));
      paramIdx++;
    }

    if (dateFrom) {
      conditions.push(`f."filedAt" >= $${paramIdx}`);
      params.push(dateFrom);
      paramIdx++;
    }

    if (dateTo) {
      conditions.push(`f."filedAt" <= $${paramIdx}`);
      params.push(dateTo + "T23:59:59.999Z");
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    // Determine ORDER BY column
    const sortColumnMap: Record<string, string> = {
      filedAt: `f."filedAt"`,
      score: `f."score"`,
      issuerName: `i."name"`,
    };
    const orderCol = sortColumnMap[sortBy] || `f."filedAt"`;
    const orderDir = sortDir === "asc" ? "ASC" : "DESC";

    // Count query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM "Filing" f
      LEFT JOIN "Issuer" i ON f."issuerId" = i."id"
      LEFT JOIN "Insider" ins ON f."insiderId" = ins."id"
      ${whereClause}
    `;
    const countResult = await query<{ total: number }>(countSql, params);
    const total = countResult[0]?.total || 0;

    // Data query
    const dataSql = `
      SELECT
        f."id",
        f."accessionNumber",
        f."formType",
        f."filedAt",
        f."periodOfReport",
        f."score",
        f."hasAgedDebt",
        f."hasRestricted",
        f."has3a10",
        f."rawXmlUrl",
        f."primaryDocUrl",
        f."createdAt",
        i."id" AS "issuerId",
        i."name" AS "issuerName",
        i."ticker" AS "issuerTicker",
        i."marketTier",
        i."cik" AS "issuerCik",
        ins."id" AS "insiderId",
        ins."fullName" AS "insiderName",
        ins."cik" AS "insiderCik"
      FROM "Filing" f
      LEFT JOIN "Issuer" i ON f."issuerId" = i."id"
      LEFT JOIN "Insider" ins ON f."insiderId" = ins."id"
      ${whereClause}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limit, offset);

    const rows = await query(dataSql, params);

    return NextResponse.json({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[api/filings] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch filings", details: String(err) },
      { status: 500 }
    );
  }
}
