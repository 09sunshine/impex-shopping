import { Router, Request, Response } from "express";
import { authenticateRequest, requireAuth } from "../middleware/auth.js";
import { ProductEngineService } from "../modules/product-engine/engine.js";
import { validateAndNormalizeProductUrl } from "../modules/product-engine/ssrf.js";
import { config } from "../config/index.js";

export const commerceRouter = Router();

/**
 * GET /api/commerce/search
 */
commerceRouter.get("/search", async (req: Request, res: Response) => {
  if (config.PRODUCT_SOURCE_MODE === "url_only") {
    res.json({
      products: [],
      total: 0,
      mode: "url_only",
      message: "Catalog search is disabled in URL-only mode. Please paste a product link to order.",
    });
    return;
  }
  const q = (req.query.q || req.query.query) as string | undefined;
  const merchant = req.query.merchant as string | undefined;
  const category = req.query.category as string | undefined;
  const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : undefined;
  const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

  const result = await ProductEngineService.searchCatalog({
    query: q,
    merchantSlug: merchant,
    category,
    minPrice,
    maxPrice,
    limit,
  });

  res.json({
    products: result.items,
    total: result.total,
  });
});

/**
 * POST /api/commerce/quote-url
 */
commerceRouter.post("/quote-url", async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  const urlInfo = await validateAndNormalizeProductUrl(url);
  res.json({
    id: `custom:${Date.now()}`,
    external_product_id: `${Date.now()}`,
    title: `Imported Product (${urlInfo.merchant_name})`,
    name: `Imported Product (${urlInfo.merchant_name})`,
    price: 0.0,
    base_price_usd: 0.0,
    merchant_name: urlInfo.merchant_name,
    product_url: urlInfo.cleaned_url,
    images: [],
    variants: [
      { id: "standard", name: "Standard Model", price_usd: 0.0, attributes: { Option: "Standard" } },
    ],
  });
});

/**
 * In-memory / session cart compatibility
 */
const sessionCarts: Record<string, any[]> = {};

commerceRouter.get("/cart", authenticateRequest, (req: Request, res: Response) => {
  const key = req.user?.id || "guest";
  res.json({ items: sessionCarts[key] || [], total: 0 });
});

commerceRouter.post("/cart/items", authenticateRequest, (req: Request, res: Response) => {
  const key = req.user?.id || "guest";
  if (!sessionCarts[key]) sessionCarts[key] = [];
  const newItem = { id: `item-${Date.now()}`, ...req.body };
  sessionCarts[key].push(newItem);
  res.status(201).json(newItem);
});

commerceRouter.delete("/cart/items/:id", authenticateRequest, (req: Request, res: Response) => {
  const key = req.user?.id || "guest";
  if (sessionCarts[key]) {
    sessionCarts[key] = sessionCarts[key].filter((item) => item.id !== req.params.id);
  }
  res.json({ success: true });
});

commerceRouter.delete("/cart", authenticateRequest, (req: Request, res: Response) => {
  const key = req.user?.id || "guest";
  sessionCarts[key] = [];
  res.json({ success: true });
});
