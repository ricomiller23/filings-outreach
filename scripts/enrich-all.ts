// scripts/enrich-all.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { enrichResearchQueue } from "../lib/workflow/enrich";

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;

  if (!geminiKey || !tavilyKey) {
    console.error("❌ GEMINI_API_KEY and TAVILY_API_KEY must be set in your .env.local file to run automated research.");
    process.exit(1);
  }

  console.log("🚀 Starting complete research queue enrichment...");
  
  let totalEnriched = 0;
  let batchNum = 1;
  const batchSize = 10;

  while (true) {
    console.log(`\n📦 Processing Batch #${batchNum}...`);
    const result = await enrichResearchQueue(batchSize);
    
    totalEnriched += result.enrichedCount;
    console.log(`✅ Batch #${batchNum} complete. Enriched in this batch: ${result.enrichedCount}.`);
    
    if (result.errors.length > 0) {
      console.warn(`⚠️ Errors encountered in batch:`, result.errors);
    }
    
    // If we processed 0 items and there are no errors, we are done
    if (result.enrichedCount === 0 && result.errors.length === 0) {
      console.log("🎉 Research queue is fully processed or no more enrichable items found.");
      break;
    }

    // Stop if we hit a wall of consecutive errors to prevent wasting API quota
    if (result.enrichedCount === 0 && result.errors.length > 0) {
      console.log("🛑 No items were enriched and errors occurred. Stopping run to prevent API quota consumption.");
      break;
    }
    
    batchNum++;
    // Add a small 2-second sleep to avoid hitting API rate limits aggressively
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log(`\n🏁 Finished! Total contacts enriched and promoted: ${totalEnriched}`);
}

main().catch(console.error);
