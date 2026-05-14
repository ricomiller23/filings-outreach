// scripts/init-db.ts
// Run once: npx tsx scripts/init-db.ts
// Creates the outreach tables in the Neon DB.

import { readFileSync } from "fs";
import { join } from "path";
import { getPool } from "../lib/db";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  console.log("🔧 Initializing outreach database tables...");
  const pool = getPool();

  const schema = readFileSync(join(process.cwd(), "scripts/schema.sql"), "utf-8");

  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log("✅ Tables created successfully:");
    console.log("   - outreach_seed_watchlist");
    console.log("   - outreach_crm");
    console.log("   - outreach_run_log");

    // Verify
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('outreach_seed_watchlist', 'outreach_crm', 'outreach_run_log')
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\n📋 Verified ${result.rows.length}/3 tables exist in database.`);
    result.rows.forEach((r) => console.log(`   ✓ ${r.table_name}`));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Init failed:", e.message);
  process.exit(1);
});
