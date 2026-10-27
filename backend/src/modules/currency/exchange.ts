interface ExchangeRateDetails {
  rate_usd_htg: number;
  last_updated: string;
  provider: string;
  base: string;
  target: string;
  is_live: boolean;
}

export class ExchangeRateService {
  private static cachedRate: number = 130.98;
  private static lastFetchTime: number = 0;
  private static lastProvider: string = "open.er-api.com";
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache
  private static isFetching: Promise<number> | null = null;

  /**
   * Fetches the real-time live exchange rate from financial APIs.
   * Uses caching with 15-minute TTL to ensure fast responses and resilient fallbacks.
   */
  public static async getLiveRate(forceRefresh: boolean = false): Promise<number> {
    const now = Date.now();
    if (!forceRefresh && this.cachedRate && (now - this.lastFetchTime < this.CACHE_TTL_MS)) {
      return this.cachedRate;
    }

    if (this.isFetching) {
      return this.isFetching;
    }

    this.isFetching = (async () => {
      try {
        // Provider 1: open.er-api.com
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        try {
          const res = await fetch("https://open.er-api.com/v6/latest/USD", {
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data: any = await res.json();
            const htg = data?.rates?.HTG;
            if (typeof htg === "number" && htg > 50 && htg < 300) {
              this.cachedRate = Math.round(htg * 100) / 100;
              this.lastFetchTime = Date.now();
              this.lastProvider = "open.er-api.com";
              return this.cachedRate;
            }
          }
        } catch (p1Err) {
          console.warn("[ExchangeRateService] Primary API error, attempting fallback:", p1Err);
        }

        // Provider 2: api.exchangerate-api.com
        const fbController = new AbortController();
        const fbTimeout = setTimeout(() => fbController.abort(), 4000);

        try {
          const fbRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", {
            signal: fbController.signal,
          });
          clearTimeout(fbTimeout);

          if (fbRes.ok) {
            const fbData: any = await fbRes.json();
            const htg = fbData?.rates?.HTG;
            if (typeof htg === "number" && htg > 50 && htg < 300) {
              this.cachedRate = Math.round(htg * 100) / 100;
              this.lastFetchTime = Date.now();
              this.lastProvider = "api.exchangerate-api.com";
              return this.cachedRate;
            }
          }
        } catch (p2Err) {
          console.warn("[ExchangeRateService] Secondary API error:", p2Err);
        }

        return this.cachedRate;
      } finally {
        this.isFetching = null;
      }
    })();

    return this.isFetching;
  }

  /**
   * Synchronous accessor for currently cached rate (guaranteed non-blocking).
   */
  public static getCachedRate(): number {
    // Proactively refresh in background if expired
    if (Date.now() - this.lastFetchTime > this.CACHE_TTL_MS) {
      this.getLiveRate().catch(() => {});
    }
    return this.cachedRate;
  }

  /**
   * Get complete structured exchange rate payload for API consumers.
   */
  public static async getRateDetails(forceRefresh: boolean = false): Promise<ExchangeRateDetails> {
    const rate = await this.getLiveRate(forceRefresh);
    return {
      rate_usd_htg: rate,
      last_updated: new Date(this.lastFetchTime || Date.now()).toISOString(),
      provider: this.lastProvider,
      base: "USD",
      target: "HTG",
      is_live: this.lastFetchTime > 0,
    };
  }

  /**
   * Convert USD to HTG using current live exchange rate or explicit rate.
   */
  public static convertUsdToHtg(amountUsd: number, customRate?: number): number {
    const rate = customRate || this.getCachedRate();
    return Math.round(amountUsd * rate * 100) / 100;
  }

  /**
   * Convert HTG to USD using current live exchange rate or explicit rate.
   */
  public static convertHtgToUsd(amountHtg: number, customRate?: number): number {
    const rate = customRate || this.getCachedRate();
    if (!rate || rate <= 0) return 0;
    return Math.round((amountHtg / rate) * 100) / 100;
  }
}
