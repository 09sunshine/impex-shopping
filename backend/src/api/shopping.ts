import { Router, Request, Response } from "express";
import multer from "multer";
import { authenticateRequest, requireAuth, requireCustomer } from "../middleware/auth.js";
import { validateAndNormalizeProductUrl } from "../modules/product-engine/ssrf.js";
import { MerchantRegistry } from "../modules/product-engine/merchants.js";
import { ProductEngineService } from "../modules/product-engine/engine.js";
import { ScreenshotAttachmentService } from "../modules/product-engine/attachments.js";
import { OrderWorkflowService } from "../modules/orders/service.js";
import { query } from "../db/connection.js";
import { config } from "../config/index.js";

export const shoppingRouter = Router();

// Multer memory storage for validating magic bytes before saving to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * GET /api/shopping/merchants
 * Lists all supported international merchants.
 */
shoppingRouter.get("/merchants", async (_req: Request, res: Response) => {
  const merchants = MerchantRegistry.getMerchantsOverview();
  res.json({ merchants });
});

/**
 * GET /api/shopping/catalog
 * Search catalog products imported via feeds or official partner APIs.
 * In url_only mode, catalog browsing is disabled.
 */
shoppingRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    if (config.PRODUCT_SOURCE_MODE === "url_only") {
      res.json({
        total: 0,
        items: [],
        products: [],
        mode: "url_only",
        message: "Catalog browsing is temporarily disabled in URL-only mode. Please paste a product link to order.",
      });
      return;
    }

    const q = req.query.q as string | undefined;
    const merchant = req.query.merchant as string | undefined;
    const category = req.query.category as string | undefined;
    const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : undefined;
    const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await ProductEngineService.searchCatalog({
      query: q,
      merchantSlug: merchant,
      category,
      minPrice,
      maxPrice,
      limit,
      offset,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Catalog search failed", detail: err.message });
  }
});

/**
 * POST /api/shopping/resolve-url
 * Safely inspects, validates, and normalizes a product URL with SSRF defense.
 */
shoppingRouter.post("/resolve-url", async (req: Request, res: Response) => {
  try {
    const rawUrl = req.body.url || req.body.product_url;
    if (!rawUrl) {
      res.status(400).json({ detail: "Veuillez fournir une URL de produit." });
      return;
    }

    const urlInfo = await validateAndNormalizeProductUrl(rawUrl);
    if (!urlInfo.isValid) {
      res.status(400).json({ detail: urlInfo.error || "URL invalide ou non sécurisée." });
      return;
    }

    res.json({
      status: "success",
      cleaned_url: urlInfo.cleaned_url,
      domain: urlInfo.domain,
      merchant_name: urlInfo.merchant_name,
      merchant_slug: urlInfo.merchant_slug,
      is_supported: urlInfo.is_recognized,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to resolve product URL", detail: err.message });
  }
});

/**
 * POST /api/shopping/screenshots/upload
 * Sanitizes and uploads screenshot: magic bytes check, strips EXIF, stores in private storage.
 */
shoppingRouter.post(
  "/screenshots/upload",
  authenticateRequest,
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        res.status(400).json({ error: "No image file provided in upload" });
        return;
      }

      const attachment = await ScreenshotAttachmentService.saveScreenshot(
        req.file.buffer,
        req.file.originalname,
        req.user?.id
      );

      res.status(201).json({
        attachment_id: attachment.id,
        original_filename: attachment.original_filename,
        file_size_bytes: attachment.file_size_bytes,
        mime_type: attachment.mime_type,
        image_width: attachment.image_width,
        image_height: attachment.image_height,
        sha256_hash: attachment.sha256_hash,
        created_at: attachment.created_at,
        preview_url: `/api/shopping/screenshots/${attachment.id}`,
      });
    } catch (err: any) {
      res.status(400).json({ error: "Screenshot upload rejected", detail: err.message });
    }
  }
);

/**
 * GET /api/shopping/screenshots/:attachmentId
 * Download/view product screenshot (serves inline image for previews and operator reviews).
 */
shoppingRouter.get(
  "/screenshots/:attachmentId",
  authenticateRequest,
  async (req: Request, res: Response) => {
    try {
      const fileInfo = await ScreenshotAttachmentService.getAttachmentForUser(
        req.params.attachmentId,
        req.user?.id,
        req.user?.isStaff
      );

      if (fileInfo.isRemote && fileInfo.remoteUrl) {
        res.redirect(fileInfo.remoteUrl);
        return;
      }

      res.setHeader("Content-Type", fileInfo.mimeType);
      res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      res.setHeader("Content-Disposition", `inline; filename="${fileInfo.originalFilename}"`);
      res.sendFile(fileInfo.filePath);
    } catch (err: any) {
      res.status(404).json({ error: "Attachment not found or access denied", detail: err.message });
    }
  }
);

