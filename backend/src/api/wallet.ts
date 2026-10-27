import crypto from "crypto";
import { Router, Request, Response } from "express";
import { authenticateRequest, requireAuth, requireCustomer } from "../middleware/auth.js";
import { WalletLedgerService } from "../modules/wallet/ledger.js";
import { PaymProviderService } from "../modules/payment/paym.js";
import { PayPalService } from "../modules/payment/paypal.js";
import { query } from "../db/connection.js";

export const walletRouter = Router();

/**
 * Helper to fetch customer wallet.
 */
async function getCustomerWallet(userId: string) {
  const custRes = await query(`SELECT id FROM customer_profiles WHERE user_id = $1`, [userId]);
  if (custRes.rows.length === 0) throw new Error("Customer profile not found");
  const customerId = custRes.rows[0].id;
  return WalletLedgerService.getOrCreateWallet(customerId);
}

/**
 * GET /api/wallet/balance & /api/wallet/
 * Returns authoritative balance directly calculated from the immutable ledger.
 */
const handleGetBalance = async (req: Request, res: Response) => {
  try {
    const wallet = await getCustomerWallet(req.user!.id);
    res.json(wallet);
  } catch (err: any) {
    res.status(404).json({ detail: "Wallet not found", error: err.message });
  }
};

walletRouter.get("/balance", authenticateRequest, requireAuth, handleGetBalance);
walletRouter.get("/", authenticateRequest, requireAuth, handleGetBalance);

/**
 * GET /api/wallet/transactions
 * Returns paginated transaction history from the ledger.
 */
walletRouter.get("/transactions", authenticateRequest, requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = await getCustomerWallet(req.user!.id);
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const type = req.query.type as string | undefined;

    const history = await WalletLedgerService.getTransactionHistory(wallet.id, {
      page,
      limit,
      type,
    });

    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch transactions", detail: err.message });
  }
});

import { ExchangeRateService } from "../modules/currency/exchange.js";

/**
 * GET /api/wallet/exchange-rate
 * Live exchange rate endpoint directly fetching and caching current market rates.
 */
walletRouter.get("/exchange-rate", async (req: Request, res: Response) => {
  const forceRefresh = req.query.refresh === "true";
  const details = await ExchangeRateService.getRateDetails(forceRefresh);
  res.json(details);
});

/**
 * POST /api/wallet/topup-request
 * Handles customer deposit / topup initiation.
 */
