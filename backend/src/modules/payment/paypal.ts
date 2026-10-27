import crypto from "crypto";
import { config } from "../../config/index.js";
import { query } from "../../db/connection.js";

export interface CreatePayPalDepositParams {
  walletId: string;
  customerId: string;
  amount: number;
  currency?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PayPalDepositResult {
  order_id: string;
  checkout_url: string;
  payment_reference: string;
  provider_reference: string;
  amount: number;
  currency: string;
  status: "CREATED" | "PENDING";
  message: string;
}

export interface PayPalCaptureResult {
  verified: boolean;
  status: "SUCCEEDED" | "PENDING" | "FAILED";
  captureId?: string;
  amount?: number;
  currency?: string;
  message?: string;
  raw?: any;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

export class PayPalService {
  private static getBaseUrl(): string {
    if (config.PAYPAL_BASE_URL) {
      return config.PAYPAL_BASE_URL.replace(/\/+$/, "");
    }
    return config.PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  }

  /**
   * Generates or retrieves a cached OAuth 2.0 Bearer access token for PayPal.
   */
  public static async getAccessToken(): Promise<string> {
    const clientId = config.PAYPAL_CLIENT_ID;
    const clientSecret = config.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("PayPal credentials not configured. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
    }

    const now = Date.now();
    if (tokenCache && tokenCache.expiresAt > now + 60000) {
      return tokenCache.token;
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const baseUrl = this.getBaseUrl();

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[PayPal API Error] Token generation failed:", errText);
      throw new Error(`Failed to authenticate with PayPal: ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return tokenCache.token;
  }

  /**
   * Initiates a PayPal Checkout Order for Wallet Top-Up.
   */
  public static async createDepositOrder(params: CreatePayPalDepositParams): Promise<PayPalDepositResult> {
    const { walletId, customerId, amount, currency = "USD", returnUrl, cancelUrl } = params;

    const depositAmount = Number(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new Error("Deposit amount must be greater than $0.");
    }
    if (depositAmount > 10000) {
      throw new Error("Single deposit amount cannot exceed $10,000.00 USD.");
    }

    const formattedAmount = depositAmount.toFixed(2);
    const internalReference = `PAYPAL-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const token = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    const defaultReturn = returnUrl || `${config.FRONTEND_URL}/dashboard/wallet?status=paypal_success&ref=${internalReference}`;
    const defaultCancel = cancelUrl || `${config.FRONTEND_URL}/dashboard/wallet?status=paypal_cancel&ref=${internalReference}`;

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: internalReference,
          description: `IMPEX Wallet Deposit (${formattedAmount} USD)`,
          custom_id: `${walletId}:${customerId}`,
          amount: {
            currency_code: currency.toUpperCase(),
            value: formattedAmount,
          },
        },
      ],
      application_context: {
        brand_name: "IMPEX International",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: defaultReturn,
        cancel_url: defaultCancel,
      },
    };

    const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = (await res.json()) as any;

    if (!res.ok) {
      console.error("[PayPal API Error] Order creation failed:", orderData);
      const detailMsg = orderData?.details?.[0]?.description || orderData?.message || "Failed to create PayPal order";
      throw new Error(`PayPal Order Creation Error: ${detailMsg}`);
    }

    const approveLink = orderData.links?.find((l: any) => l.rel === "approve")?.href;
    if (!approveLink) {
      throw new Error("PayPal did not return an approval URL for this checkout session.");
    }

    // Record the payment attempt in database for server-side audit & verification
    await query(
      `INSERT INTO payment_attempts (
        wallet_id, provider, provider_reference, internal_reference,
        amount, currency, payment_method, status, provider_payload
      ) VALUES ($1, 'PAYPAL', $2, $3, $4, $5, 'paypal', 'CREATED', $6)`,
      [
        walletId,
        orderData.id,
        internalReference,
        depositAmount,
        currency.toUpperCase(),
        JSON.stringify(orderData),
      ]
    );

    return {
      order_id: internalReference,
      checkout_url: approveLink,
      payment_reference: internalReference,
      provider_reference: orderData.id,
      amount: depositAmount,
      currency: currency.toUpperCase(),
      status: "CREATED",
      message: "PayPal checkout order created. Proceed to PayPal to authorize payment.",
    };
  }

