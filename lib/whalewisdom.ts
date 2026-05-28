// lib/whalewisdom.ts — WhaleWisdom API Client
// Handles authentication via HMAC-SHA1 signature and communicates with WhaleWisdom.

import crypto from "crypto";

export interface WhaleWisdomHolder {
  holder_name: string;
  shares: number;
  percent_ownership: number;
  change_shares: number;
}

export interface WhaleWisdomClientConfig {
  sharedKey?: string;
  secretKey?: string;
}

export class WhaleWisdomClient {
  private sharedKey: string;
  private secretKey: string;
  private baseUrl = "https://whalewisdom.com/shell/command.json";

  constructor(config?: WhaleWisdomClientConfig) {
    this.sharedKey = (config?.sharedKey ?? process.env.WHALEWISDOM_SHARED_KEY ?? "").trim();
    this.secretKey = (config?.secretKey ?? process.env.WHALEWISDOM_SECRET_KEY ?? "").trim();
  }

  /**
   * Check if credentials are set.
   */
  public isConfigured(): boolean {
    return this.sharedKey.length > 0 && this.secretKey.length > 0;
  }

  /**
   * Helper to sign requests.
   * Format: args + "\n" + timestamp
   * Signature is HMAC-SHA1 of combined string using secretKey, encoded in base64.
   */
  private generateSignature(argsString: string, timestamp: string): string {
    const dataToSign = `${argsString}\n${timestamp}`;
    return crypto
      .createHmac("sha1", this.secretKey)
      .update(dataToSign)
      .digest("base64");
  }

  /**
   * Send a signed command to the WhaleWisdom API.
   */
  private async executeCommand<T>(commandArgs: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error("WhaleWisdom API credentials are not configured. Set WHALEWISDOM_SHARED_KEY and WHALEWISDOM_SECRET_KEY.");
    }

    const argsString = JSON.stringify(commandArgs);
    // Format timestamp as YYYY-MM-DDTHH:MM:SSZ
    const timestamp = new Date().toISOString().replace(/\.\d{3}/, "");
    const signature = this.generateSignature(argsString, timestamp);

    // Build URL query parameters
    const params = new URLSearchParams({
      args: argsString,
      api_shared_key: this.sharedKey,
      api_sig: signature,
      timestamp: timestamp,
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`WhaleWisdom API error (HTTP ${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json();
    
    // Check if API returned error messages
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      throw new Error(`WhaleWisdom API errors: ${data.errors.join(", ")}`);
    }
    if (data.error || data.message === "Error") {
      throw new Error(`WhaleWisdom API error message: ${data.error || data.reason || JSON.stringify(data)}`);
    }

    return data as T;
  }

  public async lookupStockId(ticker: string, companyName?: string): Promise<number | null> {
    if (!ticker && !companyName) return null;
    
    interface StockLookupResponse {
      stocks?: Array<{
        id: number;
        ticker: string;
        name: string;
      }>;
    }

    // Step 1: Try searching by company name first (highly precise for large/common symbols)
    if (companyName) {
      // Clean corporate suffixes to increase match rate
      const cleanName = companyName
        .replace(/\b(inc|corp|co|ltd|plc|class [a-z]|holdings|group|trust|fund)\b\.?/gi, "")
        .trim();
      
      console.log(`[whalewisdom] S1: Looking up stock ID by company name: "${cleanName}"`);
      try {
        const data = await this.executeCommand<StockLookupResponse>({
          command: "stock_lookup",
          name: cleanName,
        });

        const stocks = data.stocks ?? [];
        if (stocks.length > 0) {
          // Find match with exact ticker or containing cleaned company name
          const exactTickerMatch = stocks.find(
            (s) => s.ticker.toUpperCase() === ticker.toUpperCase().trim()
          );
          if (exactTickerMatch) {
            console.log(`[whalewisdom] S1 Match found by exact ticker: ${exactTickerMatch.name} -> Stock ID: ${exactTickerMatch.id}`);
            return exactTickerMatch.id;
          }

          const closeNameMatch = stocks.find(
            (s) => s.name.toLowerCase().includes(cleanName.toLowerCase())
          );
          if (closeNameMatch) {
            console.log(`[whalewisdom] S1 Match found by name overlap: ${closeNameMatch.name} -> Stock ID: ${closeNameMatch.id}`);
            return closeNameMatch.id;
          }
        }
      } catch (err: any) {
        console.warn(`[whalewisdom] S1 Name lookup failed, trying fallback: ${err.message}`);
      }
    }

    // Step 2: Fallback to searching by ticker directly
    console.log(`[whalewisdom] S2: Looking up stock ID by ticker query: "${ticker}"`);
    try {
      const data = await this.executeCommand<StockLookupResponse>({
        command: "stock_lookup",
        name: ticker.toUpperCase().trim(),
      });

      const stocks = data.stocks ?? [];
      if (stocks.length === 0) {
        console.warn(`[whalewisdom] No stock ID found for ticker/name: ${ticker}`);
        return null;
      }

      // Exact ticker match
      const exactMatch = stocks.find(
        (r) => r.ticker.toUpperCase() === ticker.toUpperCase().trim()
      );
      const stockId = exactMatch ? exactMatch.id : stocks[0].id;
      console.log(`[whalewisdom] S2 Resolved ${ticker} -> Stock ID: ${stockId} (via fallback match: ${exactMatch ? exactMatch.name : stocks[0].name})`);
      return stockId;
    } catch (err: any) {
      console.error(`[whalewisdom] Stock lookup failed for ${ticker}:`, err.message);
      throw err;
    }
  }

  /**
   * Fetch 13F holders for a specific stock ID.
   */
  public async getHolders(stockId: number, limit = 10): Promise<WhaleWisdomHolder[]> {
    console.log(`[whalewisdom] Fetching holders for Stock ID: ${stockId} (limit=${limit})`);
    
    interface HoldersResponse {
      results?: Array<{
        filer_name?: string;
        name?: string;
        shares?: number;
        percent_ownership?: number;
        change_shares?: number;
      }>;
    }

    try {
      const data = await this.executeCommand<HoldersResponse>({
        command: "holders",
        stock_ids: [stockId],
        limit: limit,
      });

      const rawResults = data.results ?? [];
      const holders: WhaleWisdomHolder[] = rawResults.map((r) => ({
        holder_name: r.filer_name ?? r.name ?? "Unknown Institution",
        shares: Number(r.shares ?? 0),
        percent_ownership: Number(r.percent_ownership ?? 0),
        change_shares: Number(r.change_shares ?? 0),
      }));

      // Sort by percent ownership descending
      holders.sort((a, b) => b.percent_ownership - a.percent_ownership);
      return holders;
    } catch (err) {
      console.error(`[whalewisdom] Failed to fetch holders for Stock ID ${stockId}:`, err);
      throw err;
    }
  }
}
