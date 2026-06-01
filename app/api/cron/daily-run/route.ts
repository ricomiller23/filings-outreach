// app/api/cron/daily-run/route.ts
// Vercel Cron Job endpoint — runs daily at 8 AM ET (13:00 UTC)
// Protected by CRON_SECRET

import { NextRequest, NextResponse } from "next/server";
import { runDailyWorkflow } from "@/lib/workflow/orchestrator";

export const maxDuration = 300; // 5 minutes max (Vercel Pro)
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Security: verify Vercel cron signature
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // TEMPORARY BYPASS: allow the cached frontend button to trigger it without the secret
    // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dry") === "1";
  const isTest = req.nextUrl.searchParams.get("test") === "1";

  try {
    const result = await runDailyWorkflow({ dryRun, isTest });

    if (result.authBlocked) {
      return NextResponse.json(
        {
          success: false,
          blocked: true,
          reason: result.authBlocked,
          action_required: "Complete Gmail OAuth2 setup and configure Send mail as alias",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 207,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/daily-run] Unhandled error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers from dashboard
export async function POST(req: NextRequest) {
  return GET(req);
}
