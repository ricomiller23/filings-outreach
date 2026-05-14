// scripts/seed-db.ts
// Run once: npx tsx scripts/seed-db.ts
// Upserts all seed contacts into outreach_seed_watchlist.

import { getPool } from "../lib/db";
import { ALL_SEEDS } from "../lib/seeds";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  console.log("🌱 Seeding outreach_seed_watchlist...");
  const pool = getPool();
  const client = await pool.connect();

  try {
    let inserted = 0;
    let updated = 0;

    for (const seed of ALL_SEEDS) {
      const res = await client.query(
        `INSERT INTO outreach_seed_watchlist 
          (target_company, target_context, contact_person, title, email, phone,
           filing_link, contact_source_link, likely_paper, best_angle, live_enabled,
           issuer_cik, notes, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now())
         ON CONFLICT (target_company, email) 
         DO UPDATE SET
           target_context = EXCLUDED.target_context,
           contact_person = EXCLUDED.contact_person,
           title = EXCLUDED.title,
           phone = EXCLUDED.phone,
           filing_link = EXCLUDED.filing_link,
           contact_source_link = EXCLUDED.contact_source_link,
           likely_paper = EXCLUDED.likely_paper,
           best_angle = EXCLUDED.best_angle,
           live_enabled = EXCLUDED.live_enabled,
           issuer_cik = EXCLUDED.issuer_cik,
           notes = EXCLUDED.notes,
           updated_at = now()
         RETURNING (xmax = 0) AS is_insert`,
        [
          seed.target_company,
          seed.target_context,
          seed.contact_person,
          seed.title,
          seed.email || null,
          seed.phone === "unknown" ? null : seed.phone,
          seed.filing_link || null,
          seed.contact_source_link || null,
          seed.likely_paper,
          seed.best_angle,
          seed.live_enabled,
          seed.issuer_cik || null,
          seed.notes || null,
        ]
      );
      if (res.rows[0]?.is_insert) inserted++;
      else updated++;
    }

    // Show final table
    const all = await client.query(
      `SELECT seed_id, target_company, contact_person, email, live_enabled 
       FROM outreach_seed_watchlist ORDER BY live_enabled DESC, target_company`
    );

    console.log(`\n✅ Seed complete: ${inserted} inserted, ${updated} updated\n`);
    console.log("📋 Current seed_watchlist:");
    console.log("─".repeat(80));
    all.rows.forEach((r) => {
      const status = r.live_enabled ? "🟢 LIVE" : "🔴 WATCHLIST";
      console.log(`${status} | ${r.target_company.padEnd(35)} | ${r.contact_person?.padEnd(30)} | ${r.email || "(no email)"}`);
    });
    console.log("─".repeat(80));
    console.log(`Total: ${all.rows.length} contacts (${all.rows.filter((r) => r.live_enabled).length} live)`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ Seed failed:", e.message);
  process.exit(1);
});
