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
    console.log("=== FAILED RUN DETAILS ===");
    const runs = await client.query(`
      SELECT run_id, run_at, auth_errors, send_errors, status 
      FROM outreach_run_log 
      WHERE status = 'failed' 
      ORDER BY run_at DESC 
      LIMIT 5
    `);
    
    for (const r of runs.rows) {
      console.log(`\nRun ID: ${r.run_id} at ${r.run_at}`);
      console.log(`Auth Errors: ${r.auth_errors}`);
      console.log(`Send Errors: ${r.send_errors}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
