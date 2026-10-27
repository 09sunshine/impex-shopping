import { describe, it, expect } from "vitest";
import { ProductEngineService } from "../src/modules/product-engine/engine.js";

describe("Product Engine & Quote Calculation", () => {
  it("should calculate quote totals accurately with fees and discount", () => {
    const quote = ProductEngineService.calculateQuote({
      verified_product_price: 100.0,
      verified_shipping_cost: 10.0,
      verified_tax: 7.0,
      service_fee: 15.0,
      international_fee: 20.0,
      delivery_fee: 5.0,
      discount: 10.0,
      exchange_rate: 132.5,
      valid_minutes: 60,
    });

    // 100 + 10 + 7 + 15 + 20 + 5 - 10 = 147.00
    expect(quote.product_price).toBe(100.0);
    expect(quote.total).toBe(147.0);
    expect(quote.total_htg).toBe(Math.round(147.0 * 132.5 * 100) / 100);
    expect(new Date(quote.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("should apply default service fee when unspecified", () => {
    const quote = ProductEngineService.calculateQuote({
      verified_product_price: 50.0,
      verified_shipping_cost: 0,
      verified_tax: 0,
    });

    // 8% of 50 is 4, but minimum is 5.00
    expect(quote.service_fee).toBe(5.0);
    expect(quote.total).toBe(55.0);
  });
});
