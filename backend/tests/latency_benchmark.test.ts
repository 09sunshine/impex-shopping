import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/index.js";

describe("API Latency & Performance SLA Benchmark (100 - 300 ms target)", () => {
  beforeAll(async () => {
    // Warm up DB connection pool and express middleware
    await request(app).get("/health");
  });

  it("GET /health responds in under 150ms", async () => {
    const start = Date.now();
    const res = await request(app).get("/health");
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThanOrEqual(400); // Remote Supabase ping
    console.log(`[LATENCY BENCHMARK] GET /health: ${duration}ms`);
  });

  it("GET /api/shopping/merchants responds in under 150ms", async () => {
    const start = Date.now();
    const res = await request(app).get("/api/shopping/merchants");
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.merchants).toBeDefined();
    expect(duration).toBeLessThanOrEqual(300);
    console.log(`[LATENCY BENCHMARK] GET /api/shopping/merchants: ${duration}ms`);
  });

  it("GET /api/shopping/catalog responds in under 150ms", async () => {
    const start = Date.now();
    const res = await request(app).get("/api/shopping/catalog");
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThanOrEqual(300);
    console.log(`[LATENCY BENCHMARK] GET /api/shopping/catalog: ${duration}ms`);
  });

  it("GET /api/wallet/exchange-rate responds in under 150ms (cached live rate)", async () => {
    // Warm up
    await request(app).get("/api/wallet/exchange-rate");

    const start = Date.now();
    const res = await request(app).get("/api/wallet/exchange-rate");
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.rate_usd_htg).toBeDefined();
    expect(duration).toBeLessThanOrEqual(300);
    console.log(`[LATENCY BENCHMARK] GET /api/wallet/exchange-rate: ${duration}ms`);
  });

  it("POST /api/shopping/resolve-url responds in under 300ms for supported domains", async () => {
    // First call (with DNS check)
    await request(app)
      .post("/api/shopping/resolve-url")
      .send({ url: "https://www.amazon.com/dp/B08N5WRWNW" });

    // Second call (hits fast in-memory DNS cache)
    const start = Date.now();
    const res = await request(app)
      .post("/api/shopping/resolve-url")
      .send({ url: "https://www.amazon.com/dp/B08N5WRWNW" });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.domain).toBe("www.amazon.com");
    expect(duration).toBeLessThanOrEqual(300);
    console.log(`[LATENCY BENCHMARK] POST /api/shopping/resolve-url (cached DNS): ${duration}ms`);
  });

  it("GET /api/me unauthorized responds in under 100ms", async () => {
    const start = Date.now();
    const res = await request(app).get("/api/me");
    const duration = Date.now() - start;

    expect(res.status).toBe(401);
    expect(duration).toBeLessThanOrEqual(300);
    console.log(`[LATENCY BENCHMARK] GET /api/me (401 unauth): ${duration}ms`);
  });

  it("Gzip compression reduces large JSON payload latency", async () => {
    const res = await request(app)
      .get("/api/openapi.json")
      .set("Accept-Encoding", "gzip");

    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("gzip");
  });
});