walletRouter.post("/topup-request", authenticateRequest, requireCustomer, async (req: Request, res: Response) => {
  try {
    const {
      amount,
      name,
      contact,
      phone,
      payment_method = "MONCASH",
      currency = "USD",
      return_url,
      cancel_url,
    } = req.body;

    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || !Number.isFinite(depositAmount) || depositAmount <= 0) {
      res.status(400).json({ detail: "Please provide a valid deposit amount greater than $0." });
      return;
    }

    if (depositAmount > 50000) {
      res.status(400).json({ detail: "Single deposit amount cannot exceed $50,000.00 USD." });
      return;
    }

    const contactPhone = (contact || phone || "").trim();
    const customerName = (name || "").trim();

    // If contact or name provided, update customer profile if not currently set
    if (contactPhone || customerName) {
      const nameParts = customerName.split(" ");
      const fName = nameParts[0] || undefined;
      const lName = nameParts.slice(1).join(" ") || undefined;
      await query(
        `UPDATE customer_profiles 
         SET phone = COALESCE(phone, $1),
             first_name = COALESCE(first_name, $2),
             last_name = COALESCE(last_name, $3)
         WHERE id = $4`,
        [contactPhone || null, fName || null, lName || null, req.user!.customerId!]
      );
    }

    const wallet = await getCustomerWallet(req.user!.id);
    const orderId = `IMX-TOP-${Date.now().toString().slice(-6)}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const normalizedMethod = (payment_method || "MONCASH").toLowerCase();

    // 1. Route to PayPal Gateway if requested
    if (normalizedMethod === "paypal") {
      const result = await PayPalService.createDepositOrder({
        walletId: wallet.id,
        customerId: req.user!.customerId!,
        amount: depositAmount,
        currency,
        returnUrl: return_url,
        cancelUrl: cancel_url,
      });

      res.json({
        status: result.status,
        order_id: result.order_id,
        checkout_url: result.checkout_url,
        payment_reference: result.payment_reference,
        provider_reference: result.provider_reference,
        amount: result.amount,
        currency: result.currency,
        message: result.message,
      });
      return;
    }

    // 2. Otherwise route via PaymProviderService (MonCash, Natcash, Haiti local payment methods)
    const result = await PaymProviderService.initiateDeposit({
      walletId: wallet.id,
      customerId: req.user!.customerId!,
      amount: depositAmount,
      currency,
      paymentMethod: payment_method,
      phoneNumber: contactPhone || undefined,
      returnUrl: return_url,
      cancelUrl: cancel_url,
    });

    res.json({
      status: result.status,
      order_id: orderId,
      checkout_url: result.checkout_url,
      payment_reference: result.payment_reference,
      provider_reference: result.provider_reference,
      amount: result.amount,
      currency: result.currency,
      message: result.message,
    });
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/wallet/topup/confirm
 * Server-side verification and atomic ledger crediting upon PayPal or Pay'm payment completion.
 */
walletRouter.post("/topup/confirm", authenticateRequest, requireCustomer, async (req: Request, res: Response) => {
  try {
    const { payment_reference } = req.body;
    if (!payment_reference) {
      res.status(400).json({ detail: "Payment reference is required" });
      return;
    }

    const wallet = await getCustomerWallet(req.user!.id);
    const attemptRes = await query(
      `SELECT * FROM payment_attempts WHERE internal_reference = $1 AND wallet_id = $2`,
      [payment_reference, wallet.id]
    );

    if (attemptRes.rows.length === 0) {
      res.status(404).json({ detail: "Payment record not found" });
      return;
    }

    const attempt = attemptRes.rows[0];
    if (attempt.status === "SUCCEEDED") {
      const updatedWallet = await WalletLedgerService.getWalletBalance(wallet.id);
      res.json({
        success: true,
        status: "SUCCEEDED",
        message: "Wallet topped up successfully!",
        wallet: updatedWallet,
      });
      return;
    }

    // 1. Branch for PayPal payments
    if (attempt.provider === "PAYPAL") {
      const verification = await PayPalService.captureAndVerifyOrder(
        attempt.provider_reference,
        Number(attempt.amount)
      );

      if (verification.verified && verification.status === "SUCCEEDED") {
        const idempotencyKey = `paypal_confirm_${attempt.provider_reference}`;
        await WalletLedgerService.recordVerifiedDeposit(
          wallet.id,
          Number(attempt.amount),
          attempt.internal_reference,
          idempotencyKey,
          `PayPal deposit #${attempt.internal_reference}`,
          { verifiedBy: "user_session", verification }
        );

        await query(
          `UPDATE payment_attempts 
           SET status = 'SUCCEEDED', 
               verified_at = NOW(), 
               updated_at = NOW(),
               provider_payload = $2 
           WHERE id = $1`,
          [attempt.id, JSON.stringify(verification.raw || {})]
        );
      }

      const updatedWallet = await WalletLedgerService.getWalletBalance(wallet.id);
      res.json({
        success: verification.status === "SUCCEEDED",
        status: verification.status,
        wallet: updatedWallet,
        message:
          verification.status === "SUCCEEDED"
            ? "PayPal payment verified! Your spendable wallet balance has been credited."
            : verification.message || "Payment is pending authorization on PayPal.",
      });
      return;
    }

    // 2. Branch for Pay'm provider (MonCash / Natcash)
    const verification = await PaymProviderService.verifyWithProvider({
      referenceId: attempt.internal_reference,
      transactionId: attempt.provider_reference,
    });

    if (verification.verified && verification.status === "SUCCEEDED") {
      const idempotencyKey = `paym_confirm_${attempt.internal_reference}`;
      await WalletLedgerService.recordVerifiedDeposit(
        wallet.id,
        Number(attempt.amount),
        attempt.internal_reference,
        idempotencyKey,
        `Pay'm deposit #${attempt.internal_reference} (${attempt.payment_method})`,
        { verifiedBy: "user_session", verification }
      );

      await query(
        `UPDATE payment_attempts SET status = 'SUCCEEDED', verified_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [attempt.id]
      );
    }

    const updatedWallet = await WalletLedgerService.getWalletBalance(wallet.id);
    res.json({
      success: verification.status === "SUCCEEDED",
      status: verification.status,
      wallet: updatedWallet,
      message:
        verification.status === "SUCCEEDED"
          ? "Deposit verified! Your spendable wallet balance has been credited."
          : "Payment is pending authorization on Pay'm portal.",
    });
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/payments/paym/initiate
 */
walletRouter.post("/payments/paym/initiate", authenticateRequest, requireCustomer, async (req: Request, res: Response) => {
  try {
    const { amount, currency = "USD", payment_method = "MONCASH", return_url, cancel_url } = req.body;
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || !Number.isFinite(depositAmount) || depositAmount <= 0) {
      res.status(400).json({ detail: "Please provide a valid deposit amount greater than $0." });
      return;
    }

    if (depositAmount > 50000) {
      res.status(400).json({ detail: "Single deposit amount cannot exceed $50,000.00 USD." });
      return;
    }

    const wallet = await getCustomerWallet(req.user!.id);

    const result = await PaymProviderService.initiateDeposit({
      walletId: wallet.id,
      customerId: req.user!.customerId!,
      amount: depositAmount,
      currency,
      paymentMethod: payment_method,
      returnUrl: return_url,
      cancelUrl: cancel_url,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ detail: err.message });
  }
});

/**
 * POST /api/payments/paym/webhook
 * Authenticated Pay'm webhook with signature verification and atomic ledger crediting.
 */
walletRouter.post("/payments/paym/webhook", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = (req.headers["x-webhook-signature"] || req.headers["x-paym-signature"]) as string | undefined;

    const result = await PaymProviderService.processWebhook(rawBody, signature);
    res.json(result);
  } catch (err: any) {
    console.error("Pay'm webhook error:", err.message);
    res.status(400).json({ error: "Webhook processing error", detail: err.message });
  }
});

/**
 * GET /api/payments/paym/status/:reference
 * IDOR Protected: Customer can only query their own payment status.
 */
walletRouter.get("/payments/paym/status/:reference", authenticateRequest, requireAuth, async (req: Request, res: Response) => {
  try {
    const refRes = await query(
      `SELECT * FROM payment_attempts WHERE internal_reference = $1`,
      [req.params.reference]
    );

    if (refRes.rows.length === 0) {
      res.status(404).json({ detail: "Payment attempt not found" });
      return;
    }

    const row = refRes.rows[0];

    // IDOR check: Non-staff users can only access payment attempts belonging to their own wallet
    if (!req.user!.isStaff) {
      const wallet = await getCustomerWallet(req.user!.id);
      if (row.wallet_id !== wallet.id) {
        res.status(404).json({ detail: "Payment attempt not found" });
        return;
      }
    }

    res.json({
      internal_reference: row.internal_reference,
      provider: row.provider,
      status: row.status,
      amount: Number(row.amount),
      currency: row.currency,
      payment_method: row.payment_method,
      verified_at: row.verified_at,
      created_at: row.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Status check failed", detail: err.message });
  }
});

/**
 * POST /api/wallet/payments/paypal/webhook
 * PayPal Webhook listener with signature verification and idempotent ledger crediting.
 */
walletRouter.post("/payments/paypal/webhook", async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = await PayPalService.verifyWebhookSignature(req.headers as any, rawBody);
    if (!isValid) {
      res.status(400).json({ error: "Invalid PayPal webhook signature" });
      return;
    }

    const event = typeof req.body === "object" ? req.body : JSON.parse(rawBody);
    const eventType = event.event_type;

    if (eventType === "CHECKOUT.ORDER.APPROVED" || eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource;
      const orderId = resource.id;

      // Find corresponding attempt
      const attemptRes = await query(
        `SELECT * FROM payment_attempts WHERE provider_reference = $1 AND provider = 'PAYPAL'`,
        [orderId]
      );

      if (attemptRes.rows.length > 0) {
        const attempt = attemptRes.rows[0];
        if (attempt.status !== "SUCCEEDED") {
          const verification = await PayPalService.captureAndVerifyOrder(orderId, Number(attempt.amount));
          if (verification.verified && verification.status === "SUCCEEDED") {
            const idempotencyKey = `paypal_webhook_${orderId}`;
            await WalletLedgerService.recordVerifiedDeposit(
              attempt.wallet_id,
              Number(attempt.amount),
              attempt.internal_reference,
              idempotencyKey,
              `PayPal deposit #${attempt.internal_reference} (Webhook)`,
              { eventType, resourceId: resource.id }
            );

            await query(
              `UPDATE payment_attempts 
               SET status = 'SUCCEEDED', 
                   verified_at = NOW(), 
                   updated_at = NOW(),
                   provider_payload = $2 
               WHERE id = $1`,
              [attempt.id, JSON.stringify(resource)]
            );
          }
        }
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("PayPal webhook error:", err.message);
    res.status(400).json({ error: "Webhook processing error", detail: err.message });
  }
});

