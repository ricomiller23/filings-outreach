import { query } from "../lib/db";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function run() {
  // Check Filing table (old backfill data)
  const filingCount = await query(`SELECT COUNT(*) as cnt FROM "Filing"`);
  console.log("Filing count:", filingCount);

  // Check FilingV4 table
  const filingV4Count = await query(`SELECT COUNT(*) as cnt FROM "FilingV4"`);
  console.log("FilingV4 count:", filingV4Count);

  // Filing form types
  const formTypes = await query(`SELECT "formType", COUNT(*) as cnt FROM "Filing" GROUP BY "formType" ORDER BY cnt DESC`);
  console.log("Filing form types:", JSON.stringify(formTypes, null, 2));

  // FilingV4 form types
  const formTypesV4 = await query(`SELECT "formType", COUNT(*) as cnt FROM "FilingV4" GROUP BY "formType" ORDER BY cnt DESC`);
  console.log("FilingV4 form types:", JSON.stringify(formTypesV4, null, 2));

  // Date range
  const dateRange = await query(`SELECT MIN("filedAt") as earliest, MAX("filedAt") as latest FROM "Filing"`);
  console.log("Filing date range:", dateRange);

  const dateRangeV4 = await query(`SELECT MIN("filedAt") as earliest, MAX("filedAt") as latest FROM "FilingV4"`);
  console.log("FilingV4 date range:", dateRangeV4);

  // Issuers and Insiders counts
  const issuerCount = await query(`SELECT COUNT(*) as cnt FROM "Issuer"`);
  console.log("Issuer count:", issuerCount);

  const insiderCount = await query(`SELECT COUNT(*) as cnt FROM "Insider"`);
  console.log("Insider count:", insiderCount);

  // Sample filing with joins
  const sampleFiling = await query(`
    SELECT f."formType", f."filedAt", f."score", f."hasAgedDebt", f."hasRestricted", f."has3a10",
           i."name" as issuer_name, i."ticker", i."marketTier",
           ins."fullName" as insider_name, ins."phone" as insider_phone, ins."email" as insider_email
    FROM "Filing" f
    JOIN "Issuer" i ON f."issuerId" = i."id"
    LEFT JOIN "Insider" ins ON f."insiderId" = ins."id"
    ORDER BY f."filedAt" DESC
    LIMIT 5
  `);
  console.log("Sample filings:", JSON.stringify(sampleFiling, null, 2));

  // Outreach CRM count
  const crmCount = await query(`SELECT COUNT(*) as cnt FROM outreach_crm`);
  console.log("Outreach CRM count:", crmCount);

  // filings_3a10 count  
  const f3a10Count = await query(`SELECT COUNT(*) as cnt FROM filings_3a10`);
  console.log("filings_3a10 count:", f3a10Count);

  // EntityV4 count
  const entityV4Count = await query(`SELECT COUNT(*) as cnt FROM "EntityV4"`);
  console.log("EntityV4 count:", entityV4Count);
}
run().catch(console.error).finally(() => process.exit(0));
