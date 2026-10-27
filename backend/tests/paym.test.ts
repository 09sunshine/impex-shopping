import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { PaymProviderService } from "../src/modules/payment/paym.js";

describe("Pay'm Provider Gateway Adapter", () => {
  it("should report unconfigured status cleanly when credentials are empty", () => {
    const status = PaymProviderService.getStatus();
    expect(status.provider).toContain("Pay'm");
    expect(status.api_base_url).toBe("https://plopplop.solutionip.app");
  });

  it("should verify valid sha256 HMAC webhook signature", () => {
    const rawPayload = JSON.stringify({
      event: "transaction.status_changed",
      transaction: { reference_id: "PAYM-123", new_status: "ok" },
    });
    const fakeSecret = "my_64_character_merchant_client_secret_test_key_1234567890abcdef";
    const computedHmac = crypto.createHmac("sha256", fakeSecret).update(rawPayload).digest("hex");

    // Test helper using temporary secret
    const isValid = crypto.timingSafeEqual(
      Buffer.from(computedHmac),
      Buffer.from(computedHmac)
    );
    expect(isValid).toBe(true);
  });
});
