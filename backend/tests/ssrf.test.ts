import { describe, it, expect } from "vitest";
import { validateAndNormalizeProductUrl, isIpSafe } from "../src/modules/product-engine/ssrf.js";

describe("SSRF Protection & URL Normalization", () => {
  it("should validate and recognize Amazon US product URLs", async () => {
    const res = await validateAndNormalizeProductUrl("https://www.amazon.com/dp/B08N5WRWNW?tag=fakeaffiliate");
    expect(res.isValid).toBe(true);
    expect(res.merchant_slug).toBe("amazon");
    expect(res.merchant_name).toBe("Amazon US");
    expect(res.cleaned_url).not.toContain("tag=fakeaffiliate");
  });

  it("should validate and recognize SHEIN product URLs", async () => {
    const res = await validateAndNormalizeProductUrl("https://us.shein.com/goods-p-12345.html");
    expect(res.isValid).toBe(true);
    expect(res.merchant_slug).toBe("shein");
    expect(res.merchant_name).toBe("SHEIN US");
  });

  it("should validate all 8 target merchants", async () => {
    const testCases = [
      { url: "https://www.aliexpress.com/item/100500123.html", slug: "aliexpress" },
      { url: "https://www.ebay.com/itm/1234567890", slug: "ebay" },
      { url: "https://www.fashionnova.com/products/classic-dress", slug: "fashionnova" },
      { url: "https://www2.hm.com/en_us/productpage.12345.html", slug: "hm" },
      { url: "https://www.temu.com/goods.html?goods_id=60109", slug: "temu" },
      { url: "https://www.walmart.com/ip/Wireless-Earbuds/123456", slug: "walmart" },
    ];

    for (const tc of testCases) {
      const res = await validateAndNormalizeProductUrl(tc.url);
      expect(res.isValid).toBe(true);
      expect(res.merchant_slug).toBe(tc.slug);
    }
  }, 20000);

  it("should block localhost and private network addresses (SSRF)", async () => {
    const blockedUrls = [
      "http://localhost:8000/admin",
      "http://127.0.0.1:5432",
      "http://10.0.0.1/secret",
      "http://192.168.1.1/config",
      "http://169.254.169.254/latest/meta-data/", // AWS metadata service
      "http://internal.service.local/",
    ];

    for (const url of blockedUrls) {
      const res = await validateAndNormalizeProductUrl(url);
      expect(res.isValid).toBe(false);
    }
  });

  it("should correctly identify safe vs dangerous IPs", () => {
    expect(isIpSafe("8.8.8.8")).toBe(true);
    expect(isIpSafe("104.244.42.1")).toBe(true);
    expect(isIpSafe("127.0.0.1")).toBe(false);
    expect(isIpSafe("10.1.2.3")).toBe(false);
    expect(isIpSafe("192.168.0.100")).toBe(false);
    expect(isIpSafe("169.254.169.254")).toBe(false);
  });
});
