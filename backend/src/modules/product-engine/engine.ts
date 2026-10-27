import { query } from "../../db/connection.js";
import { config } from "../../config/index.js";
import { ExchangeRateService } from "../currency/exchange.js";

export interface CatalogItem {
  id: string;
  merchant_slug: string;
  merchant_name: string;
  external_product_id: string;
  title: string;
  name: string;
  description: string;
  price: number;
  base_price_usd: number;
  price_usd: number;
  currency: string;
  image: string | null;
  image_url: string | null;
  primary_image_url: string | null;
  images: string[];
  product_url: string | null;
  is_available: boolean;
  variants: any[];
}

export interface QuoteCalculationInput {
  verified_product_price: number;
  verified_shipping_cost?: number;
  verified_tax?: number;
  service_fee?: number;
  international_fee?: number;
  delivery_fee?: number;
  discount?: number;
  valid_minutes?: number;
  exchange_rate?: number;
}

export interface CalculatedQuote {
  product_price: number;
  shipping_cost: number;
  tax: number;
  service_fee: number;
  international_fee: number;
  delivery_fee: number;
  discount: number;
  total: number;
  total_htg: number;
  exchange_rate: number;
  expires_at: string;
}

export class ProductEngineService {
  /**
   * Search catalog products with filters.
   */
  static async searchCatalog(params: {
    query?: string;
    merchantSlug?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ total: number; items: CatalogItem[] }> {
    // In url_only mode, automated catalog searches are disabled to focus exclusively on URL ordering
    if (config.PRODUCT_SOURCE_MODE === "url_only") {
      return { total: 0, items: [] };
    }

    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = Math.max(0, params.offset || 0);

    const conditions: string[] = ["is_available = TRUE"];
    const values: any[] = [];

    if (params.query) {
      values.push(`%${params.query}%`);
      conditions.push(`title ILIKE $${values.length}`);
    }

    if (params.merchantSlug) {
      values.push(params.merchantSlug.toLowerCase());
      conditions.push(`merchant_slug = $${values.length}`);
    }

    if (params.category) {
      values.push(`%${params.category}%`);
      conditions.push(`category ILIKE $${values.length}`);
    }

    if (params.minPrice !== undefined && params.minPrice !== null) {
      values.push(params.minPrice);
      conditions.push(`price_usd >= $${values.length}`);
    }

    if (params.maxPrice !== undefined && params.maxPrice !== null) {
      values.push(params.maxPrice);
      conditions.push(`price_usd <= $${values.length}`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countRes = await query(`SELECT COUNT(*) FROM products ${whereSql}`, values);
    const total = parseInt(countRes.rows[0].count, 10);

    const productsRes = await query(
      `SELECT p.*, m.name as merchant_title 
       FROM products p 
       LEFT JOIN merchants m ON m.slug = p.merchant_slug 
       ${whereSql} 
       ORDER BY p.last_synced_at DESC 
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    const items: CatalogItem[] = productsRes.rows.map((row) => {
      const price = Number(row.price_usd);
      const img = row.image_url || (row.images && row.images[0]) || null;
      return {
        id: row.id,
        merchant_slug: row.merchant_slug,
        merchant_name: row.merchant_title || row.merchant_slug,
        external_product_id: row.external_product_id,
        title: row.title,
        name: row.title,
        description: row.description || "",
        price: price,
        base_price_usd: price,
        price_usd: price,
        currency: row.currency || "USD",
        image: img,
        image_url: img,
        primary_image_url: img,
        images: row.images && row.images.length > 0 ? row.images : img ? [img] : [],
        product_url: row.product_url,
        is_available: row.is_available,
        variants: [
          {
            id: "standard",
            name: "Standard Model",
            price_usd: price,
            attributes: { Option: "Standard" },
          },
        ],
      };
    });

    return { total, items };
  }

  /**
   * Authoritative server-side quote calculation.
   * Total is mathematically guaranteed on the backend without trusting client math.
   */
  static calculateQuote(input: QuoteCalculationInput): CalculatedQuote {
    const productPrice = Number(input.verified_product_price);
    const shipping = Number(input.verified_shipping_cost || 0);
    const tax = Number(input.verified_tax || 0);

    // Calculate default service fee if not specified: 8% of product price with $5 minimum
    const serviceFee = input.service_fee !== undefined
      ? Number(input.service_fee)
      : Math.max(5.0, Number((productPrice * 0.08).toFixed(2)));

    const intlFee = Number(input.international_fee || 0);
    const deliveryFee = Number(input.delivery_fee || 0);
    const discount = Number(input.discount || 0);
    const exchangeRate = Number(input.exchange_rate || ExchangeRateService.getCachedRate());
    const validMinutes = Number(input.valid_minutes || 60);

    const subtotal = productPrice + shipping + tax + serviceFee + intlFee + deliveryFee;
    const total = Math.max(0, Number((subtotal - discount).toFixed(2)));
    const totalHtg = Math.round(total * exchangeRate * 100) / 100;
    const expiresAt = new Date(Date.now() + validMinutes * 60 * 1000).toISOString();

    return {
      product_price: productPrice,
      shipping_cost: shipping,
      tax,
      service_fee: serviceFee,
      international_fee: intlFee,
      delivery_fee: deliveryFee,
      discount,
      total,
      total_htg: totalHtg,
      exchange_rate: exchangeRate,
      expires_at: expiresAt,
    };
  }
}
