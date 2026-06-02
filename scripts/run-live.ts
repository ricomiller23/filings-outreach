// scripts/run-live.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { runDailyWorkflow } from "../lib/workflow/orchestrator";

async function main() {
  console.log("🚀 Starting a LIVE run of the daily workflow orchestrator (dryRun=false)...");
  const result = await runDailyWorkflow({ dryRun: false });
  console.log("\nWorkflow Orchestrator LIVE Run Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
