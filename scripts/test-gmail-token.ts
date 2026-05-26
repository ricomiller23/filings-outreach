import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.production" });

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  console.log("Client ID:", clientId);
  console.log("Has Client Secret:", !!clientSecret);
  console.log("Has Refresh Token:", !!refreshToken);

  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Missing credentials!");
    return;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, "http://localhost:4321/oauth2callback");
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    console.log("Attempting to get access token...");
    const { token } = await oauth2Client.getAccessToken();
    console.log("Access token retrieved successfully! Token starts with:", token?.slice(0, 10));

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: "me" });
    console.log("Profile email address:", profile.data.emailAddress);
  } catch (err: any) {
    console.error("❌ Gmail authorization test failed:", err.message);
    if (err.response?.data) {
      console.error("Error response details:", JSON.stringify(err.response.data, null, 2));
    }
  }
}

main().catch(console.error);
