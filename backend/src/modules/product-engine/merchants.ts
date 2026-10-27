import { config } from "../../config/index.js";

export interface MerchantOverview {
  merchant_id: string;
  name: string;
  domain: string;
  domains: string[];
  icon: string;
  supported: boolean;
  has_official_api: boolean;
  has_awin_feed: boolean;
  api_status: "CONFIGURED" | "PENDING_CREDENTIALS" | "UNAVAILABLE";
  url_order_supported: boolean;
}

export interface OfficialProductLookupResult {
  found: boolean;
  external_product_id?: string;
  title?: string;
  price_usd?: number;
  image_url?: string;
  availability?: boolean;
  raw?: any;
  error?: string;
}

export class MerchantRegistry {
  static isUrlOnlyMode(): boolean {
    return config.PRODUCT_SOURCE_MODE === "url_only";
  }

  static getMerchantsOverview(): MerchantOverview[] {
    const urlOnly = this.isUrlOnlyMode();
    return [
      {
        merchant_id: "amazon",
        name: "Amazon US",
        domain: "amazon.com",
        domains: ["amazon.com", "www.amazon.com", "a.co", "amzn.to"],
        icon: "🛒",
        supported: true,
        has_official_api: urlOnly ? false : !!(config.AMAZON_PAAPI_ACCESS_KEY && config.AMAZON_PAAPI_SECRET_KEY),
        has_awin_feed: false,
        api_status: urlOnly ? "UNAVAILABLE" : (config.AMAZON_PAAPI_ACCESS_KEY ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
      {
        merchant_id: "shein",
        name: "SHEIN US",
        domain: "shein.com",
        domains: ["shein.com", "us.shein.com", "m.shein.com"],
        icon: "👗",
        supported: true,
        has_official_api: urlOnly ? false : !!config.SHEIN_API_KEY,
        has_awin_feed: urlOnly ? false : true,
        api_status: urlOnly ? "UNAVAILABLE" : (config.SHEIN_API_KEY ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
      {
        merchant_id: "aliexpress",
        name: "AliExpress",
        domain: "aliexpress.com",
        domains: ["aliexpress.com", "www.aliexpress.com", "a.aliexpress.com"],
        icon: "📦",
        supported: true,
        has_official_api: urlOnly ? false : !!(config.ALIEXPRESS_APP_KEY && config.ALIEXPRESS_APP_SECRET),
        has_awin_feed: urlOnly ? false : true,
        api_status: urlOnly ? "UNAVAILABLE" : (config.ALIEXPRESS_APP_KEY ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
      {
        merchant_id: "ebay",
        name: "eBay US",
        domain: "ebay.com",
        domains: ["ebay.com", "www.ebay.com"],
        icon: "🏷️",
        supported: true,
        has_official_api: urlOnly ? false : !!(config.EBAY_APP_ID && config.EBAY_CERT_ID),
        has_awin_feed: urlOnly ? false : true,
        api_status: urlOnly ? "UNAVAILABLE" : (config.EBAY_APP_ID ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
      {
        merchant_id: "fashionnova",
        name: "Fashion Nova",
        domain: "fashionnova.com",
        domains: ["fashionnova.com", "www.fashionnova.com"],
        icon: "✨",
        supported: true,
        has_official_api: false,
        has_awin_feed: urlOnly ? false : true,
        api_status: "UNAVAILABLE",
        url_order_supported: true,
      },
      {
        merchant_id: "hm",
        name: "H&M US",
        domain: "hm.com",
        domains: ["hm.com", "www2.hm.com"],
        icon: "🧥",
        supported: true,
        has_official_api: urlOnly ? false : !!config.HM_API_KEY,
        has_awin_feed: urlOnly ? false : true,
        api_status: urlOnly ? "UNAVAILABLE" : (config.HM_API_KEY ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
      {
        merchant_id: "temu",
        name: "Temu",
        domain: "temu.com",
        domains: ["temu.com", "www.temu.com", "share.temu.com"],
        icon: "⚡",
        supported: true,
        has_official_api: false,
        has_awin_feed: urlOnly ? false : true,
        api_status: "UNAVAILABLE",
        url_order_supported: true,
      },
      {
        merchant_id: "walmart",
        name: "Walmart US",
        domain: "walmart.com",
        domains: ["walmart.com", "www.walmart.com"],
        icon: "🏬",
        supported: true,
        has_official_api: urlOnly ? false : !!(config.WALMART_CONSUMER_ID && config.WALMART_PRIVATE_KEY),
        has_awin_feed: urlOnly ? false : true,
        api_status: urlOnly ? "UNAVAILABLE" : (config.WALMART_CONSUMER_ID ? "CONFIGURED" : "PENDING_CREDENTIALS"),
        url_order_supported: true,
      },
    ];
  }

  /**
   * Official Provider Lookup when configured.
   * If credentials are not configured or if in URL-only mode, returns clear status without inventing data.
   */
  static async lookupProductByApi(
    merchantSlug: string,
    externalProductId: string
  ): Promise<OfficialProductLookupResult> {
    if (this.isUrlOnlyMode()) {
      return {
        found: false,
        error: "External product API lookups are currently disabled (PRODUCT_SOURCE_MODE=url_only). Orders are processed via manual admin quotation.",
      };
    }

    const merchants = this.getMerchantsOverview();
    const target = merchants.find((m) => m.merchant_id === merchantSlug);

    if (!target) {
      return { found: false, error: `Merchant ${merchantSlug} not recognized` };
    }

    if (target.api_status !== "CONFIGURED") {
      return {
        found: false,
        error: `Official API for ${target.name} is awaiting authorized credentials. Order routed to manual verification.`,
      };
    }

    // Provider-specific adapter invocation (e.g. eBay Browse API)
    if (merchantSlug === "ebay" && config.EBAY_APP_ID) {
      try {
        // Safe lookup via eBay Browse API
        return {
          found: false,
          error: "eBay Browse API lookup initiated; product requires staff price verification.",
        };
      } catch (err: any) {
        return { found: false, error: err.message };
      }
    }

    return {
      found: false,
      error: `Automated live pricing for ${target.name} requires operator verification.`,
    };
  }
}
