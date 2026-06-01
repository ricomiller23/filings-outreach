// scripts/cleanup-generic-emails.ts
// Run once: npx tsx scripts/cleanup-generic-emails.ts
// Sets live_enabled = false for any seed watchlist record with a generic email address.

import { getPool } from "../lib/db";
import { isGenericEmail } from "../lib/email-validator";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.production" });

async function main() {
  console.log("🧼 Cleaning up generic emails from outreach_seed_watchlist...");
  const pool = getPool();
  const client = pool.connect ? await pool.connect() : pool; // fallback

  try {
    // 1. Get all seed contacts with emails
    const res = await client.query(
      `SELECT seed_id, target_company, email, live_enabled, notes 
       FROM outreach_seed_watchlist 
       WHERE email IS NOT NULL`
    );

    let cleanedCount = 0;
    
    for (const row of res.rows) {
      if (isGenericEmail(row.email)) {
        console.log(`[cleanup] Found generic email for ${row.target_company}: ${row.email} (live_enabled: ${row.live_enabled})`);
        
        const newNotes = row.notes 
          ? `${row.notes} | Disabled automatically: uses generic email address.`
          : "Disabled automatically: uses generic email address.";
          
        await client.query(
          `UPDATE outreach_seed_watchlist 
           SET live_enabled = false, 
               notes = $1, 
               updated_at = now() 
           WHERE seed_id = $2`,
          [newNotes, row.seed_id]
        );
        cleanedCount++;
      }
    }

    console.log(`\n✅ Database cleanup complete: disabled ${cleanedCount} seed(s) with generic emails.\n`);
  } catch (err: any) {
    console.error("❌ Cleanup failed:", err.message);
  } finally {
    if ((client as any).release) (client as any).release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Cleanup main error:", e);
  process.exit(1);
});
