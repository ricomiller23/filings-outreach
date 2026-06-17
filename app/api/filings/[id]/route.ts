import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get filing with issuer and insider
    const filing = await queryOne(
      `SELECT
        f.*,
        i."id" AS "issuerId",
        i."cik" AS "issuerCik",
        i."name" AS "issuerName",
        i."ticker" AS "issuerTicker",
        i."marketTier",
        i."phone" AS "issuerPhone",
        i."irEmail",
        i."irContactName",
        i."transferAgent",
        i."website" AS "issuerWebsite",
        i."avgDailyVolume",
        i."marketCapUsd",
        ins."id" AS "insiderId_",
        ins."cik" AS "insiderCik",
        ins."fullName" AS "insiderName",
        ins."firstName" AS "insiderFirstName",
        ins."lastName" AS "insiderLastName",
        ins."isEntity" AS "insiderIsEntity",
        ins."address1" AS "insiderAddress",
        ins."city" AS "insiderCity",
        ins."state" AS "insiderState",
        ins."zip" AS "insiderZip",
        ins."phone" AS "insiderPhone",
        ins."email" AS "insiderEmail",
        ins."notes" AS "insiderNotes"
      FROM "Filing" f
      LEFT JOIN "Issuer" i ON f."issuerId" = i."id"
      LEFT JOIN "Insider" ins ON f."insiderId" = ins."id"
      WHERE f."id" = $1`,
      [id]
    );

    if (!filing) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    // Get transactions for this filing
    const transactions = await query(
      `SELECT
        t."id",
        t."tableType",
        t."securityTitle",
        t."transactionDate",
        t."transactionCode",
        t."shares",
        t."pricePerShare",
        t."acquiredDisposed",
        t."sharesOwnedAfter"
      FROM "Transaction" t
      WHERE t."filingId" = $1
      ORDER BY t."transactionDate" DESC`,
      [id]
    );

    // Get insider-issuer link (role info)
    const links = await query(
      `SELECT
        l."isDirector",
        l."isOfficer",
        l."isTenPctOwn",
        l."officerTitle",
        l."firstSeen",
        l."lastSeen"
      FROM "InsiderIssuerLink" l
      WHERE l."insiderId" = $1 AND l."issuerId" = $2`,
      [(filing as Record<string, unknown>).insiderId, (filing as Record<string, unknown>).issuerId]
    );

    return NextResponse.json({
      data: {
        filing,
        transactions,
        insiderRoles: links,
      },
    });
  } catch (err) {
    console.error("[api/filings/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch filing details", details: String(err) },
      { status: 500 }
    );
  }
}
