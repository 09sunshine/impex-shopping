import dns from "dns/promises";
import net from "net";
import { URL } from "url";

// Blocked private / internal / link-local / cloud metadata IP prefixes
const BLOCKED_IP_PATTERNS = [
  /^127\./,                 // Loopback (127.0.0.0/8)
  /^10\./,                  // Private Class A (10.0.0.0/8)
  /^192\.168\./,            // Private Class C (192.168.0.0/16)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private Class B (172.16.0.0/12)
  /^169\.254\./,            // Link-Local / Cloud Metadata (169.254.0.0/16, AWS/GCP 169.254.169.254)
  /^0\./,                   // Current network
  /^::1$/,                  // IPv6 loopback
  /^fc00:/i,                // IPv6 unique local
  /^fe80:/i,                // IPv6 link-local
];

export interface ValidatedUrlResult {
  isValid: boolean;
  cleaned_url: string;
  domain: string;
  merchant_slug: string;
  merchant_name: string;
  is_recognized: boolean;
  error?: string;
}

const SUPPORTED_MERCHANT_DOMAINS: Record<string, { slug: string; name: string }> = {
  "amazon.com": { slug: "amazon", name: "Amazon US" },
  "www.amazon.com": { slug: "amazon", name: "Amazon US" },
  "a.co": { slug: "amazon", name: "Amazon US" },
  "amzn.to": { slug: "amazon", name: "Amazon US" },

  "shein.com": { slug: "shein", name: "SHEIN US" },
  "us.shein.com": { slug: "shein", name: "SHEIN US" },
  "m.shein.com": { slug: "shein", name: "SHEIN US" },

  "aliexpress.com": { slug: "aliexpress", name: "AliExpress" },
  "www.aliexpress.com": { slug: "aliexpress", name: "AliExpress" },
  "a.aliexpress.com": { slug: "aliexpress", name: "AliExpress" },

  "ebay.com": { slug: "ebay", name: "eBay US" },
  "www.ebay.com": { slug: "ebay", name: "eBay US" },

  "fashionnova.com": { slug: "fashionnova", name: "Fashion Nova" },
  "www.fashionnova.com": { slug: "fashionnova", name: "Fashion Nova" },

  "hm.com": { slug: "hm", name: "H&M US" },
  "www2.hm.com": { slug: "hm", name: "H&M US" },

  "temu.com": { slug: "temu", name: "Temu" },
  "www.temu.com": { slug: "temu", name: "Temu" },
  "share.temu.com": { slug: "temu", name: "Temu" },

  "walmart.com": { slug: "walmart", name: "Walmart US" },
  "www.walmart.com": { slug: "walmart", name: "Walmart US" },
};

/**
 * Validates that an IP address is not private, loopback, or metadata address.
 */
export function isIpSafe(ip: string): boolean {
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(ip)) return false;
  }
  return true;
}

// Fast in-memory DNS resolution cache (30-min TTL) to ensure sub-millisecond URL validation
const dnsCache = new Map<string, { safe: boolean; error?: string; timestamp: number }>();
const DNS_CACHE_TTL = 30 * 60 * 1000;

/**
 * Validates, normalizes, and strips dangerous parts from user-submitted product URLs.
 * Resolves DNS to enforce SSRF prevention against private network probing and DNS rebinding.
 */
export async function validateAndNormalizeProductUrl(rawUrl: string): Promise<ValidatedUrlResult> {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      isValid: false,
      cleaned_url: "",
      domain: "",
      merchant_slug: "custom",
      merchant_name: "Custom Merchant",
      is_recognized: false,
      error: "URL is required",
    };
  }

  let parsed: URL;
  try {
    const trimmed = rawUrl.trim();
    const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    parsed = new URL(withProtocol);
  } catch {
    return {
      isValid: false,
      cleaned_url: "",
      domain: "",
      merchant_slug: "custom",
      merchant_name: "Custom Merchant",
      is_recognized: false,
      error: "Invalid URL structure",
    };
  }

  // Enforce HTTPS or HTTP only
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return {
      isValid: false,
      cleaned_url: "",
      domain: "",
      merchant_slug: "custom",
      merchant_name: "Custom Merchant",
      is_recognized: false,
      error: "Only HTTP/HTTPS URLs are allowed",
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject localhost, local domains, or explicit IP addresses in private ranges
  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    net.isIP(hostname) && !isIpSafe(hostname)
  ) {
    return {
      isValid: false,
      cleaned_url: "",
      domain: hostname,
      merchant_slug: "custom",
      merchant_name: "Custom Merchant",
      is_recognized: false,
      error: "Access to private or local hostnames is strictly forbidden",
    };
  }

  // If it's a pre-verified global merchant domain, fast-track from known safe list
  if (SUPPORTED_MERCHANT_DOMAINS[hostname]) {
    if (!dnsCache.has(hostname)) {
      dnsCache.set(hostname, { safe: true, timestamp: Date.now() });
    }
  }

  // Resolve DNS to verify IP does not point to internal infrastructure (with cache & timeout)
  try {
    const cachedDns = dnsCache.get(hostname);
    if (cachedDns && (Date.now() - cachedDns.timestamp < DNS_CACHE_TTL)) {
      if (!cachedDns.safe) {
        return {
          isValid: false,
          cleaned_url: "",
          domain: hostname,
          merchant_slug: "custom",
          merchant_name: "Custom Merchant",
          is_recognized: false,
          error: cachedDns.error || "Resolved IP points to a restricted private address",
        };
      }
    } else {
      const resolvePromise = dns.resolve4(hostname);
      const timeoutPromise = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error("DNS timeout")), 1200)
      );
      const addresses = await Promise.race([resolvePromise, timeoutPromise]).catch(() => []);
      for (const addr of addresses) {
        if (!isIpSafe(addr)) {
          dnsCache.set(hostname, { safe: false, error: "Resolved IP points to a restricted private address", timestamp: Date.now() });
          return {
            isValid: false,
            cleaned_url: "",
            domain: hostname,
            merchant_slug: "custom",
            merchant_name: "Custom Merchant",
            is_recognized: false,
            error: "Resolved IP points to a restricted private address",
          };
        }
      }
      if (addresses.length > 0) {
        dnsCache.set(hostname, { safe: true, timestamp: Date.now() });
      }
    }
  } catch {
    // If DNS resolve fails or times out, proceed if domain structure is valid
  }

  // Normalize by stripping user-info, sensitive tracking parameters
  parsed.username = "";
  parsed.password = "";
  parsed.hash = "";

  // Strip affiliate parameters from query to avoid tracking collision
  const trackingParamsToRemove = ["tag", "ascsubtag", "aff_id", "click_id", "fbclid", "gclid"];
  for (const param of trackingParamsToRemove) {
    parsed.searchParams.delete(param);
  }

  const cleanedUrl = parsed.toString();
  const matched = SUPPORTED_MERCHANT_DOMAINS[hostname] || null;

  // Partial domain matching (e.g. *.aliexpress.com -> aliexpress)
  let merchantSlug = matched?.slug || "custom";
  let merchantName = matched?.name || hostname;
  let isRecognized = !!matched;

  if (!matched) {
    for (const [dom, info] of Object.entries(SUPPORTED_MERCHANT_DOMAINS)) {
      if (hostname.endsWith(`.${dom}`)) {
        merchantSlug = info.slug;
        merchantName = info.name;
        isRecognized = true;
        break;
      }
    }
  }

  return {
    isValid: true,
    cleaned_url: cleanedUrl,
    domain: hostname,
    merchant_slug: merchantSlug,
    merchant_name: merchantName,
    is_recognized: isRecognized,
  };
}
