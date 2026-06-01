// scripts/test-orchestrator.ts
import * as dotenv from "dotenv";
dotenv.config({ path: "/Users/ericmiller/Projects/edgar-insider-scout/.env.local" });

import { runDailyWorkflow } from "../lib/workflow/orchestrator";

async function main() {
  console.log("Starting test run of the daily workflow orchestrator (dryRun=true)...");
  const result = await runDailyWorkflow({ dryRun: true });
  console.log("\nWorkflow Orchestrator Test Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