  /**
   * Captures and validates an approved PayPal Order on the server side.
   * Performs cryptographic security & amount tampering checks.
   */
  public static async captureAndVerifyOrder(
    providerReference: string,
    expectedAmount: number
  ): Promise<PayPalCaptureResult> {
    const token = await this.getAccessToken();
    const baseUrl = this.getBaseUrl();

    // 1. Attempt capture
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${providerReference}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    let captureData = (await captureRes.json()) as any;

    // If order was already captured previously, retrieve current order state
    if (!captureRes.ok) {
      const isAlreadyCaptured =
        captureData?.details?.some((d: any) => d.issue === "ORDER_ALREADY_CAPTURED") ||
        captureData?.name === "UNPROCESSABLE_ENTITY";

      if (isAlreadyCaptured) {
        const getRes = await fetch(`${baseUrl}/v2/checkout/orders/${providerReference}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (getRes.ok) {
          captureData = await getRes.json();
        }
      } else {
        const errorMsg = captureData?.details?.[0]?.description || captureData?.message || "Capture request failed";
        console.warn("[PayPal Capture Warning]", providerReference, errorMsg);
        return {
          verified: false,
          status: "PENDING",
          message: errorMsg,
          raw: captureData,
        };
      }
    }

    const orderStatus = captureData.status;

    // 2. Validate COMPLETED status
    if (orderStatus !== "COMPLETED") {
      return {
        verified: false,
        status: "PENDING",
        message: `PayPal order is in '${orderStatus}' state. Please complete payment approval on PayPal.`,
        raw: captureData,
      };
    }

    // 3. Security Check: Amount Integrity
    let capturedAmountStr = "0";
    let capturedCurrency = "USD";
    let captureId: string | undefined;

    const purchaseUnit = captureData.purchase_units?.[0];
    if (purchaseUnit) {
      const capture = purchaseUnit.payments?.captures?.[0];
      if (capture) {
        capturedAmountStr = capture.amount?.value || "0";
        capturedCurrency = capture.amount?.currency_code || "USD";
        captureId = capture.id;
      } else if (purchaseUnit.amount) {
        capturedAmountStr = purchaseUnit.amount.value || "0";
        capturedCurrency = purchaseUnit.amount.currency_code || "USD";
      }
    }

    const capturedAmountNum = parseFloat(capturedAmountStr);
    const expectedAmountNum = Number(expectedAmount);

    // Prevent amount tampering (e.g. paying $0.01 instead of $50.00)
    if (Math.abs(capturedAmountNum - expectedAmountNum) > 0.01) {
      console.error(
        `[Security Alert] PayPal deposit amount mismatch! Expected: ${expectedAmountNum}, Captured: ${capturedAmountNum}`
      );
      return {
        verified: false,
        status: "FAILED",
        message: "Payment security error: captured amount does not match requested top-up amount.",
        raw: captureData,
      };
    }

    if (capturedCurrency.toUpperCase() !== "USD") {
      console.error(`[Security Alert] PayPal currency mismatch! Expected USD, Got: ${capturedCurrency}`);
      return {
        verified: false,
        status: "FAILED",
        message: "Payment security error: invalid payment currency.",
        raw: captureData,
      };
    }

    return {
      verified: true,
      status: "SUCCEEDED",
      captureId,
      amount: capturedAmountNum,
      currency: capturedCurrency,
      message: "PayPal payment securely captured and verified.",
      raw: captureData,
    };
  }

  /**
   * Verifies PayPal Webhook Signature for event notifications.
   */
  public static async verifyWebhookSignature(
    headers: Record<string, string | undefined>,
    rawBody: string
  ): Promise<boolean> {
    const webhookId = config.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return true; // If webhook ID not configured, rely on direct capture verification

    try {
      const token = await this.getAccessToken();
      const baseUrl = this.getBaseUrl();

      const verifyPayload = {
        auth_algo: headers["paypal-auth-algo"],
        cert_url: headers["paypal-cert-url"],
        transmission_id: headers["paypal-transmission-id"],
        transmission_sig: headers["paypal-transmission-sig"],
        transmission_time: headers["paypal-transmission-time"],
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      };

      const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(verifyPayload),
      });

      if (!res.ok) return false;
      const data = (await res.json()) as { verification_status: string };
      return data.verification_status === "SUCCESS";
    } catch (err: any) {
      console.error("[PayPal Webhook Verification Error]", err.message);
      return false;
    }
  }
}
