// app/api/gmail-status/route.ts — Check Gmail auth + alias status

import { NextResponse } from "next/server";
import { isAuthConfigured, checkSendAsAlias } from "@/lib/gmail/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isAuthConfigured();

  if (!configured) {
    return NextResponse.json({
      authenticated: false,
      aliasFound: false,
      aliasVerified: false,
      error:
        "Gmail credentials not set. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.",
    });
  }

  const sendAs = process.env.SEND_AS_EMAIL ?? "ricomiller@icloud.com";
  const aliasCheck = await checkSendAsAlias(sendAs);

  return NextResponse.json({
    authenticated: true,
    aliasEmail: sendAs,
    aliasFound: aliasCheck.found,
    aliasVerified: aliasCheck.verified,
    allAliases: aliasCheck.allAliases,
    error: aliasCheck.error,
    readyToSend: configured && aliasCheck.found && aliasCheck.verified,
  });
}
