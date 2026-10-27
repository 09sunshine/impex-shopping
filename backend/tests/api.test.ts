import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("IMPEX API Endpoint Integration Tests", () => {
  it("GET / returns 200 OK message", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("IMPEX");
  });

  it("GET /health returns healthy status and uptime", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("uptime_seconds");
    expect(res.body.version).toBe("2.0.0");
  }, 15000);

  it("GET /api/openapi.json returns valid OpenAPI 3.0 specification", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
    expect(res.body.info.title).toContain("IMPEX");
  });

  it("GET /api/shopping/merchants returns all 8 target merchants", async () => {
    const res = await request(app).get("/api/shopping/merchants");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("merchants");
    const slugs = res.body.merchants.map((m: any) => m.merchant_id);
    expect(slugs).toContain("amazon");
    expect(slugs).toContain("shein");
    expect(slugs).toContain("aliexpress");
    expect(slugs).toContain("ebay");
    expect(slugs).toContain("fashionnova");
    expect(slugs).toContain("hm");
    expect(slugs).toContain("temu");
    expect(slugs).toContain("walmart");
  });

  it("POST /api/shopping/resolve-url inspects and normalizes product URLs with SSRF protection", async () => {
    // Valid Amazon URL
    const goodRes = await request(app)
      .post("/api/shopping/resolve-url")
      .send({ url: "https://www.amazon.com/dp/B08N5WRWNW" });
    expect(goodRes.status).toBe(200);
    expect(goodRes.body.merchant_slug).toBe("amazon");
    expect(goodRes.body.is_supported).toBe(true);

    // Malicious SSRF attempt to internal metadata
    const badRes = await request(app)
      .post("/api/shopping/resolve-url")
      .send({ url: "http://169.254.169.254/latest/meta-data/" });
    expect(badRes.status).toBe(400);
  });

  it("GET /api/wallet/exchange-rate returns current exchange rate", async () => {
    const res = await request(app).get("/api/wallet/exchange-rate");
    expect(res.status).toBe(200);
    expect(typeof res.body.rate_usd_htg).toBe('number');
    expect(res.body.rate_usd_htg).toBeGreaterThan(50);
    expect(res.body.rate_usd_htg).toBeLessThan(500);
  });

  it("GET /api/auth/me requires authentication (returns 401)", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/me alias requires authentication (returns 401)", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  it("GET /api/shopping/catalog returns url_only notice when PRODUCT_SOURCE_MODE=url_only", async () => {
    const res = await request(app).get("/api/shopping/catalog");
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe("url_only");
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });

  it("POST /api/product-requests requires authentication (returns 401)", async () => {
    const res = await request(app)
      .post("/api/product-requests")
      .send({ product_url: "https://www.amazon.com/dp/B08N5WRWNW" });
    expect(res.status).toBe(401);
  });

  it("POST /api/shopping/orders requires authentication (returns 401)", async () => {
    const res = await request(app)
      .post("/api/shopping/orders")
      .send({ product_url: "https://www.amazon.com/dp/B08N5WRWNW" });
    expect(res.status).toBe(401);
  });
});