/**
 * Shared handler for submitting an international order/request by URL.
 */
export const handleProductRequestSubmission = async (req: Request, res: Response) => {
  try {
    const rawUrl = req.body.product_url || req.body.url;
    const merchantName = req.body.merchant_name || req.body.merchant;
    const productName = req.body.product_name || req.body.name || req.body.description;
    const rawQty = req.body.quantity !== undefined ? req.body.quantity : 1;
    const parsedQty = parseInt(rawQty, 10);

    if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
      res.status(400).json({ error: "Validation error", detail: "Product URL is required" });
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      res.status(400).json({ error: "Validation error", detail: "Quantity must be a positive integer" });
      return;
    }

    // Ensure customer profile is resolved
    let customerId = req.user?.customerId;
    if (!customerId && req.user?.id) {
      const profRes = await query(`SELECT id FROM customer_profiles WHERE user_id = $1`, [req.user.id]);
      if (profRes.rows.length > 0) {
        customerId = profRes.rows[0].id;
      } else {
        const newProf = await query(
          `INSERT INTO customer_profiles (user_id, first_name, last_name) VALUES ($1, $2, $3) RETURNING id`,
          [req.user.id, req.user.first_name || "Shopper", req.user.last_name || "User"]
        );
        customerId = newProf.rows[0].id;
      }
      req.user.customerId = customerId;
    }

    if (!customerId) {
      res.status(404).json({ error: "Customer profile not found" });
      return;
    }

    const recipientName = (req.body.recipient_name || req.body.customer_name || "").trim();
    const contactPhone = (req.body.contact_phone || req.body.phone || req.body.phone_number || "").trim();

    // If recipient name or contact phone provided, update customer profile if not currently set
    if (contactPhone || recipientName) {
      const nameParts = recipientName.split(" ");
      const fName = nameParts[0] || undefined;
      const lName = nameParts.slice(1).join(" ") || undefined;
      await query(
        `UPDATE customer_profiles 
         SET phone = COALESCE(phone, $1),
             first_name = COALESCE(first_name, $2),
             last_name = COALESCE(last_name, $3)
         WHERE id = $4`,
        [contactPhone || null, fName || null, lName || null, customerId]
      );
    }

    // Support creating and selecting a new delivery address on-the-fly while ordering
    let finalAddressId = req.body.selected_address_id;
    if (req.body.new_address && typeof req.body.new_address === "object") {
      const na = req.body.new_address;
      const street = (na.street || na.address_line || na.house || "").trim();
      if (street) {
        const insAddr = await query(
          `INSERT INTO addresses (user_id, label, recipient_name, phone, country, state, city, street, postal_code, is_primary)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            req.user!.id,
            na.label || "Delivery",
            na.recipient_name || recipientName || req.user?.name || "Recipient",
            na.phone || contactPhone || "",
            na.country || "Haiti",
            na.state || "Ouest",
            na.city || "Port-au-Prince",
            street,
            na.postal_code || "HT6110",
            !!na.is_primary,
          ]
        );
        if (insAddr.rows.length > 0) {
          finalAddressId = insAddr.rows[0].id;
        }
      }
    }

    const specifications = req.body.specifications || req.body.variant_details || {};
    const variant = req.body.variant || req.body.model;
    const size = req.body.size;
    const color = req.body.color;
    const notes = req.body.notes || req.body.additional_instructions || req.body.instructions;

    // Support single and multiple reference screenshots (up to 3)
    let screenshotAttachmentIds: string[] = [];
    if (Array.isArray(req.body.screenshot_attachment_ids)) {
      screenshotAttachmentIds = req.body.screenshot_attachment_ids.filter((id: any) => typeof id === "string" && id.trim().length > 0);
    } else if (typeof req.body.screenshot_attachment_ids === "string") {
      screenshotAttachmentIds = req.body.screenshot_attachment_ids.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    const singleScreenshotId = req.body.screenshot_attachment_id || req.body.reference_screenshot;
    if (singleScreenshotId && !screenshotAttachmentIds.includes(singleScreenshotId)) {
      screenshotAttachmentIds.unshift(singleScreenshotId);
    }
    const screenshotAttachmentId = screenshotAttachmentIds[0] || singleScreenshotId || undefined;
    if (screenshotAttachmentIds.length > 0) {
      specifications.screenshot_attachment_ids = screenshotAttachmentIds;
    }

    const idempotencyKey = req.body.idempotency_key;

    const order = await OrderWorkflowService.submitOrderByUrl({
      customerId,
      productUrl: rawUrl.trim(),
      productName: productName?.trim(),
      merchantName: merchantName?.trim(),
      specifications,
      variant: variant?.trim(),
      size: size?.trim(),
      color: color?.trim(),
      quantity: parsedQty,
      customerEstimatedPrice: req.body.customer_estimated_price ? parseFloat(req.body.customer_estimated_price) : 0,
      customerEstimatedCurrency: req.body.customer_estimated_currency || "USD",
      notes: notes?.trim(),
      screenshotAttachmentId: screenshotAttachmentId?.trim(),
      selectedAddressId: finalAddressId,
      idempotencyKey,
      actorUserId: req.user!.id,
      reserveFunds: req.body.reserve_funds === true || req.body.auto_reserve === true,
    });

    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({ error: "Failed to submit product request", detail: err.message });
  }
};

/**
 * POST /api/shopping/orders
 * POST /api/shopping/product-requests
 * Customer submits an international order / product request by URL.
 */
shoppingRouter.post("/orders", authenticateRequest, requireCustomer, handleProductRequestSubmission);
shoppingRouter.post("/product-requests", authenticateRequest, requireCustomer, handleProductRequestSubmission);

/**
 * POST /api/shopping/orders/screenshot
 * Customer submits an order based on an uploaded screenshot.
 */
shoppingRouter.post(
  "/orders/screenshot",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const {
        screenshot_attachment_id,
        product_description,
        product_name,
        merchant_name,
        specifications,
        variant,
        size,
        color,
        quantity,
        customer_estimated_price,
        customer_estimated_currency,
        notes,
        selected_address_id,
        idempotency_key,
      } = req.body;

      if (!screenshot_attachment_id) {
        res.status(400).json({ detail: "Screenshot attachment ID is required" });
        return;
      }

      const order = await OrderWorkflowService.submitOrderByScreenshot({
        customerId: req.user!.customerId!,
        screenshotAttachmentId: screenshot_attachment_id,
        productDescription: product_description || product_name || "Screenshot Order",
        productName: product_name,
        merchantName: merchant_name,
        specifications,
        variant,
        size,
        color,
        quantity: quantity ? parseInt(quantity, 10) : 1,
        customerEstimatedPrice: customer_estimated_price ? parseFloat(customer_estimated_price) : 0,
        customerEstimatedCurrency: customer_estimated_currency || "USD",
        notes,
        selectedAddressId: selected_address_id,
        idempotencyKey: idempotency_key,
        actorUserId: req.user!.id,
      });

      res.status(201).json(order);
    } catch (err: any) {
      res.status(400).json({ error: "Failed to submit screenshot order", detail: err.message });
    }
  }
);

/**
 * GET /api/shopping/orders
 * List orders strictly belonging to the authenticated customer (IDOR protected).
 */
shoppingRouter.get(
  "/orders",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      let whereClause = "WHERE customer_id = $1";
      const params: any[] = [req.user!.customerId];

      if (statusFilter) {
        params.push(statusFilter);
        whereClause += ` AND status = $${params.length}`;
      }

      const countRes = await query(`SELECT COUNT(*) FROM orders ${whereClause}`, params);
      const total = parseInt(countRes.rows[0].count, 10);

      const ordersRes = await query(
        `SELECT id FROM orders ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      const orders = await Promise.all(
        ordersRes.rows.map((row) => OrderWorkflowService.serializeOrder(row.id))
      );

      res.json({ total, orders });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch orders", detail: err.message });
    }
  }
);

/**
 * GET /api/shopping/orders/:orderId
 * Get single order details with versioned quotes and events (IDOR protected).
 */
shoppingRouter.get(
  "/orders/:orderId",
  authenticateRequest,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const order = await OrderWorkflowService.serializeOrder(req.params.orderId);

      // IDOR check: Customer can only access their own order
      if (!req.user!.isStaff) {
        const orderRes = await query(`SELECT customer_id FROM orders WHERE id = $1`, [order.id]);
        if (orderRes.rows.length === 0 || orderRes.rows[0].customer_id !== req.user!.customerId) {
          res.status(404).json({ detail: "Commande introuvable." });
          return;
        }
      }

      res.json(order);
    } catch (err: any) {
      res.status(404).json({ detail: "Commande introuvable." });
    }
  }
);

