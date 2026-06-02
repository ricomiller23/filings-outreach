import { query, queryOne } from "../db";
import { isGenericEmail } from "../email-validator";

export interface EnrichedContact {
  contact_person: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  likely_paper: string | null;
  best_angle: string | null;
  notes: string | null;
}

/**
 * Automatically run web research and enrich pending items in the research queue.
 * Promotes successfully enriched companies with verified, personal emails to the live seed watchlist.
 */
export async function enrichResearchQueue(limit = 10): Promise<{ enrichedCount: number; errors: string[] }> {
  const errors: string[] = [];
  let enrichedCount = 0;

  const geminiKey = process.env.GEMINI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!geminiKey || !tavilyKey) {
    console.log("[enrich] ⚠️ GEMINI_API_KEY or TAVILY_API_KEY not configured in environment variables. Skipping automatic web research.");
    return { enrichedCount: 0, errors: ["API keys not configured."] };
  }

  try {
    // 1. Get pending research queue items
    const pendingItems = await query<{
      queue_id: string;
      issuer_name: string;
      ticker: string | null;
      issuer_cik: string;
      likely_contact_person: string | null;
      likely_paper: string | null;
      whalewisdom_stock_id: number | null;
    }>(
      `SELECT queue_id, issuer_name, ticker, issuer_cik, likely_contact_person, likely_paper, whalewisdom_stock_id
       FROM outreach_research_queue
       WHERE status = 'needs_research'
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    if (pendingItems.length === 0) {
      console.log("[enrich] No pending items in the research queue.");
      return { enrichedCount: 0, errors: [] };
    }

    console.log(`[enrich] Starting automated research for ${pendingItems.length} companies...`);

    for (const item of pendingItems) {
      try {
        console.log(`[enrich] 🔎 Researching ${item.issuer_name} (${item.ticker || "N/A"})...`);

        // 2. Perform Web Search using Tavily
        const searchQuery = `${item.issuer_name} (${item.ticker || ""}) investor relations contact name email phone`;
        const searchResults = await searchWebTavily(searchQuery, tavilyKey);

        if (!searchResults) {
          console.log(`[enrich] ⏭ No search results returned for ${item.issuer_name}. Skipping.`);
          continue;
        }

        // 3. Extract contact info using Gemini API
        const contactInfo = await extractContactWithGemini(
          item.issuer_name,
          item.ticker || "N/A",
          item.likely_contact_person || "",
          searchResults,
          geminiKey
        );

        if (contactInfo && contactInfo.email && !isGenericEmail(contactInfo.email)) {
          console.log(`[enrich] 🎯 Found verified contact for ${item.issuer_name}: ${contactInfo.contact_person} (${contactInfo.email})`);

          // 4. Insert into outreach_seed_watchlist
          const seedResult = await queryOne<{ seed_id: string }>(
            `INSERT INTO public.outreach_seed_watchlist (
               target_company, target_context, contact_person, title, email, phone,
               filing_link, contact_source_link, likely_paper, best_angle,
               live_enabled, issuer_cik, whalewisdom_stock_id, notes, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, NULL, NULL, $7, $8, true, $9, $10, $11, now())
             ON CONFLICT (target_company, email) DO UPDATE SET
               contact_person = EXCLUDED.contact_person,
               title = EXCLUDED.title,
               phone = EXCLUDED.phone,
               likely_paper = EXCLUDED.likely_paper,
               best_angle = EXCLUDED.best_angle,
               live_enabled = true,
               issuer_cik = EXCLUDED.issuer_cik,
               whalewisdom_stock_id = EXCLUDED.whalewisdom_stock_id,
               notes = COALESCE(outreach_seed_watchlist.notes || ' | ', '') || EXCLUDED.notes,
               updated_at = now()
             RETURNING seed_id`,
            [
              item.issuer_name,
              `Automatically researched and enriched from SEC filings`,
              contactInfo.contact_person || "Investor Relations",
              contactInfo.title || "Investor Relations",
              contactInfo.email.trim(),
              contactInfo.phone || "unknown",
              contactInfo.likely_paper || item.likely_paper || "OTC company paper",
              contactInfo.best_angle || "Inquiry regarding potential block sale or capital structure optimization",
              item.issuer_cik,
              item.whalewisdom_stock_id,
              contactInfo.notes || "Automatically enriched via search."
            ]
          );

          const seedId = seedResult?.seed_id;
          if (seedId) {
            // 5. Mark research queue item as resolved
            await query(
              `UPDATE public.outreach_research_queue
               SET status = 'researched',
                   resolved_seed_id = $1
               WHERE queue_id = $2`,
              [seedId, item.queue_id]
            );

            // 6. Push to public.contacts (which automatically syncs to crm_contacts via DB trigger)
            let issuerId;
            const checkIssuer = await queryOne<{ id: string }>(
              "SELECT id FROM public.issuers WHERE cik = $1 LIMIT 1",
              [item.issuer_cik]
            );
            if (checkIssuer) {
              issuerId = checkIssuer.id;
            } else {
              const newId = crypto.randomUUID();
              const dummyCik = item.issuer_cik || ('DUMMY_' + newId.substring(0, 8).toUpperCase());
              await query(
                "INSERT INTO public.issuers (id, cik, issuer_name) VALUES ($1, $2, $3)",
                [newId, dummyCik, item.issuer_name]
              );
              issuerId = newId;
            }

            const contactId = crypto.randomUUID();
            await query(
              `INSERT INTO public.contacts (
                id, issuer_id, contact_name, role_title, phone, email, source,
                status, notes, is_active, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, 'auto_research', 'new', $7, true, now(), now())
              ON CONFLICT (id) DO NOTHING`,
              [
                contactId,
                issuerId,
                contactInfo.contact_person || "Investor Relations",
                contactInfo.title || "Investor Relations",
                contactInfo.phone,
                contactInfo.email,
                contactInfo.notes || "Enriched via automated search."
              ]
            );

            enrichedCount++;
          }
        } else {
          console.log(`[enrich] ⏭ Could not find a verified personal/non-generic email for ${item.issuer_name}. Setting status to 'skip'.`);
          await query(
            `UPDATE public.outreach_research_queue
             SET status = 'skip',
                 notes = COALESCE(notes || ' | ', '') || 'No verified personal business email found during automated search.'
             WHERE queue_id = $1`,
            [item.queue_id]
          );
        }
      } catch (err: any) {
        const msg = err.message || String(err);
        errors.push(`Failed to enrich ${item.issuer_name}: ${msg}`);
        console.error(`[enrich] Error researching ${item.issuer_name}:`, msg);
      }
    }
  } catch (err: any) {
    errors.push(`Fatal enrichment queue error: ${err.message}`);
    console.error("[enrich] Fatal queue research error:", err);
  }

  return { enrichedCount, errors };
}

/**
 * Query Tavily Search API.
 */
async function searchWebTavily(queryStr: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: queryStr,
        search_depth: "advanced",
        include_answer: true,
        max_results: 5
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (!res.ok) return null;
    const json = await res.json();
    
    // Combine answer and results snippets for Gemini
    let content = `Answer summary: ${json.answer || "N/A"}\n\nSearch Results:\n`;
    if (json.results && Array.isArray(json.results)) {
      json.results.forEach((r: any, idx: number) => {
        content += `[Result ${idx + 1}] Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}\n\n`;
      });
    }
    return content;
  } catch (err) {
    console.warn("[enrich] Tavily search request failed:", err);
    return null;
  }
}

/**
 * Call Gemini API to extract contact details from search results.
 */
async function extractContactWithGemini(
  company: string,
  ticker: string,
  likelyPerson: string,
  searchResults: string,
  apiKey: string
): Promise<EnrichedContact | null> {
  const prompt = `
You are an expert corporate intelligence researcher.
Analyze the following search results for company: "${company}" (Ticker: "${ticker}").
${likelyPerson ? `Our filing scan suggests the contact person might be "${likelyPerson}".` : ""}

Task: Extract contact details for a SPECIFIC human being in the Investor Relations department or executive leadership team (CEO, CFO, Vice President, etc.).

CRITICAL REQUIREMENTS:
1. We only want a real, direct personal business email address (e.g. neil.backhouse@newmont.com, amuller@trinseo.com, joseph@defidevcorp.com).
2. DO NOT use generic or department email addresses (like ir@, info@, contact@, sales@, office@, support@, hello@, press@, media@, investorrelations@). If only generic emails are found, return null for email.
3. Verify that the person actually works at or represents the company.

Provide your output strictly in JSON format matching this schema:
{
  "contact_person": "Full Name of the representative" or null,
  "title": "Title (e.g., CFO, VP of Investor Relations)" or null,
  "email": "personal.business.email@company.com" or null,
  "phone": "direct phone number" or null,
  "likely_paper": "Rule 144 restricted stock / block position" or null,
  "best_angle": "Reason for reaching out (e.g., inquiry regarding recent filing or block sale)" or null,
  "notes": "Short note about verification or source" or null
}

Search Results Content:
${searchResults}
`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) {
      console.warn(`[enrich] Gemini API error: HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const data = JSON.parse(text) as EnrichedContact;
    return data;
  } catch (err) {
    console.warn("[enrich] Gemini API extraction failed:", err);
    return null;
  }
}
