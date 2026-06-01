// scripts/setup-gmail.ts
// Run locally ONCE to authorize Gmail and get your refresh token.
// Usage: npx tsx scripts/setup-gmail.ts
//
// After this runs, copy the printed GOOGLE_REFRESH_TOKEN into:
//   - .env.local (for local dev)
//   - Vercel Environment Variables (for production)

import { google } from "googleapis";
import * as http from "http";
import * as url from "url";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

// Try to use 'open' for browser launch (graceful fallback)
async function openUrl(targetUrl: string) {
  try {
    const { default: open } = await import("open");
    await open(targetUrl);
  } catch {
    console.log("\n⚠ Could not auto-open browser. Please manually open:");
    console.log(targetUrl);
  }
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(`
❌ Missing Google OAuth2 credentials.

To fix this:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create a project (or select an existing one)
3. Enable "Gmail API" at: https://console.cloud.google.com/apis/library/gmail.googleapis.com
4. Create OAuth2 credentials → Desktop app type
5. Download the JSON and copy client_id and client_secret
6. Add to .env.local:
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
7. Re-run: npx tsx scripts/setup-gmail.ts
`);
    process.exit(1);
  }

  const REDIRECT_URI = "http://localhost:4321/oauth2callback";
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

  const scopes = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.settings.basic",
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force consent to get refresh_token
  });

  console.log("\n🔐 Gmail OAuth2 Setup\n" + "─".repeat(50));
  console.log("Please open the following URL in the browser to authorize:");
  console.log(authUrl);
  console.log("");

  // await openUrl(authUrl);

  // Start local HTTP server to receive the OAuth callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url ?? "", true);
      if (parsedUrl.pathname === "/oauth2callback") {
        const code = parsedUrl.query.code as string;
        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html><body style="font-family:monospace;background:#0a0a0f;color:#a3e635;padding:40px">
              <h2>✅ Authorization successful!</h2>
              <p>You can close this tab and return to the terminal.</p>
            </body></html>
          `);
          server.close();
          resolve(code);
        } else {
          res.writeHead(400);
          res.end("No code received");
          reject(new Error("No authorization code received"));
        }
      }
    });
    server.listen(4321, () => {
      console.log("Waiting for authorization on http://localhost:4321...");
    });
    setTimeout(() => {
      server.close();
      reject(new Error("Timeout: no authorization received within 5 minutes"));
    }, 300000);
  });

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    console.error(`
❌ No refresh token received. 

This usually means the account was already authorized without the 'consent' prompt.
Try revoking access at: https://myaccount.google.com/permissions
Then re-run this script.
`);
    process.exit(1);
  }

  console.log(`\n✅ Authorization successful!\n${"─".repeat(50)}`);
  console.log("\n📋 Add these to your .env.local AND Vercel environment variables:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`\nAccess token (expires, do NOT store): ${tokens.access_token?.slice(0, 40)}...`);

  // Check send-as alias
  oauth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const sendAs = await gmail.users.settings.sendAs.list({ userId: "me" });
  const aliases = sendAs.data.sendAs ?? [];
  const targetAlias = process.env.SEND_AS_EMAIL ?? "ricomiller@icloud.com";
  const found = aliases.find((a) => a.sendAsEmail?.toLowerCase() === targetAlias.toLowerCase());
  const foundAny = found as Record<string, unknown> | undefined;

  console.log(`\n📬 Send-as aliases on this account:`);
  aliases.forEach((a) => {
    const aAny = a as Record<string, unknown>;
    const verified = (aAny.verificationStatus === "accepted" || aAny.isVerified === true || aAny.isPrimary === true) ? "✅" : "⚠ unverified";
    console.log(`   ${verified} ${a.sendAsEmail} ${a.displayName ? `(${a.displayName})` : ""}`);
  });

  if (!found) {
    console.log(`\n⚠  BLOCKING: ${targetAlias} is NOT configured as a send-as alias.`);
    console.log(`\n   FIX REQUIRED:`);
    console.log(`   1. Open Gmail → Settings → See all settings → Accounts and Import`);
    console.log(`   2. Click "Add another email address"`);
    console.log(`   3. Enter: ${targetAlias}`);
    console.log(`   4. Complete the verification email`);
    console.log(`   5. Live outreach will be blocked until this is done`);
  } else if (foundAny?.verificationStatus !== "accepted" && foundAny?.isVerified !== true && foundAny?.isPrimary !== true) {
    console.log(`\n⚠  ${targetAlias} found but NOT yet verified.`);
    console.log(`   Check ${targetAlias} for a Gmail verification email and click the link.`);
  } else {
    console.log(`\n✅ ${targetAlias} is configured and verified — ready to send!`);
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log("Next steps:");
  console.log("  1. Copy GOOGLE_REFRESH_TOKEN above into .env.local");
  console.log("  2. Add all env vars to Vercel: vercel env add GOOGLE_REFRESH_TOKEN");
  console.log("  3. Run: npx tsx scripts/init-db.ts");
  console.log("  4. Run: npx tsx scripts/seed-db.ts");
  console.log("  5. Run: npx tsx scripts/dry-run.ts");
  console.log("  6. Deploy to Vercel: vercel --prod\n");

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Setup failed:", e.message);
  process.exit(1);
});
