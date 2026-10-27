import { query, withTransaction } from "../../db/connection.js";
import { WalletLedgerService } from "../wallet/ledger.js";
import { ProductEngineService, QuoteCalculationInput } from "../product-engine/engine.js";
import { validateAndNormalizeProductUrl } from "../product-engine/ssrf.js";
import { EmailService } from "../email/service.js";
import crypto from "crypto";

export interface OrderDetail {
  id: string;
  public_order_id: string;
  order_number: string;
  request_reference: string;
  merchant_name: string;
  merchant_domain: string | null;
  product_url: string | null;
  product_name: string;
  product_image: string | null;
  product_description: string | null;
  product_specifications: Record<string, any>;
  variant?: string | null;
  size?: string | null;
  color?: string | null;
  quantity: number;
  customer_notes?: string | null;
  customer_estimated_price: number;
  customer_estimated_currency: string;
  verified_product_price: number | null;
  service_fee: number;
  international_shipping_fee: number;
  delivery_fee: number;
  quoted_total: number | null;
  actual_purchase_total: number | null;
  final_total: number;
  currency: string;
  status: string;
  payment_status: string;
  purchase_status: string;
  shipping_status: string;
  delivery_status: string;
  pickup_code: string | null;
  merchant_order_id: string | null;
  merchant_tracking_number: string | null;
  carrier: string | null;
  shipping_address_snapshot: Record<string, any>;
  screenshot_attachment_id: string | null;
  screenshot_attachment_ids?: string[];
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  quotes: any[];
  events: any[];
  customer?: { name: string; phone: string; email: string } | null;
}

export class OrderWorkflowService {
  /**
   * Fast in-memory mapper from database order row to OrderDetail response.
   */
  static mapRowToOrder(o: any, customerInfo: any = null, quotes: any[] = [], events: any[] = []): OrderDetail {
    const publicOrderId = o.public_order_id || `ORD-${o.id.substring(0, 8).toUpperCase()}`;
    const canSeePickupCode = ["ARRIVED_AT_IMPEX", "READY_FOR_PICKUP", "DELIVERED"].includes(o.status);

    let customer = customerInfo;
    if (!customer && (o.customer_first_name || o.customer_email || o.user_name)) {
      const name = `${o.customer_first_name || ''} ${o.customer_last_name || ''}`.trim() || o.user_name || 'Client';
      customer = {
        name,
        phone: o.customer_phone || '',
        email: o.customer_email || '',
      };
    }

    const screenshotIds = Array.isArray(o.product_specifications?.screenshot_attachment_ids)
      ? o.product_specifications.screenshot_attachment_ids
      : o.screenshot_attachment_id
      ? [o.screenshot_attachment_id]
      : [];

    return {
      id: o.id,
      public_order_id: publicOrderId,
      order_number: o.order_number,
      request_reference: o.order_number || publicOrderId,
      merchant_name: o.merchant_name,
      merchant_domain: o.merchant_domain,
      product_url: o.product_url,
      product_name: o.product_name,
      product_image: o.product_image,
      product_description: o.product_description,
      product_specifications: o.product_specifications || {},
      variant: o.variant,
      size: o.size,
      color: o.color,
      quantity: o.quantity || 1,
      customer_notes: o.customer_notes,
      customer_estimated_price: Number(o.customer_estimated_price || 0),
      customer_estimated_currency: o.customer_estimated_currency || "USD",
      verified_product_price: o.verified_product_price ? Number(o.verified_product_price) : null,
      service_fee: Number(o.service_fee || 0),
      international_shipping_fee: Number(o.international_shipping_fee || 0),
      delivery_fee: Number(o.delivery_fee || 0),
      quoted_total: o.quoted_total ? Number(o.quoted_total) : null,
      actual_purchase_total: o.actual_purchase_total ? Number(o.actual_purchase_total) : null,
      final_total: Number(o.final_total || o.quoted_total || 0),
      currency: o.currency || "USD",
      status: o.status,
      payment_status: o.payment_status || "PENDING",
      purchase_status: o.purchase_status || "PENDING",
      shipping_status: o.shipping_status || "PENDING",
      delivery_status: o.delivery_status || "PENDING",
      pickup_code: canSeePickupCode ? o.pickup_code : null,
      merchant_order_id: o.merchant_order_id,
      merchant_tracking_number: o.merchant_tracking_number,
      carrier: o.carrier,
      shipping_address_snapshot: o.shipping_address_snapshot || {},
      screenshot_attachment_id: o.screenshot_attachment_id,
      screenshot_attachment_ids: screenshotIds,
      rejection_reason: o.rejection_reason,
      created_at: o.created_at,
      updated_at: o.updated_at,
      quotes,
      events,
      customer,
    };
  }