/**
 * POST /api/shopping/orders/:orderId/confirm-quote
 * Customer accepts official quote. Atomically reserves wallet funds.
 */
shoppingRouter.post(
  "/orders/:orderId/confirm-quote",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const { quote_id, idempotency_key } = req.body;
      const order = await OrderWorkflowService.confirmQuote(
        req.params.orderId,
        req.user!.customerId!,
        quote_id,
        idempotency_key,
        req.user!.id
      );
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
    }
  }
);

/**
 * POST /api/shopping/orders/:orderId/confirm-price-change
 * Customer accepts revised price quote after pre-purchase validation.
 */
shoppingRouter.post(
  "/orders/:orderId/confirm-price-change",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const { quote_id, idempotency_key } = req.body;
      const order = await OrderWorkflowService.confirmQuote(
        req.params.orderId,
        req.user!.customerId!,
        quote_id,
        idempotency_key,
        req.user!.id
      );
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
    }
  }
);

/**
 * POST /api/shopping/orders/:orderId/decline-quote
 * Customer explicitly declines quote. Releases any reserved funds and marks quote REJECTED.
 */
shoppingRouter.post(
  "/orders/:orderId/decline-quote",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const order = await OrderWorkflowService.declineQuoteOrCancel(
        req.params.orderId,
        req.user!.customerId!,
        reason || "Customer declined quote",
        req.user!.id
      );
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
    }
  }
);

