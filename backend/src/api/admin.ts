import { Router, Request, Response } from "express";
import { authenticateRequest, requireStaff, requireAdmin } from "../middleware/auth.js";
import { OrderWorkflowService } from "../modules/orders/service.js";
import { MerchantRegistry } from "../modules/product-engine/merchants.js";
import { AwinFeedService } from "../modules/product-engine/awin.js";
import { ProductEngineService } from "../modules/product-engine/engine.js";
import { WalletLedgerService } from "../modules/wallet/ledger.js";
import { EmailService } from "../modules/email/service.js";
import { query } from "../db/connection.js";

export const adminRouter = Router();

// Staff authentication required for all admin routes
adminRouter.use(authenticateRequest, requireStaff);

/**
 * GET /api/admin/shopping/stats
 * Overview operational statistics for Order by Link.
 */
adminRouter.get("/shopping/stats", async (_req: Request, res: Response) => {
  try {
    const totalOrdersRes = await query(`SELECT COUNT(*) FROM orders`);
    const countsRes = await query(
      `SELECT status, COUNT(*) as count FROM orders GROUP BY status`
    );

    const counts: Record<string, number> = {};
    for (const row of countsRes.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }

    res.json({
      total_orders: parseInt(totalOrdersRes.rows[0].count, 10),
      submitted: counts["SUBMITTED"] || 0,
      under_review: counts["UNDER_REVIEW"] || 0,
      quote_ready: counts["QUOTE_READY"] || 0,
      funds_reserved: counts["FUNDS_RESERVED"] || 0,
      price_changed: counts["PRICE_CHANGED"] || 0,
      purchased: counts["PURCHASE_COMPLETED"] || 0,
      arrived_in_haiti: counts["ARRIVED_AT_IMPEX"] || 0,
      delivered: counts["DELIVERED"] || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch admin stats", detail: err.message });
  }
});

/**
 * GET /api/admin/shopping/orders
 * List all shopping orders with comprehensive filters.
 */
adminRouter.get("/shopping/orders", async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status_filter as string | undefined;
    const merchantFilter = req.query.merchant_filter as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const conditions: string[] = [];
    const values: any[] = [];

    if (statusFilter) {
      values.push(statusFilter);
      conditions.push(`o.status = $${values.length}`);
    }

    if (merchantFilter) {
      values.push(`%${merchantFilter}%`);
      conditions.push(`o.merchant_name ILIKE $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(o.order_number ILIKE $${values.length} OR o.product_name ILIKE $${values.length})`);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [countRes, ordersRes] = await Promise.all([
      query(`SELECT COUNT(*) FROM orders o ${whereSql}`, values),
      query(
        `SELECT o.*,
                cp.first_name as customer_first_name,
                cp.last_name as customer_last_name,
                cp.phone as customer_phone,
                u.name as user_name,
                u.email as customer_email
         FROM orders o
         LEFT JOIN customer_profiles cp ON cp.id = o.customer_id
         LEFT JOIN "user" u ON u.id = cp.user_id
         ${whereSql}
         ORDER BY o.created_at DESC
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
    ]);

    const total = parseInt(countRes.rows[0]?.count || "0", 10);
    const orders = ordersRes.rows.map((row) => OrderWorkflowService.mapRowToOrder(row));

    res.json({ total, orders });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list admin orders", detail: err.message });
  }
});

/**
 * GET /api/admin/shopping/orders/:orderId
 * Detailed administrative view of order.
 */
adminRouter.get("/shopping/orders/:orderId", async (req: Request, res: Response) => {
  try {
    const order = await OrderWorkflowService.serializeOrder(req.params.orderId);
    res.json(order);
  } catch (err: any) {
    res.status(404).json({ detail: "Commande introuvable." });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/verify-price & /quote
 * Staff verifies the merchant price and issues an official versioned Quote.
 */
const handleVerifyPriceAndQuote = async (req: Request, res: Response) => {
  try {
    const {
      verified_product_price,
      verified_shipping_cost,
      verified_tax,
      service_fee,
      international_fee,
      delivery_fee,
      discount,
      valid_minutes,
      notes,
    } = req.body;

    if (!verified_product_price || parseFloat(verified_product_price) <= 0) {
      res.status(400).json({ detail: "Verified product price is required and must be > 0" });
      return;
    }

    const quote = await OrderWorkflowService.issueQuote(
      req.params.orderId,
      req.user!.id,
      {
        verified_product_price: parseFloat(verified_product_price),
        verified_shipping_cost: verified_shipping_cost ? parseFloat(verified_shipping_cost) : 0,
        verified_tax: verified_tax ? parseFloat(verified_tax) : 0,
        service_fee: service_fee !== undefined ? parseFloat(service_fee) : undefined,
        international_fee: international_fee ? parseFloat(international_fee) : 0,
        delivery_fee: delivery_fee ? parseFloat(delivery_fee) : 0,
        discount: discount ? parseFloat(discount) : 0,
        valid_minutes: valid_minutes ? parseInt(valid_minutes, 10) : 60,
        notes,
      }
    );

    res.json({
      id: quote.id,
      version: quote.version,
      product_price: Number(quote.product_price),
      shipping_cost: Number(quote.shipping_cost),
      tax: Number(quote.tax),
      service_fee: Number(quote.service_fee),
      international_fee: Number(quote.international_fee),
      delivery_fee: Number(quote.delivery_fee),
      discount: Number(quote.discount),
      total: Number(quote.total),
      total_htg: Number(quote.total_htg),
      exchange_rate: Number(quote.exchange_rate),
      currency: quote.currency,
      status: quote.status,
      expires_at: quote.expires_at,
      created_at: quote.created_at,
      notes: quote.notes,
    });
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
};

adminRouter.post("/shopping/orders/:orderId/verify-price", handleVerifyPriceAndQuote);
adminRouter.post("/shopping/orders/:orderId/quote", handleVerifyPriceAndQuote);

/**
 * POST /api/admin/shopping/orders/:orderId/pre-purchase-validation
 * Pre-purchase check before buying item on merchant website.
 */
adminRouter.post("/shopping/orders/:orderId/pre-purchase-validation", async (req: Request, res: Response) => {
  try {
    const {
      current_merchant_price,
      current_merchant_shipping,
      current_merchant_tax,
      is_available = true,
      is_variant_available = true,
      notes,
    } = req.body;

    const result = await OrderWorkflowService.prePurchaseValidation(
      req.params.orderId,
      req.user!.id,
      {
        currentMerchantPrice: parseFloat(current_merchant_price),
        currentMerchantShipping: current_merchant_shipping ? parseFloat(current_merchant_shipping) : 0,
        currentMerchantTax: current_merchant_tax ? parseFloat(current_merchant_tax) : 0,
        isAvailable: Boolean(is_available),
        isVariantAvailable: Boolean(is_variant_available),
        notes,
      }
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/purchase
 * Staff records completed merchant purchase. Captures funds, releases unused hold.
 */
adminRouter.post("/shopping/orders/:orderId/purchase", async (req: Request, res: Response) => {
  try {
    const {
      merchant_order_id,
      actual_product_price,
      actual_shipping,
      actual_tax,
      actual_total,
      merchant_tracking_number,
      notes,
    } = req.body;

    if (!merchant_order_id || !actual_total) {
      res.status(400).json({ detail: "Merchant order ID and actual total are required" });
      return;
    }

    const order = await OrderWorkflowService.recordPurchase(
      req.params.orderId,
      req.user!.id,
      {
        merchantOrderId: merchant_order_id,
        actualProductPrice: actual_product_price ? parseFloat(actual_product_price) : parseFloat(actual_total),
        actualShipping: actual_shipping ? parseFloat(actual_shipping) : 0,
        actualTax: actual_tax ? parseFloat(actual_tax) : 0,
        actualTotal: parseFloat(actual_total),
        merchantTrackingNumber: merchant_tracking_number,
        notes,
      }
    );

    res.json(order);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/mark-shipped
 * Staff records carrier & tracking when merchant ships.
 */
adminRouter.post("/shopping/orders/:orderId/mark-shipped", async (req: Request, res: Response) => {
  try {
    const { merchant_tracking_number, carrier } = req.body;
    if (!merchant_tracking_number) {
      res.status(400).json({ detail: "Tracking number is required" });
      return;
    }

    const order = await OrderWorkflowService.markShipped(req.params.orderId, req.user!.id, {
      merchantTrackingNumber: merchant_tracking_number,
      carrier,
    });

    res.json(order);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/mark-arrived
 * Marks package arrived at Haiti hub and issues pickup verification code.
 */
adminRouter.post("/shopping/orders/:orderId/mark-arrived", async (req: Request, res: Response) => {
  try {
    const notes = req.query.notes as string | undefined;
    const order = await OrderWorkflowService.markArrivedInHaiti(req.params.orderId, req.user!.id, notes);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/verify-pickup
 * Verifies pickup code at agency counter.
 */
adminRouter.post("/shopping/orders/:orderId/verify-pickup", async (req: Request, res: Response) => {
  try {
    const { pickup_code, picked_up_by_name } = req.body;
    if (!pickup_code) {
      res.status(400).json({ detail: "Pickup verification code is required" });
      return;
    }

    const order = await OrderWorkflowService.verifyPickup(
      req.params.orderId,
      pickup_code,
      req.user!.id,
      picked_up_by_name
    );

    res.json(order);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/refund
 * Admin issues refund to customer wallet.
 */
adminRouter.post("/shopping/orders/:orderId/refund", requireAdmin, async (req: Request, res: Response) => {
  try {
    const amountUsd = req.query.amount_usd ? parseFloat(req.query.amount_usd as string) : undefined;
    const reason = (req.query.reason as string) || "Administrative refund";

    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [req.params.orderId]);
    if (orderRes.rows.length === 0) {
      res.status(404).json({ detail: "Commande introuvable." });
      return;
    }
    const order = orderRes.rows[0];

    const walletRes = await query(`SELECT id FROM wallet_accounts WHERE customer_id = $1`, [order.customer_id]);
    if (walletRes.rows.length === 0) {
      res.status(400).json({ detail: "Customer wallet not found" });
      return;
    }

    const refundAmount = amountUsd || Number(order.actual_purchase_total || order.final_total || 0);
    if (refundAmount <= 0) {
      res.status(400).json({ detail: "Invalid refund amount" });
      return;
    }

    await WalletLedgerService.refundToWallet(
      walletRes.rows[0].id,
      refundAmount,
      order.id,
      order.order_number,
      reason
    );

    await query(
      `UPDATE orders SET status = 'REFUNDED', payment_status = 'REFUNDED', updated_at = NOW() WHERE id = $1`,
      [order.id]
    );

    await OrderWorkflowService.logEvent(order.id, "ORDER_REFUNDED", "REFUNDED", "admin", req.user!.id, {
      refund_amount_usd: refundAmount,
      reason,
    });

    // Dispatch bilingual REFUNDED email notification (non-blocking)
    OrderWorkflowService.getCustomerContact(order.customer_id).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderStatusUpdateEmail(contact.email, "REFUNDED", {
          customerName: contact.name,
          orderNumber: order.order_number,
          productName: order.product_name,
          merchantName: order.merchant_name,
          quantity: order.quantity,
          totalUsd: refundAmount,
          notes: reason,
        }).catch((err) => console.warn("Failed to dispatch refund email:", err));
      }
    }).catch(() => {});

    const updated = await OrderWorkflowService.serializeOrder(order.id);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/admin/shopping/orders/:orderId/reject
 * Staff rejects order request with reason and releases reserved funds.
 */
adminRouter.post("/shopping/orders/:orderId/reject", async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const order = await OrderWorkflowService.rejectOrder(
      req.params.orderId,
      req.user!.id,
      reason || "Rejected by administration"
    );
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * GET /api/admin/shopping/integrations/status
 * Health status for all 8 merchants and Awin feed engine.
 */
adminRouter.get("/shopping/integrations/status", async (_req: Request, res: Response) => {
  const merchants = MerchantRegistry.getMerchantsOverview();
  const awinStatus = await AwinFeedService.getFeedStatus();
  res.json({ merchants, awin: awinStatus });
});

/**
 * POST /api/admin/shopping/integrations/awin/sync
 * Trigger Awin feed synchronization.
 */
adminRouter.post("/shopping/integrations/awin/sync", requireAdmin, async (req: Request, res: Response) => {
  const { merchant_slug } = req.body;
  const result = await AwinFeedService.triggerRemoteFeedSync(merchant_slug);
  res.json(result);
});

/**
 * GET /api/admin/shopping/integrations/awin/logs
 * Audit history of Awin feed synchronization runs.
 */
adminRouter.get("/shopping/integrations/awin/logs", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const countRes = await query(`SELECT COUNT(*) FROM awin_feed_sync_logs`);
    const total = parseInt(countRes.rows[0].count, 10);

    const logsRes = await query(
      `SELECT * FROM awin_feed_sync_logs ORDER BY started_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ total, logs: logsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch logs", detail: err.message });
  }
});

/**
 * GET /api/admin/shopping/catalog
 * Admin catalog search.
 */
adminRouter.get("/shopping/catalog", async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    const merchant = req.query.merchant as string | undefined;
    const category = req.query.category as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await ProductEngineService.searchCatalog({
      query: q,
      merchantSlug: merchant,
      category,
      limit,
      offset,
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "Catalog fetch failed", detail: err.message });
  }
});
