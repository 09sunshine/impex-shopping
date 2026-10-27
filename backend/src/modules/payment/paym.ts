import crypto from "crypto";
import { config } from "../../config/index.js";
import { query } from "../../db/connection.js";
import { WalletLedgerService } from "../wallet/ledger.js";
import { EmailService } from "../email/service.js";

export interface PaymInitiationResult {
  status: "PENDING" | "DISABLED" | "UNCONFIGURED";
  checkout_url?: string | null;
  payment_reference: string;
  provider_reference?: string;
  amount: number;
  currency: string;
  message: string;
}

export interface PaymVerificationResult {
  verified: boolean;
  payment_reference: string;
  provider_reference?: string;
  status: "SUCCEEDED" | "FAILED" | "PENDING" | "CANCELLED";
  amount: number;
  currency: string;
  raw_payload?: any;
  error?: string;
}

export class PaymProviderService {
  /**
   * Helper to retrieve configured client_id and client_secret.
   */
  static getCredentials(): { clientId?: string; clientSecret?: string } {
    return {
      clientId: config.PAYM_CLIENT_ID || config.PAYM_MERCHANT_ID,
      clientSecret: config.PAYM_CLIENT_SECRET || config.PAYM_WEBHOOK_SECRET || config.PAYM_API_KEY,
    };
  }

  /**
   * Check whether Pay'm is configured with real credentials and enabled.
   */
  static isConfigured(): boolean {
    const { clientId, clientSecret } = this.getCredentials();
    return (
      config.PAYM_ENABLED === "true" &&
      !!clientId &&
      !!clientSecret
    );
  }

  /**
   * Check gateway status overview for health checks and administration.
   */
  static getStatus(): {
    provider: string;
    is_enabled: boolean;
    is_configured: boolean;
    api_base_url: string;
    merchant_id_present: boolean;
    webhook_secret_present: boolean;
    business_approval_status: string;
  } {
    const { clientId, clientSecret } = this.getCredentials();
    return {
      provider: "Pay'm (Plop Plop Haiti Payment Gateway)",
      is_enabled: config.PAYM_ENABLED === "true",
      is_configured: this.isConfigured(),
      api_base_url: config.PAYM_API_BASE_URL,
      merchant_id_present: !!clientId,
      webhook_secret_present: !!clientSecret,
      business_approval_status: config.PAYM_ENABLED === "true"
        ? "AUTHORIZED"
        : "AWAITING_COMMERCIAL_ONBOARDING_APPROVAL",
    };
  }

  /**
   * Initiate a customer deposit via Pay'm (POST /api/paiement-marchand).
   */
  static async initiateDeposit(params: {
    walletId: string;
    customerId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    phoneNumber?: string;
    returnUrl?: string;
    cancelUrl?: string;
  }): Promise<PaymInitiationResult> {
    const {
      walletId,
      amount,
      currency = "HTG",
      paymentMethod = "moncash",
      phoneNumber,
    } = params;

    if (amount <= 0) {
      throw new Error("Deposit amount must be strictly greater than 0");
    }

    const internalReference = `PAYM-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    // Record internal payment attempt
    await query(
      `INSERT INTO payment_attempts (
         wallet_id, provider, internal_reference, amount, currency, payment_method, status
       ) VALUES ($1, 'PAYM', $2, $3, $4, $5, 'CREATED')`,
      [walletId, internalReference, amount, currency, paymentMethod]
    );

    // If Pay'm is not enabled or missing credentials, report clear structured status
    if (!this.isConfigured()) {
      await query(
        `UPDATE payment_attempts SET status = 'PENDING', provider_payload = $1 WHERE internal_reference = $2`,
        [JSON.stringify({ note: "Awaiting Pay'm merchant activation or offline desk reconciliation" }), internalReference]
      );

      return {
        status: "UNCONFIGURED",
        payment_reference: internalReference,
        amount,
        currency,
        message:
          "Pay'm production gateway credentials are not yet configured or awaiting merchant onboarding approval. Deposit attempt has been safely registered for manual desk verification.",
      };
    }

    const { clientId } = this.getCredentials();
    const baseUrl = config.PAYM_API_BASE_URL.replace(/\/+$/, "");

    // Normalizing payment method to Plop Plop supported values:
    // moncash, moncash_ussd, kashpaw, natcash, natcash_ussd, carte, all
    const normalizedMethod = paymentMethod.toLowerCase().trim();

    try {
      const response = await fetch(`${baseUrl}/api/paiement-marchand`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          refference_id: internalReference,
          montant: amount,
          payment_method: normalizedMethod,
          ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        }),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data || data.status !== true) {
        await query(
          `UPDATE payment_attempts SET status = 'FAILED', provider_payload = $1 WHERE internal_reference = $2`,
          [JSON.stringify({ error: data }), internalReference]
        );
        throw new Error(data?.message || `Pay'm API call failed with status ${response.status}`);
      }

