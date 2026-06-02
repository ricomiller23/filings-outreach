// scripts/enrich-all.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { enrichResearchQueue } from "../lib/workflow/enrich";
import { queryOne } from "../lib/db";

async function getRemainingCount(): Promise<number> {
  try {
    const res = await queryOne<{ count: string }>(
      "SELECT count(*)::text as count FROM outreach_research_queue WHERE status = 'needs_research'"
    );
    return parseInt(res?.count || "0", 10);
  } catch (err) {
    console.error("Failed to query remaining count:", err);
    return 0;
  }
}

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!geminiKey || !tavilyKey) {
    console.error("❌ GEMINI_API_KEY and TAVILY_API_KEY must be set in your .env.local file to run automated research.");
    process.exit(1);
  }

  const initialCount = await getRemainingCount();
  console.log(`🚀 Starting complete research queue enrichment. Initial pending items: ${initialCount}`);
  
  let totalEnriched = 0;
  let batchNum = 1;
  const batchSize = 10;
  let consecutiveErrorBatches = 0;
  let lastRemaining = initialCount;

  while (true) {
    const remaining = await getRemainingCount();
    if (remaining === 0) {
      console.log("🎉 Research queue is fully processed! All items are either promoted or skipped.");
      break;
    }

    console.log(`\n📦 Processing Batch #${batchNum} (Remaining: ${remaining} items in queue)...`);
    const result = await enrichResearchQueue(batchSize);
    
    totalEnriched += result.enrichedCount;
    console.log(`✅ Batch #${batchNum} complete. Enriched in this batch: ${result.enrichedCount}.`);
    
    if (result.errors.length > 0) {
      console.warn(`⚠️ Errors encountered in batch:`, result.errors);
    }
    
    const newRemaining = await getRemainingCount();
    const progressMade = lastRemaining - newRemaining;
    
    if (progressMade > 0) {
      console.log(`📈 Made progress: processed/skipped ${progressMade} items in this batch.`);
      consecutiveErrorBatches = 0; // Reset error counter since we are making progress
    } else {
      console.log("⚠️ No progress made in this batch (0 items were promoted or skipped).");
      if (result.errors.length > 0) {
        consecutiveErrorBatches++;
        console.warn(`Consecutive failed batches: ${consecutiveErrorBatches}/3`);
        if (consecutiveErrorBatches >= 3) {
          console.error("🛑 Stopping script because 3 consecutive batches failed to make progress due to API/network errors.");
          break;
        }
      } else {
        // No errors, but no progress made (shouldn't normally happen if remaining > 0, but safety check)
        console.log("No items processed and no errors occurred. Stopping to prevent loop.");
        break;
      }
    }
    
    lastRemaining = newRemaining;
    batchNum++;
    
    // Sleep for 3 seconds between batches to respect API rate limits
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const finalRemaining = await getRemainingCount();
  console.log(`\n🏁 Finished! Total contacts enriched and promoted: ${totalEnriched}. Remaining pending items: ${finalRemaining}`);
}

main().catch(console.error);