/**
 * POST /api/shopping/orders/:orderId/cancel
 * Customer cancels order before purchase.
 */
shoppingRouter.post(
  "/orders/:orderId/cancel",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const order = await OrderWorkflowService.declineQuoteOrCancel(
        req.params.orderId,
        req.user!.customerId!,
        reason || "Annulation demandée par le client.",
        req.user!.id
      );
      res.json(order);
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
    }
  }
);

/**
 * GET /api/shopping/orders/:orderId/events
 * Retrieve immutable audit event history for an order.
 */
shoppingRouter.get(
  "/orders/:orderId/events",
  authenticateRequest,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const order = await OrderWorkflowService.serializeOrder(req.params.orderId);
      if (!req.user!.isStaff) {
        const orderRes = await query(`SELECT customer_id FROM orders WHERE id = $1`, [order.id]);
        if (orderRes.rows.length === 0 || orderRes.rows[0].customer_id !== req.user!.customerId) {
          res.status(404).json({ detail: "Commande introuvable." });
          return;
        }
      }
      res.json(order.events);
    } catch (err: any) {
      res.status(404).json({ detail: "Commande introuvable." });
    }
  }
);

/**
 * POST /api/shopping/orders/:orderId/delivery-request
 * Customer requests home delivery in Haiti.
 */
shoppingRouter.post(
  "/orders/:orderId/delivery-request",
  authenticateRequest,
  requireCustomer,
  async (req: Request, res: Response) => {
    try {
      const { delivery_address_id, delivery_notes } = req.body;
      const orderId = req.params.orderId;

      const orderRes = await query(
        `SELECT * FROM orders WHERE id = $1 AND customer_id = $2`,
        [orderId, req.user!.customerId]
      );
      if (orderRes.rows.length === 0) {
        res.status(404).json({ detail: "Commande introuvable." });
        return;
      }

      const deliveryNumber = `DEL-${Date.now().toString().slice(-6)}`;
      const deliveryFeeUsd = 10.0;
      const deliveryFeeHtg = 1325.0;

      await query(
        `UPDATE orders 
         SET delivery_status = 'REQUESTED',
             delivery_fee = $1,
             updated_at = NOW() 
         WHERE id = $2`,
        [deliveryFeeUsd, orderId]
      );

      await OrderWorkflowService.logEvent(
        orderId,
        "DELIVERY_REQUESTED",
        "REQUESTED",
        "customer",
        req.user!.id,
        { delivery_address_id, delivery_notes, delivery_number: deliveryNumber }
      );

      res.json({
        success: true,
        delivery_number: deliveryNumber,
        delivery_fee_usd: deliveryFeeUsd,
        delivery_fee_htg: deliveryFeeHtg,
        status: "REQUESTED",
        message: `Livraison à domicile demandée #${deliveryNumber}.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Delivery request failed", detail: err.message });
    }
  }
);
