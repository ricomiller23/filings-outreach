import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables from filings-outreach's .env.local
dotenv.config({ path: path.join(__dirname, "../.env.local") });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in environment variables");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    // 1. Search for Rule 415 in outreach_seed_watchlist
    console.log("\nChecking outreach_seed_watchlist...");
    const seeds = await client.query(`
      SELECT seed_id, target_company, likely_paper, best_angle 
      FROM outreach_seed_watchlist 
      WHERE likely_paper ILIKE '%415%' OR best_angle ILIKE '%415%'
    `);
    console.log(`Found ${seeds.rowCount} matching rows in outreach_seed_watchlist.`);
    for (const row of seeds.rows) {
      console.log(`- Seed ID: ${row.seed_id}, Company: ${row.target_company}`);
      console.log(`  Before: likely_paper="${row.likely_paper}", best_angle="${row.best_angle}"`);
      
      const newPaper = row.likely_paper ? row.likely_paper.replace(/rule\s*415/gi, "Rule 144") : row.likely_paper;
      const newAngle = row.best_angle ? row.best_angle.replace(/rule\s*415/gi, "Rule 144") : row.best_angle;
      
      await client.query(`
        UPDATE outreach_seed_watchlist 
        SET likely_paper = $1, best_angle = $2, updated_at = now() 
        WHERE seed_id = $3
      `, [newPaper, newAngle, row.seed_id]);
      console.log(`  After:  likely_paper="${newPaper}", best_angle="${newAngle}"`);
    }

    // 2. Search for Rule 415 in outreach_crm (history of sent/drafted emails)
    console.log("\nChecking outreach_crm...");
    const crmRows = await client.query(`
      SELECT outreach_id, target_company, email, likely_paper, outreach_angle, email_subject, email_body 
      FROM outreach_crm 
      WHERE likely_paper ILIKE '%415%' OR outreach_angle ILIKE '%415%' OR email_subject ILIKE '%415%' OR email_body ILIKE '%415%'
    `);
    console.log(`Found ${crmRows.rowCount} matching rows in outreach_crm.`);
    for (const row of crmRows.rows) {
      console.log(`- Outreach ID: ${row.outreach_id}, Company: ${row.target_company}, Email: ${row.email}`);
      
      const newPaper = row.likely_paper ? row.likely_paper.replace(/rule\s*415/gi, "Rule 144") : row.likely_paper;
      const newAngle = row.outreach_angle ? row.outreach_angle.replace(/rule\s*415/gi, "Rule 144") : row.outreach_angle;
      const newSubject = row.email_subject ? row.email_subject.replace(/rule\s*415/gi, "Rule 144") : row.email_subject;
      const newBody = row.email_body ? row.email_body.replace(/rule\s*415/gi, "Rule 144") : row.email_body;

      await client.query(`
        UPDATE outreach_crm 
        SET likely_paper = $1, outreach_angle = $2, email_subject = $3, email_body = $4 
        WHERE outreach_id = $5
      `, [newPaper, newAngle, newSubject, newBody, row.outreach_id]);
      console.log("  Updated successfully.");
    }

    // 3. Search for Rule 415 in outreach_research_queue
    console.log("\nChecking outreach_research_queue...");
    const queueRows = await client.query(`
      SELECT queue_id, issuer_name, likely_paper, notes 
      FROM outreach_research_queue 
      WHERE likely_paper ILIKE '%415%' OR notes ILIKE '%415%'
    `);
    console.log(`Found ${queueRows.rowCount} matching rows in outreach_research_queue.`);
    for (const row of queueRows.rows) {
      console.log(`- Queue ID: ${row.queue_id}, Issuer: ${row.issuer_name}`);
      
      const newPaper = row.likely_paper ? row.likely_paper.replace(/rule\s*415/gi, "Rule 144") : row.likely_paper;
      const newNotes = row.notes ? row.notes.replace(/rule\s*415/gi, "Rule 144") : row.notes;

      await client.query(`
        UPDATE outreach_research_queue 
        SET likely_paper = $1, notes = $2 
        WHERE queue_id = $3
      `, [newPaper, newNotes, row.queue_id]);
      console.log("  Updated successfully.");
    }

    // 4. Search for Rule 415 in crm_contacts
    console.log("\nChecking crm_contacts...");
    const crmContacts = await client.query(`
      SELECT id, contact_name, security_description, notes 
      FROM crm_contacts 
      WHERE security_description ILIKE '%415%' OR notes ILIKE '%415%'
    `);
    console.log(`Found ${crmContacts.rowCount} matching rows in crm_contacts.`);
    for (const row of crmContacts.rows) {
      console.log(`- Contact ID: ${row.id}, Name: ${row.contact_name}`);
      
      const newDesc = row.security_description ? row.security_description.replace(/rule\s*415/gi, "Rule 144") : row.security_description;
      const newNotes = row.notes ? row.notes.replace(/rule\s*415/gi, "Rule 144") : row.notes;

      await client.query(`
        UPDATE crm_contacts 
        SET security_description = $1, notes = $2, updated_at = now() 
        WHERE id = $3
      `, [newDesc, newNotes, row.id]);
      console.log("  Updated successfully.");
    }

    // 5. Search for Rule 415 in contacts
    console.log("\nChecking contacts...");
    // Let's get table columns for public.contacts dynamically to make sure we don't assume columns
    const colsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND table_schema = 'public'
    `);
    const cols = colsResult.rows.map(r => r.column_name);
    console.log(`Table contacts columns: ${cols.join(", ")}`);

    const hasNotes = cols.includes("notes");
    const hasSecDesc = cols.includes("security_description");
    const nameCol = cols.includes("contact_name") ? "contact_name" : cols.includes("name") ? "name" : null;

    if (nameCol) {
      let queryStr = `SELECT id, ${nameCol}`;
      if (hasSecDesc) queryStr += `, security_description`;
      if (hasNotes) queryStr += `, notes`;
      queryStr += ` FROM public.contacts WHERE 1=0`;
      if (hasSecDesc) queryStr += ` OR security_description ILIKE '%415%'`;
      if (hasNotes) queryStr += ` OR notes ILIKE '%415%'`;

      const contactsResult = await client.query(queryStr);
      console.log(`Found ${contactsResult.rowCount} matching rows in contacts.`);
      for (const row of contactsResult.rows) {
        console.log(`- Contact ID: ${row.id}, Name: ${row[nameCol]}`);
        const newDesc = hasSecDesc && row.security_description ? row.security_description.replace(/rule\s*415/gi, "Rule 144") : row.security_description;
        const newNotes = hasNotes && row.notes ? row.notes.replace(/rule\s*415/gi, "Rule 144") : row.notes;

        let updateStr = `UPDATE public.contacts SET `;
        const updates: string[] = [];
        const params: any[] = [];
        let pIdx = 1;
        if (hasSecDesc) {
          updates.push(`security_description = $${pIdx++}`);
          params.push(newDesc);
        }
        if (hasNotes) {
          updates.push(`notes = $${pIdx++}`);
          params.push(newNotes);
        }
        if (cols.includes("updated_at")) {
          updates.push(`updated_at = now()`);
        }
        updateStr += updates.join(", ") + ` WHERE id = $${pIdx}`;
        params.push(row.id);

        if (updates.length > 0) {
          await client.query(updateStr, params);
          console.log("  Updated successfully.");
        }
      }
    } else {
      console.log("Skipping contacts update since name/contact_name column was not found.");
    }

    console.log("\nMigration completed successfully.");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
