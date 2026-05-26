import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "/Users/ericmiller/Projects/edgar-insider-scout/.env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT * FROM public.contact_queue_view LIMIT 5
    `);
    console.log("Sample rows from contact_queue_view:");
    console.table(res.rows);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
