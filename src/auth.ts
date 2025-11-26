#!/usr/bin/env node

/**
 * Google Calendar OAuth2 Authentication Setup
 * Run this script to generate the token.json file
 */

import { authenticate } from "@google-cloud/local-auth";
import * as fs from "fs/promises";

const CREDENTIALS_PATH = process.env.GOOGLE_CALENDAR_CREDENTIALS_PATH || "./credentials.json";
const TOKEN_PATH = process.env.GOOGLE_CALENDAR_TOKEN_PATH || "./token.json";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

async function main() {
  console.log("🔐 Google Calendar OAuth2 Authentication Setup\n");

  // Check if credentials file exists
  try {
    await fs.access(CREDENTIALS_PATH);
  } catch (error) {
    console.error(`❌ Error: credentials.json not found at ${CREDENTIALS_PATH}`);
    console.error("\nPlease follow these steps:");
    console.error("1. Go to https://console.cloud.google.com/");
    console.error("2. Create a new project or select an existing one");
    console.error("3. Enable the Google Calendar API");
    console.error("4. Create OAuth 2.0 credentials (Desktop app)");
    console.error("5. Download the credentials JSON file");
    console.error("6. Save it as 'credentials.json' in this directory\n");
    process.exit(1);
  }

  console.log(`✅ Found credentials file at: ${CREDENTIALS_PATH}`);
  console.log("\nStarting OAuth2 flow...");
  console.log("This will open a browser window for you to authorize the application.\n");

  try {
    // Run OAuth2 flow
    const auth = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES,
    });

    // Save the token
    const tokens = auth.credentials;
    const tokenData = {
      type: "authorized_user",
      client_id: (auth as any)._clientId,
      client_secret: (auth as any)._clientSecret,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    };

    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokenData, null, 2));

    console.log("\n✅ Authentication successful!");
    console.log(`Token saved to: ${TOKEN_PATH}`);
    console.log("\nYou can now build and run the MCP server:");
    console.log("  npm run build");
    console.log("  docker build -t google-calendar-mcp-server .");
  } catch (error) {
    console.error("\n❌ Authentication failed:", error);
    process.exit(1);
  }
}

main();
