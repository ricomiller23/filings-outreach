import { NextRequest, NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/workflow/orchestrator";

export const maxDuration = 300; // 5 minutes max (Vercel Pro)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  
  try {
    const result = await runDailyWorkflow({ dryRun });
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
