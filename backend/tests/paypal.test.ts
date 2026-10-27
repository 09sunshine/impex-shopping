import { describe, it, expect, afterAll } from "vitest";
import { PayPalService } from "../src/modules/payment/paypal.js";
import { query, pool } from "../src/db/connection.js";

describe("PayPal Integration & Security Controls", () => {
  afterAll(async () => {
    // Clean up any test attempts created
    await query(`DELETE FROM payment_attempts WHERE internal_reference LIKE 'PAYPAL-%' AND amount = 50.00`);
  });

  it("should authenticate and generate a valid access token", async () => {
    if (!process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID.includes("placeholder") || !process.env.PAYPAL_CLIENT_SECRET) {
      console.warn("[Test Notice] PAYPAL_CLIENT_ID/SECRET not configured with live credentials. Skipping token generation test.");
      return;
    }
    try {
      const token = await PayPalService.getAccessToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(10);
    } catch (err: any) {
      if (err?.message?.includes("Unauthorized")) {
        console.warn("[Test Notice] PayPal credentials unauthorized. Skipping live sandbox check.");
        return;
      }
      throw err;
    }
  });

  it("should enforce deposit amount boundaries (reject <= 0 and > $10,000)", async () => {
    await expect(
      PayPalService.createDepositOrder({
        walletId: "00000000-0000-0000-0000-000000000001",
        customerId: "00000000-0000-0000-0000-000000000002",
        amount: 0,
      })
    ).rejects.toThrow("Deposit amount must be greater than $0.");

    await expect(
      PayPalService.createDepositOrder({
        walletId: "00000000-0000-0000-0000-000000000001",
        customerId: "00000000-0000-0000-0000-000000000002",
        amount: -50,
      })
    ).rejects.toThrow("Deposit amount must be greater than $0.");

    await expect(
      PayPalService.createDepositOrder({
        walletId: "00000000-0000-0000-0000-000000000001",
        customerId: "00000000-0000-0000-0000-000000000002",
        amount: 15000,
      })
    ).rejects.toThrow("Single deposit amount cannot exceed $10,000.00 USD.");
  });

  it(
    "should create a live sandbox checkout order and return an approve URL",
    async () => {
    if (!process.env.PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID.includes("placeholder") || !process.env.PAYPAL_CLIENT_SECRET) {
      console.warn("[Test Notice] PayPal credentials not configured. Skipping sandbox order test.");
      return;
    }
    // Fetch a real wallet from DB
    const wRes = await query(`SELECT id, customer_id FROM wallet_accounts LIMIT 1`);
    if (wRes.rows.length === 0) {
      console.warn("No wallet found in DB, skipping order insertion check");
      return;
    }
    const realWallet = wRes.rows[0];

    try {
      const result = await PayPalService.createDepositOrder({
        walletId: realWallet.id,
        customerId: realWallet.customer_id,
        amount: 50.0,
        currency: "USD",
      });

      expect(result.status).toBe("CREATED");
      expect(result.amount).toBe(50.0);
      expect(result.currency).toBe("USD");
      expect(result.provider_reference).toBeDefined();
      expect(result.checkout_url).toContain("paypal.com");
      expect(result.payment_reference).toMatch(/^PAYPAL-\d+-[A-F0-9]+$/);
    } catch (err: any) {
      if (err?.message?.includes("Unauthorized")) {
        console.warn("[Test Notice] PayPal credentials unauthorized. Skipping sandbox order test.");
        return;
      }
      throw err;
    }
  }, 15000);
});