  /**
   * Helper to format order row with its quotes and events.
   */
  static async serializeOrder(orderId: string): Promise<OrderDetail> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) {
      throw new Error(`Order ${orderId} not found`);
    }
    const o = orderRes.rows[0];

    const [quotesRes, eventsRes, custRes] = await Promise.all([
      query(`SELECT * FROM order_quotes WHERE order_id = $1 ORDER BY version DESC`, [orderId]),
      query(`SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at DESC`, [orderId]),
      o.customer_id
        ? query(
            `SELECT cp.first_name, cp.last_name, cp.phone, u.name, u.email
             FROM customer_profiles cp
             JOIN "user" u ON u.id = cp.user_id
             WHERE cp.id = $1`,
            [o.customer_id]
          ).catch(() => ({ rows: [] }))
        : Promise.resolve({ rows: [] }),
    ]);

    const quotes = quotesRes.rows.map((q) => ({
      id: q.id,
      version: q.version,
      product_price: Number(q.product_price),
      shipping_cost: Number(q.shipping_cost),
      tax: Number(q.tax),
      service_fee: Number(q.service_fee),
      international_fee: Number(q.international_fee),
      delivery_fee: Number(q.delivery_fee),
      discount: Number(q.discount),
      total: Number(q.total),
      total_htg: Number(q.total_htg),
      exchange_rate: Number(q.exchange_rate),
      currency: q.currency,
      status: q.status,
      expires_at: q.expires_at,
      created_at: q.created_at,
      notes: q.notes,
    }));

    const events = eventsRes.rows.map((e) => ({
      id: e.id,
      event_type: e.event_type,
      previous_status: e.previous_status,
      new_status: e.new_status,
      actor_type: e.actor_type,
      actor_id: e.actor_id,
      metadata: e.metadata || {},
      created_at: e.created_at,
    }));

    let customerInfo: { name: string; phone: string; email: string } | null = null;
    if (custRes.rows.length > 0) {
      const c = custRes.rows[0];
      customerInfo = {
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.name || '',
        phone: c.phone || '',
        email: c.email || '',
      };
    }

    return this.mapRowToOrder(o, customerInfo, quotes, events);
  }

  /**
   * Helper to fetch customer contact information (email & full name) for bilingual notification emails.
   */
  static async getCustomerContact(customerId: string): Promise<{ email: string; name: string } | null> {
    try {
      const res = await query(
        `SELECT u.email, u.name, c.first_name, c.last_name
         FROM customer_profiles c
         JOIN "user" u ON u.id = c.user_id
         WHERE c.id = $1`,
        [customerId]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.name || 'Client';
      return { email: r.email, name };
    } catch (err) {
      console.warn("Failed to retrieve customer contact for email notification:", err);
      return null;
    }
  }

  /**
   * Log an immutable order event.
   */
  static async logEvent(
    orderId: string,
    eventType: string,
    newStatus: string,
    actorType: "customer" | "admin" | "system",
    actorId?: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    await query(
      `INSERT INTO order_events (order_id, event_type, new_status, actor_type, actor_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, eventType, newStatus, actorType, actorId || null, JSON.stringify(metadata)]
    );
  }

  /**
   * Submit an order by product URL.
   */
  static async submitOrderByUrl(params: {
    customerId: string;
    productUrl: string;
    productName?: string;
    merchantName?: string;
    specifications?: Record<string, any>;
    variant?: string;
    size?: string;
    color?: string;
    quantity: number;
    customerEstimatedPrice?: number;
    customerEstimatedCurrency?: string;
    notes?: string;
    screenshotAttachmentId?: string;
    selectedAddressId?: string;
    idempotencyKey?: string;
    actorUserId: string;
    reserveFunds?: boolean;
  }): Promise<OrderDetail> {
    const {
      customerId,
      productUrl,
      productName,
      merchantName,
      specifications = {},
      variant,
      size,
      color,
      quantity = 1,
      customerEstimatedPrice = 0,
      customerEstimatedCurrency = "USD",
      notes,
      screenshotAttachmentId,
      selectedAddressId,
      idempotencyKey,
      actorUserId,
      reserveFunds = false,
    } = params;

    // 0. Idempotency check: if key already exists for this customer, safely return existing request
    if (idempotencyKey) {
      const existing = await query(
        `SELECT id FROM orders WHERE idempotency_key = $1 AND customer_id = $2`,
        [idempotencyKey, customerId]
      );
      if (existing.rows.length > 0) {
        return this.serializeOrder(existing.rows[0].id);
      }
    }

    // 1. SSRF URL validation and normalization
    const validated = await validateAndNormalizeProductUrl(productUrl);
    if (!validated.isValid) {
      throw new Error(`Invalid product URL: ${validated.error}`);
    }

    // 2. Fetch address snapshot if provided
    let addressSnapshot = {};
    if (selectedAddressId) {
      const addrRes = await query(`SELECT * FROM addresses WHERE id = $1`, [selectedAddressId]);
      if (addrRes.rows.length > 0) addressSnapshot = addrRes.rows[0];
    }

    const orderNumber = `IMX-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const publicOrderId = `ORD-${Date.now().toString().slice(-8)}`;
    const finalMerchantName = merchantName?.trim() || validated.merchant_name || "International Store";

    // 3. Check if customer wants immediate wallet fund reservation and has sufficient spendable balance
    let shouldReserveImmediately = false;
    let initialQuoteCalc: any = null;
    let customerWalletId: string | null = null;

    if (customerEstimatedPrice > 0) {
      initialQuoteCalc = ProductEngineService.calculateQuote({
        verified_product_price: customerEstimatedPrice * Math.max(1, quantity),
      });

      if (reserveFunds) {
        const walletRes = await query(`SELECT id FROM wallet_accounts WHERE customer_id = $1`, [customerId]);
        if (walletRes.rows.length > 0 && walletRes.rows[0].id) {
          const wId: string = walletRes.rows[0].id;
          customerWalletId = wId;
          const balance = await WalletLedgerService.getWalletBalance(wId);
          if (balance.spendable_balance >= initialQuoteCalc.total) {
            shouldReserveImmediately = true;
          }
        }
      }
    }

    const initialStatus = shouldReserveImmediately ? "FUNDS_RESERVED" : "SUBMITTED";
    const initialPaymentStatus = shouldReserveImmediately ? "AUTHORIZED" : "PENDING";
    const initialFinalTotal = initialQuoteCalc ? initialQuoteCalc.total : null;

    const insertRes = await query(
      `INSERT INTO orders (
         public_order_id, order_number, customer_id, order_type,
         merchant_name, merchant_domain, product_url, product_name,
         product_specifications, variant, size, color, quantity,
         customer_notes, customer_estimated_price, customer_estimated_currency,
         screenshot_attachment_id, shipping_address_snapshot, idempotency_key,
         status, payment_status, quoted_total, final_total
       ) VALUES ($1, $2, $3, 'LINK', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        publicOrderId,
        orderNumber,
        customerId,
        finalMerchantName,
        validated.domain,
        validated.cleaned_url,
        productName || `${finalMerchantName} Item`,
        JSON.stringify(specifications),
        variant || null,
        size || null,
        color || null,
        Math.max(1, quantity),
        notes || null,
        customerEstimatedPrice,
        customerEstimatedCurrency,
        screenshotAttachmentId || null,
        JSON.stringify(addressSnapshot),
        idempotencyKey || null,
        initialStatus,
        initialPaymentStatus,
        initialFinalTotal,
        initialFinalTotal,
      ]
    );

    const createdOrderRow = insertRes.rows[0];
    const orderId = createdOrderRow.id;
    const quotes: any[] = [];

    // 4. If initial quote calculated, create order quote record
    if (initialQuoteCalc) {
      const quoteStatus = shouldReserveImmediately ? "ACCEPTED" : "PENDING";
      const quoteRes = await query(
        `INSERT INTO order_quotes (
           order_id, version, product_price, shipping_cost, tax,
           service_fee, international_fee, delivery_fee, discount,
           total, total_htg, exchange_rate, currency, status, expires_at, notes, created_by_user_id
         ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'USD', $12, $13, $14, $15)
         RETURNING id`,
        [
          orderId,
          initialQuoteCalc.product_price,
          initialQuoteCalc.shipping_cost,
          initialQuoteCalc.tax,
          initialQuoteCalc.service_fee,
          initialQuoteCalc.international_fee,
          initialQuoteCalc.delivery_fee,
          initialQuoteCalc.discount,
          initialQuoteCalc.total,
          initialQuoteCalc.total_htg,
          initialQuoteCalc.exchange_rate,
          quoteStatus,
          initialQuoteCalc.expires_at,
          "Initial quote generated from customer submitted price.",
          actorUserId,
        ]
      );

      quotes.push({
        id: quoteRes.rows[0]?.id || `QTE-${orderId.substring(0, 8)}`,
        version: 1,
        product_price: initialQuoteCalc.product_price,
        shipping_cost: initialQuoteCalc.shipping_cost,
        tax: initialQuoteCalc.tax,
        service_fee: initialQuoteCalc.service_fee,
        international_fee: initialQuoteCalc.international_fee,
        delivery_fee: initialQuoteCalc.delivery_fee,
        discount: initialQuoteCalc.discount,
        total: initialQuoteCalc.total,
        total_htg: initialQuoteCalc.total_htg,
        exchange_rate: initialQuoteCalc.exchange_rate,
        currency: "USD",
        status: quoteStatus,
        expires_at: initialQuoteCalc.expires_at,
        created_at: new Date().toISOString(),
        notes: "Initial quote generated from customer submitted price.",
      });

      // If funds reserved immediately, lock wallet hold atomically
      if (shouldReserveImmediately && customerWalletId) {
        const reservationKey = idempotencyKey ? `quote_reserve_${idempotencyKey}` : `quote_reserve_${orderId}`;
        await WalletLedgerService.reserveFunds(
          customerWalletId,
          orderId,
          initialQuoteCalc.total,
          reservationKey
        );
      }
    }

    // Log event non-blockingly
    this.logEvent(orderId, "ORDER_SUBMITTED", initialStatus, "customer", actorUserId, {
      product_url: validated.cleaned_url,
      merchant: finalMerchantName,
      estimated_price: customerEstimatedPrice,
      screenshot_attached: !!screenshotAttachmentId,
      funds_reserved_immediately: shouldReserveImmediately,
      reserved_amount_usd: shouldReserveImmediately ? initialQuoteCalc?.total : 0,
    }).catch((err) => console.warn("Failed to log order submitted event:", err));

    // Dispatch bilingual order placed email notification (non-blocking)
    this.getCustomerContact(customerId).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderPlacedEmail(contact.email, {
          customerName: contact.name,
          orderNumber,
          productName: productName || `${finalMerchantName} Item`,
          merchantName: finalMerchantName,
          productUrl: validated.cleaned_url,
          quantity: Math.max(1, quantity),
          totalUsd: initialFinalTotal || customerEstimatedPrice || 0,
          status: initialStatus,
        }).catch((err) => console.warn("Failed to dispatch order placed email:", err));
      }
    }).catch(() => {});

    return this.mapRowToOrder(createdOrderRow, null, quotes, []);
  }

  /**
   * Submit an order by screenshot.
   */
  static async submitOrderByScreenshot(params: {
    customerId: string;
    screenshotAttachmentId: string;
    productDescription: string;
    productName?: string;
    merchantName?: string;
    specifications?: Record<string, any>;
    variant?: string;
    size?: string;
    color?: string;
    quantity: number;
    customerEstimatedPrice?: number;
    customerEstimatedCurrency?: string;
    notes?: string;
    selectedAddressId?: string;
    idempotencyKey?: string;
    actorUserId: string;
  }): Promise<OrderDetail> {
    const {
      customerId,
      screenshotAttachmentId,
      productDescription,
      productName,
      merchantName = "International Store",
      specifications = {},
      variant,
      size,
      color,
      quantity = 1,
      customerEstimatedPrice = 0,
      customerEstimatedCurrency = "USD",
      notes,
      selectedAddressId,
      idempotencyKey,
      actorUserId,
    } = params;

    let addressSnapshot = {};
    if (selectedAddressId) {
      const addrRes = await query(`SELECT * FROM addresses WHERE id = $1`, [selectedAddressId]);
      if (addrRes.rows.length > 0) addressSnapshot = addrRes.rows[0];
    }

    const orderNumber = `IMX-IMG-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const publicOrderId = `ORD-${Date.now().toString().slice(-8)}`;

    const insertRes = await query(
      `INSERT INTO orders (
         public_order_id, order_number, customer_id, order_type,
         merchant_name, product_description, product_name,
         product_specifications, variant, size, color, quantity,
         customer_notes, customer_estimated_price, customer_estimated_currency,
         screenshot_attachment_id, shipping_address_snapshot, idempotency_key, status, payment_status
       ) VALUES ($1, $2, $3, 'SCREENSHOT', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'SUBMITTED', 'PENDING')
       RETURNING *`,
      [
        publicOrderId,
        orderNumber,
        customerId,
        merchantName,
        productDescription,
        productName || productDescription.substring(0, 50),
        JSON.stringify(specifications),
        variant || null,
        size || null,
        color || null,
        Math.max(1, quantity),
        notes || null,
        customerEstimatedPrice,
        customerEstimatedCurrency,
        screenshotAttachmentId,
        JSON.stringify(addressSnapshot),
        idempotencyKey || null,
      ]
    );

    const createdOrderRow = insertRes.rows[0];
    const orderId = createdOrderRow.id;

    // Log event non-blockingly
    this.logEvent(orderId, "ORDER_SUBMITTED", "SUBMITTED", "customer", actorUserId, {
      screenshot_attachment_id: screenshotAttachmentId,
      merchant: merchantName,
    }).catch((err) => console.warn("Failed to log order submitted event:", err));

    // Dispatch bilingual order placed email notification (non-blocking)
    this.getCustomerContact(customerId).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderPlacedEmail(contact.email, {
          customerName: contact.name,
          orderNumber,
          productName: productName || productDescription.substring(0, 50),
          merchantName,
          quantity: Math.max(1, quantity),
          totalUsd: customerEstimatedPrice || 0,
          status: "SUBMITTED",
        }).catch((err) => console.warn("Failed to dispatch screenshot order placed email:", err));
      }
    }).catch(() => {});

    return this.mapRowToOrder(createdOrderRow, null, [], []);
  }

  /**
   * Staff verifies merchant price and issues an official Quote to customer.
   */
  static async issueQuote(
    orderId: string,
    adminUserId: string,
    quoteInput: QuoteCalculationInput & { notes?: string }
  ): Promise<any> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    const calc = ProductEngineService.calculateQuote(quoteInput);

    // Get current quote version number
    const verRes = await query(
      `SELECT COALESCE(MAX(version), 0) + 1 as next_ver FROM order_quotes WHERE order_id = $1`,
      [orderId]
    );
    const nextVersion = verRes.rows[0].next_ver;

    // Supersede any older pending quotes
    await query(
      `UPDATE order_quotes SET status = 'SUPERSEDED' WHERE order_id = $1 AND status = 'PENDING'`,
      [orderId]
    );

    const quoteRes = await query(
      `INSERT INTO order_quotes (
         order_id, version, product_price, shipping_cost, tax,
         service_fee, international_fee, delivery_fee, discount,
         total, total_htg, exchange_rate, currency, status, expires_at, notes, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'USD', 'PENDING', $13, $14, $15)
       RETURNING *`,
      [
        orderId,
        nextVersion,
        calc.product_price,
        calc.shipping_cost,
        calc.tax,
        calc.service_fee,
        calc.international_fee,
        calc.delivery_fee,
        calc.discount,
        calc.total,
        calc.total_htg,
        calc.exchange_rate,
        calc.expires_at,
        quoteInput.notes || null,
        adminUserId,
      ]
    );

    // Update order status to QUOTE_READY
    await query(
      `UPDATE orders 
       SET status = 'QUOTE_READY',
           verified_product_price = $1,
           service_fee = $2,
           international_shipping_fee = $3,
           delivery_fee = $4,
           quoted_total = $5,
           final_total = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [calc.product_price, calc.service_fee, calc.international_fee, calc.delivery_fee, calc.total, orderId]
    );

    await this.logEvent(orderId, "QUOTE_ISSUED", "QUOTE_READY", "admin", adminUserId, {
      quote_id: quoteRes.rows[0].id,
      version: nextVersion,
      total_usd: calc.total,
      total_htg: calc.total_htg,
      expires_at: calc.expires_at,
    });

    // Dispatch bilingual QUOTE_READY email notification (non-blocking)
    this.getCustomerContact(order.customer_id).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderStatusUpdateEmail(contact.email, "QUOTE_READY", {
          customerName: contact.name,
          orderNumber: order.order_number,
          productName: order.product_name,
          merchantName: order.merchant_name,
          quantity: order.quantity,
          totalUsd: calc.total,
          totalHtg: calc.total_htg,
          notes: quoteInput.notes,
        }).catch((err) => console.warn("Failed to dispatch quote ready email:", err));
      }
    }).catch(() => {});

    return quoteRes.rows[0];
  }

  /**
   * Customer accepts/confirms official quote.
   * Atomically locks wallet, checks balance, and reserves escrow funds.
   */
  static async confirmQuote(
    orderId: string,
    customerProfileId: string,
    quoteId?: string,
    idempotencyKey?: string,
    actorUserId?: string
  ): Promise<OrderDetail> {
    const orderRes = await query(
      `SELECT * FROM orders WHERE id = $1 AND customer_id = $2`,
      [orderId, customerProfileId]
    );
    if (orderRes.rows.length === 0) throw new Error("Order not found or unauthorized");
    const order = orderRes.rows[0];

    // Find active quote
    let quoteRes;
    if (quoteId) {
      quoteRes = await query(
        `SELECT * FROM order_quotes WHERE id = $1 AND order_id = $2`,
        [quoteId, orderId]
      );
    } else {
      quoteRes = await query(
        `SELECT * FROM order_quotes WHERE order_id = $1 AND status = 'PENDING' ORDER BY version DESC LIMIT 1`,
        [orderId]
      );
    }

    if (quoteRes.rows.length === 0) {
      throw new Error("No valid pending quote found for this order");
    }

    const quote = quoteRes.rows[0];
    if (new Date(quote.expires_at).getTime() < Date.now()) {
      await query(`UPDATE order_quotes SET status = 'EXPIRED' WHERE id = $1`, [quote.id]);
      throw new Error("This quotation has expired. Please request a quote update.");
    }

    // Find customer wallet
    const walletRes = await query(
      `SELECT id FROM wallet_accounts WHERE customer_id = $1`,
      [customerProfileId]
    );
    if (walletRes.rows.length === 0) {
      throw new Error("Customer wallet not found");
    }
    const walletId = walletRes.rows[0].id;

    // Atomically reserve funds in wallet
    const quoteTotal = Number(quote.total);
    const reservationKey = idempotencyKey || `quote_accept_${quote.id}`;

    await WalletLedgerService.reserveFunds(
      walletId,
      orderId,
      quoteTotal,
      reservationKey
    );

    // Mark quote ACCEPTED and order FUNDS_RESERVED
    await query(`UPDATE order_quotes SET status = 'ACCEPTED' WHERE id = $1`, [quote.id]);
    await query(
      `UPDATE orders 
       SET status = 'FUNDS_RESERVED',
           payment_status = 'AUTHORIZED',
           final_total = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [quoteTotal, orderId]
    );

    await this.logEvent(orderId, "QUOTE_ACCEPTED", "FUNDS_RESERVED", "customer", actorUserId, {
      quote_id: quote.id,
      amount_reserved: quoteTotal,
    });

    // Dispatch bilingual payment confirmed email notification (non-blocking)
    this.getCustomerContact(customerProfileId).then((contact) => {
      if (contact?.email) {
        EmailService.sendPaymentConfirmedEmail(contact.email, {
          customerName: contact.name,
          transactionRef: reservationKey,
          amountUsd: quoteTotal,
          paymentMethod: "Portefeuille IMPEX (Fonds Réservés) / IMPEX Wallet Escrow",
          orderNumber: order.order_number,
          date: new Date().toLocaleString(),
        }).catch((err) => console.warn("Failed to dispatch payment confirmed email:", err));
      }
    }).catch(() => {});

    return this.serializeOrder(orderId);
  }

  /**
   * Customer declines quote or cancels order before purchase.
   * Releases any reserved wallet funds.
   */
  static async declineQuoteOrCancel(
    orderId: string,
    customerProfileId: string,
    reason: string = "Customer declined quote",
    actorUserId?: string
  ): Promise<OrderDetail> {
    const orderRes = await query(
      `SELECT * FROM orders WHERE id = $1 AND customer_id = $2`,
      [orderId, customerProfileId]
    );
    if (orderRes.rows.length === 0) throw new Error("Order not found or unauthorized");
    const order = orderRes.rows[0];

    // Orders that have already been purchased cannot be unilaterally cancelled by customer
    if (["PURCHASE_COMPLETED", "IN_TRANSIT", "ARRIVED_AT_IMPEX", "DELIVERED"].includes(order.status)) {
      throw new Error("This order has already been procured from the merchant. To request a refund or cancellation, please contact IMPEX customer support.");
    }

    // Release any reserved wallet funds
    const walletRes = await query(
      `SELECT id FROM wallet_accounts WHERE customer_id = $1`,
      [customerProfileId]
    );
    if (walletRes.rows.length > 0) {
      await WalletLedgerService.releaseReservation(walletRes.rows[0].id, orderId, reason);
    }

    await query(
      `UPDATE order_quotes SET status = 'REJECTED' WHERE order_id = $1 AND status = 'PENDING'`,
      [orderId]
    );

    await query(
      `UPDATE orders 
       SET status = 'CANCELLED',
           rejection_reason = $1,
           updated_at = NOW() 
       WHERE id = $2`,
      [reason, orderId]
    );

    await this.logEvent(orderId, "ORDER_CANCELLED", "CANCELLED", "customer", actorUserId, { reason });
    return this.serializeOrder(orderId);
  }

  /**
   * Mandatory Pre-Purchase Validation by Staff.
   * Checks if merchant price increased or item went out of stock.
   */
  static async prePurchaseValidation(
    orderId: string,
    adminUserId: string,
    params: {
      currentMerchantPrice: number;
      currentMerchantShipping?: number;
      currentMerchantTax?: number;
      isAvailable: boolean;
      isVariantAvailable: boolean;
      notes?: string;
    }
  ): Promise<any> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    if (!params.isAvailable || !params.isVariantAvailable) {
      return {
        result: "ITEM_UNAVAILABLE",
        order_status: order.status,
        message: "The requested item or variant is currently out of stock on the merchant website.",
      };
    }

    const previousPrice = Number(order.verified_product_price || 0);
    const currentPrice = Number(params.currentMerchantPrice);

    if (currentPrice > previousPrice) {
      // Merchant price increased! Issue a new quote and move to PRICE_CHANGED for customer acceptance
      const quote = await this.issueQuote(orderId, adminUserId, {
        verified_product_price: currentPrice,
        verified_shipping_cost: params.currentMerchantShipping,
        verified_tax: params.currentMerchantTax,
        notes: `Price increased on merchant site from $${previousPrice.toFixed(2)} to $${currentPrice.toFixed(2)}. Customer re-confirmation required.`,
      });

      await query(`UPDATE orders SET status = 'PRICE_CHANGED' WHERE id = $1`, [orderId]);

      await this.logEvent(orderId, "PRICE_CHANGED", "PRICE_CHANGED", "admin", adminUserId, {
        previous_price: previousPrice,
        current_price: currentPrice,
        difference: currentPrice - previousPrice,
        new_quote_id: quote.id,
      });

      return {
        result: "PRICE_INCREASED",
        order_status: "PRICE_CHANGED",
        message: `Price increased by $${(currentPrice - previousPrice).toFixed(2)}. New quote issued.`,
        previous_price: previousPrice,
        current_price: currentPrice,
        difference: currentPrice - previousPrice,
        new_quote_id: quote.id,
        new_quote_total: Number(quote.total),
      };
    }

    return {
      result: "PRICE_VALIDATED",
      order_status: order.status,
      message: "Price validated. Merchant price has not increased. Procurement may proceed.",
      previous_price: previousPrice,
      current_price: currentPrice,
    };
  }

  /**
   * Staff records completed actual merchant purchase.
   * Captures actual total from wallet reservation and releases any unused remainder hold!
   */
  static async recordPurchase(
    orderId: string,
    adminUserId: string,
    params: {
      merchantOrderId: string;
      actualProductPrice: number;
      actualShipping?: number;
      actualTax?: number;
      actualTotal: number;
      merchantTrackingNumber?: string;
      notes?: string;
    }
  ): Promise<OrderDetail> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    const walletRes = await query(
      `SELECT id FROM wallet_accounts WHERE customer_id = $1`,
      [order.customer_id]
    );
    if (walletRes.rows.length === 0) throw new Error("Wallet not found");
    const walletId = walletRes.rows[0].id;

    // Capture funds atomically from reservation
    const captureResult = await WalletLedgerService.captureActualPurchase(
      walletId,
      orderId,
      params.actualTotal,
      order.order_number,
      params.notes
    );

    // Update order
    await query(
      `UPDATE orders 
       SET status = 'PURCHASE_COMPLETED',
           purchase_status = 'PURCHASED',
           payment_status = 'CAPTURED',
           merchant_order_id = $1,
           actual_purchase_total = $2,
           merchant_tracking_number = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [
        params.merchantOrderId,
        params.actualTotal,
        params.merchantTrackingNumber || null,
        orderId,
      ]
    );

    await this.logEvent(orderId, "PURCHASE_RECORDED", "PURCHASE_COMPLETED", "admin", adminUserId, {
      merchant_order_id: params.merchantOrderId,
      actual_total: params.actualTotal,
      released_remainder: captureResult.releasedRemainderUsd,
    });

    // Dispatch bilingual PURCHASE_COMPLETED email notification (non-blocking)
    this.getCustomerContact(order.customer_id).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderStatusUpdateEmail(contact.email, "PURCHASE_COMPLETED", {
          customerName: contact.name,
          orderNumber: order.order_number,
          productName: order.product_name,
          merchantName: order.merchant_name,
          quantity: order.quantity,
          totalUsd: params.actualTotal,
          trackingNumber: params.merchantTrackingNumber,
          notes: params.notes,
        }).catch((err) => console.warn("Failed to dispatch purchase completed email:", err));
      }
    }).catch(() => {});

    return this.serializeOrder(orderId);
  }

  /**
   * Staff records merchant shipment tracking to Miami warehouse.
   */
  static async markShipped(
    orderId: string,
    adminUserId: string,
    params: { merchantTrackingNumber: string; carrier?: string }
  ): Promise<OrderDetail> {
    await query(
      `UPDATE orders 
       SET status = 'IN_TRANSIT',
           shipping_status = 'IN_TRANSIT',
           merchant_tracking_number = $1,
           carrier = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [params.merchantTrackingNumber, params.carrier || "USPS", orderId]
    );

    await this.logEvent(orderId, "ORDER_SHIPPED", "IN_TRANSIT", "admin", adminUserId, {
      tracking_number: params.merchantTrackingNumber,
      carrier: params.carrier || "USPS",
    });

    // Dispatch bilingual IN_TRANSIT email notification (non-blocking)
    query(`SELECT * FROM orders WHERE id = $1`, [orderId]).then((res) => {
      if (res.rows.length > 0) {
        const o = res.rows[0];
        this.getCustomerContact(o.customer_id).then((contact) => {
          if (contact?.email) {
            EmailService.sendOrderStatusUpdateEmail(contact.email, "IN_TRANSIT", {
              customerName: contact.name,
              orderNumber: o.order_number,
              productName: o.product_name,
              merchantName: o.merchant_name,
              quantity: o.quantity,
              totalUsd: Number(o.final_total || 0),
              trackingNumber: params.merchantTrackingNumber,
              carrier: params.carrier || "USPS",
            }).catch((err) => console.warn("Failed to dispatch in-transit email:", err));
          }
        });
      }
    }).catch(() => {});

    return this.serializeOrder(orderId);
  }

  /**
   * Package arrived at IMPEX local hub in Haiti.
   * Generates secure 6-digit pickup verification code and marks ARRIVED_AT_IMPEX.
   */
  static async markArrivedInHaiti(
    orderId: string,
    adminUserId: string,
    notes?: string
  ): Promise<OrderDetail> {
    // Generate secure 6-digit pickup code
    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

    await query(
      `UPDATE orders 
       SET status = 'ARRIVED_AT_IMPEX',
           shipping_status = 'ARRIVED',
           pickup_code = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [pickupCode, orderId]
    );

    await this.logEvent(orderId, "PACKAGE_ARRIVED", "ARRIVED_AT_IMPEX", "admin", adminUserId, {
      pickup_code: pickupCode,
      notes: notes || "Package inspected and available at IMPEX agency counter.",
    });

    // Dispatch bilingual ARRIVED_AT_IMPEX email notification with pickup code (non-blocking)
    query(`SELECT * FROM orders WHERE id = $1`, [orderId]).then((res) => {
      if (res.rows.length > 0) {
        const o = res.rows[0];
        this.getCustomerContact(o.customer_id).then((contact) => {
          if (contact?.email) {
            EmailService.sendOrderStatusUpdateEmail(contact.email, "ARRIVED_AT_IMPEX", {
              customerName: contact.name,
              orderNumber: o.order_number,
              productName: o.product_name,
              merchantName: o.merchant_name,
              quantity: o.quantity,
              totalUsd: Number(o.final_total || 0),
              pickupCode,
              notes,
            }).catch((err) => console.warn("Failed to dispatch arrived in Haiti email:", err));
          }
        });
      }
    }).catch(() => {});

    return this.serializeOrder(orderId);
  }

  /**
   * Staff verifies customer pickup code at agency counter to complete pickup.
   */
  static async verifyPickup(
    orderId: string,
    pickupCode: string,
    staffUserId: string,
    pickedUpByName?: string
  ): Promise<OrderDetail> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    if (!order.pickup_code || order.pickup_code.trim() !== pickupCode.trim()) {
      throw new Error("Invalid pickup verification code. Counter delivery cannot proceed.");
    }

    await query(
      `UPDATE orders 
       SET status = 'DELIVERED',
           delivery_status = 'DELIVERED',
           updated_at = NOW()
       WHERE id = $1`,
      [orderId]
    );

    await this.logEvent(orderId, "PICKUP_COMPLETED", "DELIVERED", "admin", staffUserId, {
      picked_up_by: pickedUpByName || "Customer Verified",
    });

    // Dispatch bilingual DELIVERED email notification (non-blocking)
    this.getCustomerContact(order.customer_id).then((contact) => {
      if (contact?.email) {
        EmailService.sendOrderStatusUpdateEmail(contact.email, "DELIVERED", {
          customerName: contact.name,
          orderNumber: order.order_number,
          productName: order.product_name,
          merchantName: order.merchant_name,
          quantity: order.quantity,
          totalUsd: Number(order.final_total || 0),
        }).catch((err) => console.warn("Failed to dispatch delivered email:", err));
      }
    }).catch(() => {});

    return this.serializeOrder(orderId);
  }

  /**
   * Admin rejects order and releases any reserved funds.
   */
  static async rejectOrder(
    orderId: string,
    adminUserId: string,
    reason: string = "Rejected by administration"
  ): Promise<OrderDetail> {
    const orderRes = await query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
    if (orderRes.rows.length === 0) throw new Error("Order not found");
    const order = orderRes.rows[0];

    const walletRes = await query(
      `SELECT id FROM wallet_accounts WHERE customer_id = $1`,
      [order.customer_id]
    );
    if (walletRes.rows.length > 0) {
      await WalletLedgerService.releaseReservation(walletRes.rows[0].id, orderId, reason);
    }

    await query(
      `UPDATE orders 
       SET status = 'REJECTED',
           rejection_reason = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [reason, orderId]
    );

    await this.logEvent(orderId, "ORDER_REJECTED", "REJECTED", "admin", adminUserId, { reason });
    return this.serializeOrder(orderId);
  }
}