      const transactionId = data.transaction_id || String(Date.now());

      await query(
        `UPDATE payment_attempts 
         SET status = 'PENDING', provider_reference = $1, provider_payload = $2 
         WHERE internal_reference = $3`,
        [transactionId, JSON.stringify(data), internalReference]
      );

      return {
        status: "PENDING",
        checkout_url: data.url,
        payment_reference: internalReference,
        provider_reference: transactionId,
        amount,
        currency,
        message: data.url
          ? "Payment initiated. Please complete your transaction on the payment page."
          : "USSD payment prompt sent to customer phone. Please authorize payment.",
      };
    } catch (err: any) {
      await query(
        `UPDATE payment_attempts SET status = 'FAILED', provider_payload = $1 WHERE internal_reference = $2`,
        [JSON.stringify({ exception: err.message }), internalReference]
      );
      throw err;
    }
  }

  /**
   * Verify transaction status via Plop Plop API (POST /api/paiement-verify).
   */
  static async verifyWithProvider(params: {
    referenceId?: string;
    transactionId?: string;
  }): Promise<PaymVerificationResult> {
    const { referenceId, transactionId } = params;
    const { clientId } = this.getCredentials();
    const baseUrl = config.PAYM_API_BASE_URL.replace(/\/+$/, "");

    const response = await fetch(`${baseUrl}/api/paiement-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        ...(referenceId ? { refference_id: referenceId } : {}),
        ...(transactionId ? { transaction_id: transactionId } : {}),
      }),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok || !data) {
      return {
        verified: false,
        payment_reference: referenceId || "",
        provider_reference: transactionId,
        status: "FAILED",
        amount: 0,
        currency: "HTG",
        raw_payload: data,
        error: data?.message || `Verification call failed: ${response.status}`,
      };
    }

    const isConfirmed = data.trans_status === "ok";
    return {
      verified: isConfirmed,
      payment_reference: data.refference_id || referenceId || "",
      provider_reference: data.transaction_id || transactionId,
      status: isConfirmed ? "SUCCEEDED" : "PENDING",
      amount: Number(data.montant || 0),
      currency: "HTG",
      raw_payload: data,
    };
  }

  /**
   * Verify Webhook Signature using client_secret (X-Webhook-Signature: sha256=<hmac>).
   */
  static verifyWebhookSignature(payloadString: string, signatureHeader?: string): boolean {
    const { clientSecret } = this.getCredentials();

    if (!clientSecret) {
      // If secret is not configured, return true only in non-production test environments
      return config.NODE_ENV !== "production";
    }
    if (!signatureHeader) return false;

    try {
      // Extract hash if prefixed with sha256=
      const cleanHeader = signatureHeader.startsWith("sha256=")
        ? signatureHeader.slice(7)
        : signatureHeader;

      const hmac = crypto
        .createHmac("sha256", clientSecret)
        .update(payloadString)
        .digest("hex");

      return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(cleanHeader));
    } catch {
      return false;
    }
  }

  /**
   * Process authenticated Pay'm webhook event.
   * Handles both transaction.status_changed and transaction.created events.
   * Enforces strict idempotency, prevents duplicate credits, and posts to ledger atomically.
   */
  static async processWebhook(rawBody: string, signature?: string): Promise<{ success: boolean; message: string }> {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new Error("Invalid Pay'm webhook signature");
    }

    const event = JSON.parse(rawBody);

    // Extract transaction details based on Plop Plop webhook structure
    const tx = event.transaction || {};
    const internalReference =
      tx.reference_id ||
      tx.refference_id ||
      event.reference_id ||
      event.refference_id ||
      event.order_id ||
      event.internal_reference;

    const providerTransactionId = tx.transaction_id || event.transaction_id;
    const newStatus = (tx.new_status || tx.status || event.status || "").toLowerCase();
    const eventId = event.timestamp || `${internalReference}-${Date.now()}`;

    if (!internalReference) {
      throw new Error("Missing transaction reference in Pay'm webhook");
    }

    const attemptRes = await query(
      `SELECT * FROM payment_attempts WHERE internal_reference = $1`,
      [internalReference]
    );

    if (attemptRes.rows.length === 0) {
      throw new Error(`Payment attempt ${internalReference} not found`);
    }

    const attempt = attemptRes.rows[0];

    // Deduplicate: If already succeeded, do NOT credit again
    if (attempt.status === "SUCCEEDED") {
      return { success: true, message: "Payment already successfully credited" };
    }

    if (newStatus === "ok" || newStatus === "succeeded" || newStatus === "success" || newStatus === "paid") {
      const idempotencyKey = `paym_dep_${internalReference}_${eventId}`;
      const amountToCredit = Number(tx.amount || attempt.amount);

      await WalletLedgerService.recordVerifiedDeposit(
        attempt.wallet_id,
        amountToCredit,
        internalReference,
        idempotencyKey,
        `Pay'm deposit #${internalReference} (${tx.method || attempt.payment_method})`,
        { provider: "PAYM", providerTransactionId, providerEvent: event }
      );

      await query(
        `UPDATE payment_attempts 
         SET status = 'SUCCEEDED', provider_reference = $1, provider_payload = $2, verified_at = NOW(), updated_at = NOW() 
         WHERE id = $3`,
        [providerTransactionId || attempt.provider_reference, JSON.stringify(event), attempt.id]
      );

      // Dispatch bilingual payment confirmed email notification (non-blocking)
      query(
        `SELECT u.email, u.name, c.first_name, c.last_name, w.spendable_balance
         FROM wallet_accounts w
         JOIN customer_profiles c ON c.id = w.customer_id
         JOIN "user" u ON u.id = c.user_id
         WHERE w.id = $1`,
        [attempt.wallet_id]
      ).then((userRes) => {
        if (userRes.rows.length > 0) {
          const row = userRes.rows[0];
          const name = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.name || 'Client';
          EmailService.sendPaymentConfirmedEmail(row.email, {
            customerName: name,
            transactionRef: internalReference,
            amountUsd: amountToCredit,
            paymentMethod: tx.method || attempt.payment_method || "MonCash / Natcash",
            walletBalanceUsd: Number(row.spendable_balance),
            date: new Date().toLocaleString(),
          }).catch((err) => console.warn("Failed to dispatch deposit confirmed email:", err));
        }
      }).catch(() => {});

      return { success: true, message: "Deposit verified and credited to wallet" };
    } else if (newStatus === "failed" || newStatus === "cancelled") {
      await query(
        `UPDATE payment_attempts 
         SET status = 'FAILED', provider_payload = $1, updated_at = NOW() 
         WHERE id = $2`,
        [JSON.stringify(event), attempt.id]
      );
      return { success: true, message: `Payment recorded as failed` };
    }

    return { success: true, message: "Payment event recorded in pending state" };
  }
}
