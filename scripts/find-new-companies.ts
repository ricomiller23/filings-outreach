import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "/Users/ericmiller/Projects/edgar-insider-scout/.env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    // Find issuers in the Filing table that are not in the outreach_seed_watchlist table
    const res = await client.query(`
      SELECT DISTINCT f."issuerId", i.name, i.cik, i.ticker, i.phone, f."accessionNumber"
      FROM "public"."Filing" f
      JOIN "public"."Issuer" i ON f."issuerId" = i.id
      LEFT JOIN public.outreach_seed_watchlist w ON i.cik = w.issuer_cik
      WHERE w.seed_id IS NULL
      LIMIT 20
    `);
    
    console.log("Issuers in Filing table not on Watchlist:");
    console.table(res.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
