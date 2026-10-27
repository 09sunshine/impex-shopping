import { describe, it, expect, vi } from "vitest";
import { EmailService } from "../src/modules/email/service.js";

describe("IMPEX Bilingual (French + English) Email Notification System", () => {
  it("sendOtpEmail produces a bilingual email with OTP code", async () => {
    const sendSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValueOnce(true);

    const success = await EmailService.sendOtpEmail("test@example.com", "123456", "LOGIN");
    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledOnce();

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.to).toBe("test@example.com");
    // Subject has both languages
    expect(callArgs.subject).toContain("Code de Sécurité");
    expect(callArgs.subject).toContain("Security Code");
    expect(callArgs.subject).toContain("123456");

    // Body contains French and English
    expect(callArgs.text).toContain("Votre code de vérification");
    expect(callArgs.text).toContain("Your 6-digit IMPEX verification code");
    expect(callArgs.html).toContain("123456");
    expect(callArgs.html).toContain("Vérification de Sécurité");
    expect(callArgs.html).toContain("Security Verification");

    sendSpy.mockRestore();
  });

  it("sendOrderPlacedEmail produces a complete bilingual order receipt", async () => {
    const sendSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValueOnce(true);

    const success = await EmailService.sendOrderPlacedEmail("shopper@example.com", {
      customerName: "Jean-Pierre",
      orderNumber: "IMX-123456-AB",
      productName: "Sony Wireless Headphones",
      merchantName: "Amazon",
      productUrl: "https://www.amazon.com/dp/B08N5WRWNW",
      quantity: 2,
      totalUsd: 150.0,
      totalHtg: 19875,
      destinationDepot: "Dépôt Port-au-Prince",
    });

    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledOnce();

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.to).toBe("shopper@example.com");
    expect(callArgs.subject).toContain("Commande Reçue");
    expect(callArgs.subject).toContain("Order Placed");
    expect(callArgs.subject).toContain("IMX-123456-AB");

    // Both French and English sections exist
    expect(callArgs.text).toContain("FRANÇAIS :");
    expect(callArgs.text).toContain("ENGLISH:");
    expect(callArgs.text).toContain("Sony Wireless Headphones");
    expect(callArgs.text).toContain("$150.00 USD");

    expect(callArgs.html).toContain("Jean-Pierre");
    expect(callArgs.html).toContain("Détails de la Commande");
    expect(callArgs.html).toContain("Order Summary");
    expect(callArgs.html).toContain("Amazon");
    expect(callArgs.html).toContain("19,875 HTG");

    sendSpy.mockRestore();
  });

  it("sendPaymentConfirmedEmail produces a bilingual payment confirmation receipt", async () => {
    const sendSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValueOnce(true);

    const success = await EmailService.sendPaymentConfirmedEmail("client@example.com", {
      customerName: "Marie Curie",
      transactionRef: "PAYM-889900",
      amountUsd: 75.0,
      amountHtg: 9938,
      paymentMethod: "MonCash USSD",
      orderNumber: "IMX-998877",
      walletBalanceUsd: 120.0,
    });

    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledOnce();

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.to).toBe("client@example.com");
    expect(callArgs.subject).toContain("Paiement Confirmé");
    expect(callArgs.subject).toContain("Payment Confirmed");
    expect(callArgs.subject).toContain("PAYM-889900");

    expect(callArgs.text).toContain("FRANÇAIS :");
    expect(callArgs.text).toContain("ENGLISH:");
    expect(callArgs.text).toContain("MonCash USSD");

    expect(callArgs.html).toContain("Marie Curie");
    expect(callArgs.html).toContain("Reçu de Transaction");
    expect(callArgs.html).toContain("Transaction Receipt");
    expect(callArgs.html).toContain("$75.00 USD");
    expect(callArgs.html).toContain("$120.00 USD");

    sendSpy.mockRestore();
  });

  it("sendOrderStatusUpdateEmail handles ARRIVED_AT_IMPEX with pickup code in both languages", async () => {
    const sendSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValueOnce(true);

    const success = await EmailService.sendOrderStatusUpdateEmail(
      "haiti.customer@example.com",
      "ARRIVED_AT_IMPEX",
      {
        customerName: "Alexandre",
        orderNumber: "IMX-554433",
        productName: "Nike Running Shoes",
        merchantName: "Nike Store",
        quantity: 1,
        totalUsd: 110.0,
        pickupCode: "789123",
      }
    );

    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledOnce();

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.subject).toContain("Colis Arrivé chez IMPEX");
    expect(callArgs.subject).toContain("Package Arrived at IMPEX");

    expect(callArgs.text).toContain("CODE SECRET DE RETRAIT (OTP) AU COMPTOIR : 789123");
    expect(callArgs.text).toContain("SECRET COUNTER PICKUP CODE (OTP): 789123");

    expect(callArgs.html).toContain("Code Secret de Retrait");
    expect(callArgs.html).toContain("Counter Pickup OTP");
    expect(callArgs.html).toContain("789123");

    sendSpy.mockRestore();
  });

  it("sendOrderStatusUpdateEmail handles REFUNDED with refund explanation", async () => {
    const sendSpy = vi.spyOn(EmailService, "sendEmail").mockResolvedValueOnce(true);

    const success = await EmailService.sendOrderStatusUpdateEmail(
      "refund.client@example.com",
      "REFUNDED",
      {
        customerName: "Jean",
        orderNumber: "IMX-112233",
        productName: "Out of Stock Jacket",
        merchantName: "Zara",
        quantity: 1,
        totalUsd: 85.0,
        notes: "Merchant out of stock",
      }
    );

    expect(success).toBe(true);
    expect(sendSpy).toHaveBeenCalledOnce();

    const callArgs = sendSpy.mock.calls[0][0];
    expect(callArgs.subject).toContain("Remboursement Effectué");
    expect(callArgs.subject).toContain("Refund Credited");
    expect(callArgs.html).toContain("Remboursement Effectué sur votre Portefeuille");
    expect(callArgs.html).toContain("Refund Credited to Wallet");

    sendSpy.mockRestore();
  });
});
