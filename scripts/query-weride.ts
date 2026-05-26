import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "/Users/ericmiller/Projects/edgar-insider-scout/.env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set!");
    return;
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    console.log("=== LATEST RUN LOGS ===");
    const runs = await client.query(`
      SELECT run_id, run_at, filings_scanned, matched_targets, emails_sent, suppressed_dupes, status 
      FROM outreach_run_log 
      ORDER BY run_at DESC 
      LIMIT 10
    `);
    console.table(runs.rows);

    console.log("\n=== LATEST OUTREACHES SENT ===");
    const outreaches = await client.query(`
      SELECT outreach_id, target_company, email, filing_date, sent_at, delivery_status 
      FROM outreach_crm 
      ORDER BY sent_at DESC 
      LIMIT 20
    `);
    console.table(outreaches.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
