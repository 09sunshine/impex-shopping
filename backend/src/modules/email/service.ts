import nodemailer, { type Transporter } from 'nodemailer';
import crypto from 'crypto';
import { ExchangeRateService } from '../currency/exchange.js';

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface OrderEmailData {
  customerName?: string;
  orderNumber: string;
  productName: string;
  merchantName: string;
  productUrl?: string | null;
  quantity: number;
  totalUsd: number;
  totalHtg?: number;
  status?: string;
  destinationDepot?: string;
  pickupCode?: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
}

export interface PaymentEmailData {
  customerName?: string;
  transactionRef: string;
  amountUsd: number;
  amountHtg?: number;
  paymentMethod: string;
  orderNumber?: string;
  walletBalanceUsd?: number;
  walletBalanceHtg?: number;
  date?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;

  private static getHtgRate(): number {
    return ExchangeRateService.getCachedRate();
  }

  private static getTransporter(): Transporter | null {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    if (this.transporter) {
      return this.transporter;
    }

    const service = process.env.SMTP_SERVICE?.trim();
    const host = process.env.SMTP_HOST?.trim() || (service === 'gmail' ? 'smtp.gmail.com' : undefined);
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER?.trim();
    const rawPass = process.env.SMTP_PASS?.trim();
    // Google App Passwords are 16 letters usually formatted in 4-letter chunks with spaces (e.g. "fsli xcgc maip kqew")
    const pass = (service === 'gmail' && rawPass) ? rawPass.replace(/\s+/g, '') : rawPass;

    if (!user || !pass || (!host && !service)) {
      return null;
    }

    if (service) {
      this.transporter = nodemailer.createTransport({
        service,
        auth: {
          user,
          pass,
        },
      });
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    } as any);

    return this.transporter;
  }

  public static generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Base HTML wrapper with responsive modern styling, bilingual headers, and branded footer.
   */
  private static renderBaseTemplate(options: {
    bannerTitleFr: string;
    bannerTitleEn: string;
    badgeTextFr: string;
    badgeTextEn: string;
    badgeColor?: string;
    contentHtml: string;
  }): string {
    const badgeColor = options.badgeColor || '#6366f1';

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IMPEX</title>
        <style>
          body { margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; padding: 32px 20px; }
          .card { background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3); }
          .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #334155; font-size: 14px; }
          .detail-label { color: #94a3b8; }
          .detail-value { font-weight: 600; color: #f1f5f9; text-align: right; }
          .button { display: inline-block; background-color: #6366f1; color: #ffffff !important; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 10px; text-decoration: none; margin-top: 20px; text-align: center; }
          .footer { margin-top: 32px; text-align: center; color: #64748b; font-size: 12px; line-height: 1.6; }
          .lang-divider { border-top: 1px dashed #334155; margin: 24px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Logo & Header -->
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; background-color: #6366f1; color: #ffffff; font-weight: 900; font-size: 20px; text-align: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);">
              IX
            </div>
            <h1 style="color: #ffffff; margin: 10px 0 2px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">IMPEX</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">
              Achats Internationaux &amp; Logistique Sécurisée vers Haïti<br>
              <span style="color: #64748b; font-size: 12px;">Global Shopping &amp; Secure Logistics to Haiti</span>
            </p>
          </div>

          <!-- Main Card -->
          <div class="card">
            <!-- Header Badges -->
            <div style="text-align: center; margin-bottom: 20px;">
              <span class="badge" style="background-color: ${badgeColor}20; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
                ${options.badgeTextFr} &bull; ${options.badgeTextEn}
              </span>
              <h2 style="font-size: 20px; font-weight: 800; color: #ffffff; margin: 14px 0 4px 0;">
                ${options.bannerTitleFr}
              </h2>
              <div style="font-size: 14px; color: #94a3b8; font-weight: 500;">
                ${options.bannerTitleEn}
              </div>
            </div>

            <!-- Injected Content -->
            ${options.contentHtml}
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin-bottom: 8px;">
              <strong>Centre Logistique IMPEX</strong><br>
              Miami Depot: 8400 NW 25th St, Doral, FL 33198, USA<br>
              Haïti Hub: Port-au-Prince, Haïti
            </p>
            <p style="margin-bottom: 8px;">
              Support Client: <a href="mailto:cargo@impexht.com" style="color: #818cf8; text-decoration: none;">cargo@impexht.com</a> &bull; 
              Plateforme: <a href="https://shopping.impexht.com" style="color: #818cf8; text-decoration: none;">shopping.impexht.com</a>
            </p>
            <p style="font-size: 11px; color: #475569; margin-top: 16px;">
              Cet e-mail est confidentiel et destiné uniquement à son destinataire. &bull; This email is confidential and intended solely for the recipient.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 1. Bilingual OTP Verification Email
   */
  public static async sendOtpEmail(to: string, otp: string, purpose: 'REGISTER' | 'LOGIN'): Promise<boolean> {
    const isRegister = purpose === 'REGISTER';
    const actionFr = isRegister ? "Création de Compte" : "Connexion Sécurisée";
    const actionEn = isRegister ? "Account Registration" : "Account Login";
    const subject = `IMPEX - Code de Sécurité / Security Code: ${otp}`;

    const text = `Bonjour / Hello,

Votre code de vérification à 6 chiffres pour la ${actionFr.toLowerCase()} est : ${otp}
(Your 6-digit IMPEX verification code for ${actionEn.toLowerCase()} is: ${otp})

Ce code expire dans 10 minutes. Ne le partagez avec personne.
(This code will expire in 10 minutes. Never share this code with anyone.)

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.
(If you did not request this, please ignore this email.)

- L'Équipe de Sécurité IMPEX / The IMPEX Security Team
https://shopping.impexht.com`;

    const contentHtml = `
      <!-- French Section -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 20px; text-align: center;">
        <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">
          Veuillez saisir ce code de sécurité à 6 chiffres pour valider votre <strong>${actionFr.toLowerCase()}</strong> sur IMPEX :
        </p>
        <div style="letter-spacing: 8px; font-size: 38px; font-weight: 900; color: #38bdf8; background: #1e293b; padding: 16px 20px; border-radius: 10px; border: 2px dashed #38bdf8; display: inline-block; margin-bottom: 12px;">
          ${otp}
        </div>
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          Ce code est valable pendant <strong>10 minutes</strong>. Ne le communiquez à personne.
        </p>
      </div>

      <!-- English Section Divider -->
      <div style="text-align: center; color: #64748b; font-size: 12px; margin: 16px 0;">
        &mdash; English version below &mdash;
      </div>

      <div style="background-color: #0f172a; border-radius: 12px; padding: 18px; border: 1px solid #1e293b; text-align: center;">
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 10px 0;">
          Please enter the 6-digit security code above to complete your <strong>${actionEn.toLowerCase()}</strong> on IMPEX.
        </p>
        <p style="color: #64748b; font-size: 11px; margin: 0;">
          Valid for 10 minutes. If you did not initiate this request, you can safely ignore this email.
        </p>
      </div>
    `;

    const html = this.renderBaseTemplate({
      bannerTitleFr: `Vérification de Sécurité`,
      bannerTitleEn: `Security Verification`,
      badgeTextFr: isRegister ? "Inscription" : "Connexion",
      badgeTextEn: isRegister ? "Sign Up" : "Sign In",
      badgeColor: "#38bdf8",
      contentHtml,
    });

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * 2. Bilingual Order Placed Confirmation Email
   */
  public static async sendOrderPlacedEmail(to: string, data: OrderEmailData): Promise<boolean> {
    const totalHtg = data.totalHtg || Math.round(data.totalUsd * this.getHtgRate());
    const subject = `IMPEX - Commande Reçue / Order Placed: #${data.orderNumber}`;

    const text = `Bonjour / Hello ${data.customerName || 'Client'},

FRANÇAIS :
Votre commande #${data.orderNumber} a bien été enregistrée sur IMPEX !
- Article : ${data.productName}
- Magasin : ${data.merchantName}
- Quantité : ${data.quantity}
- Total estimé : $${data.totalUsd.toFixed(2)} USD (~${totalHtg.toLocaleString()} HTG)
- Statut : Soumis pour inspection et validation des prix
Notre équipe au centre logistique de Miami examine actuellement votre demande.

ENGLISH:
Your order #${data.orderNumber} has been successfully submitted to IMPEX!
- Item: ${data.productName}
- Merchant: ${data.merchantName}
- Quantity: ${data.quantity}
- Estimated Total: $${data.totalUsd.toFixed(2)} USD (~${totalHtg.toLocaleString()} HTG)
- Status: Submitted for price review and verification
Our logistics team in Miami is currently processing your request.

Suivi / Track: https://shopping.impexht.com/orders
Besoin d'aide ? / Need help? cargo@impexht.com`;

    const contentHtml = `
      <div style="margin-bottom: 20px;">
        <p style="color: #f1f5f9; font-size: 15px; margin: 0 0 8px 0;">
          Bonjour <strong>${data.customerName || 'Client'}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
          Votre demande d'achat international a été reçue avec succès. Nos équipes à Miami vérifient les disponibilités et les frais auprès du marchand.
        </p>
      </div>

      <!-- Order Summary Table -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
          Détails de la Commande &bull; Order Summary
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">N&deg; Commande / Order ID:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #38bdf8;">#${data.orderNumber}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Article / Item:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.productName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Magasin / Merchant:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.merchantName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Quantité / Qty:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.quantity}</td>
          </tr>
          ${data.destinationDepot ? `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Dépôt de livraison / Hub:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.destinationDepot}</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 12px 0 4px 0; color: #f1f5f9; font-weight: 700; font-size: 15px;">Total Estimé / Total:</td>
            <td style="padding: 12px 0 4px 0; text-align: right; font-weight: 800; font-size: 18px; color: #34d399;">
              $${data.totalUsd.toFixed(2)} USD <span style="font-size: 13px; color: #94a3b8; font-weight: 500;">(~${totalHtg.toLocaleString()} HTG)</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://shopping.impexht.com/orders" class="button">
          Suivre Ma Commande &bull; Track Order &rarr;
        </a>
      </div>

      <!-- Bilingual Explanatory Note -->
      <div style="background-color: #0f172a; border-radius: 10px; padding: 16px; border-left: 4px solid #6366f1; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
        <p style="margin: 0 0 8px 0;">
          <strong>Prochaines étapes :</strong> Une fois le devis vérifié par notre agent, vous recevrez une notification pour confirmer l'achat direct avec vos fonds réservés.
        </p>
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">
          <strong>Next steps:</strong> Once our agent verifies merchant pricing and stock, you will receive an update to review and confirm purchase from your wallet hold.
        </p>
      </div>
    `;

    const html = this.renderBaseTemplate({
      bannerTitleFr: `Commande #${data.orderNumber} Reçue`,
      bannerTitleEn: `Order #${data.orderNumber} Received`,
      badgeTextFr: "Nouvelle Commande",
      badgeTextEn: "New Order",
      badgeColor: "#6366f1",
      contentHtml,
    });

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * 3. Bilingual Payment / Deposit Confirmation Email
   */
  public static async sendPaymentConfirmedEmail(to: string, data: PaymentEmailData): Promise<boolean> {
    const amountHtg = data.amountHtg || Math.round(data.amountUsd * this.getHtgRate());
    const subject = `IMPEX - Paiement Confirmé / Payment Confirmed: ${data.transactionRef}`;

    const text = `Bonjour / Hello ${data.customerName || 'Client'},

FRANÇAIS :
Votre paiement de $${data.amountUsd.toFixed(2)} USD (~${amountHtg.toLocaleString()} HTG) a été confirmé avec succès !
- Référence : ${data.transactionRef}
- Mode de paiement : ${data.paymentMethod}
- Date : ${data.date || new Date().toLocaleString()}
${data.orderNumber ? `- Commande associée : #${data.orderNumber}` : ''}
${data.walletBalanceUsd !== undefined ? `- Solde portefeuille disponible : $${data.walletBalanceUsd.toFixed(2)} USD` : ''}

ENGLISH:
Your payment of $${data.amountUsd.toFixed(2)} USD (~${amountHtg.toLocaleString()} HTG) has been confirmed!
- Reference: ${data.transactionRef}
- Payment Method: ${data.paymentMethod}
- Date: ${data.date || new Date().toLocaleString()}
${data.orderNumber ? `- Linked Order: #${data.orderNumber}` : ''}
${data.walletBalanceUsd !== undefined ? `- Spendable Wallet Balance: $${data.walletBalanceUsd.toFixed(2)} USD` : ''}

Consultez votre portefeuille / View Wallet: https://shopping.impexht.com/wallet
Support: cargo@impexht.com`;

    const contentHtml = `
      <div style="margin-bottom: 20px;">
        <p style="color: #f1f5f9; font-size: 15px; margin: 0 0 8px 0;">
          Bonjour <strong>${data.customerName || 'Client'}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0;">
          Nous confirmons la bonne réception de votre paiement. Votre portefeuille IMPEX a été crédité et vos transactions sont sécurisées par notre registre comptable.
        </p>
      </div>

      <!-- Payment Summary Table -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 20px; border: 1px solid #334155; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #34d399; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
          Reçu de Transaction &bull; Transaction Receipt
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Référence / Reference:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #f8fafc;">${data.transactionRef}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Méthode / Method:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.paymentMethod}</td>
          </tr>
          ${data.orderNumber ? `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Commande / Order:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #38bdf8;">#${data.orderNumber}</td>
          </tr>` : ''}
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Montant Payé / Amount Paid:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 800; font-size: 16px; color: #34d399;">
              $${data.amountUsd.toFixed(2)} USD <span style="font-size: 12px; color: #94a3b8;">(~${amountHtg.toLocaleString()} HTG)</span>
            </td>
          </tr>
          ${data.walletBalanceUsd !== undefined ? `
          <tr>
            <td style="padding: 10px 0 4px 0; color: #94a3b8;">Solde Disponible / Balance:</td>
            <td style="padding: 10px 0 4px 0; text-align: right; font-weight: 700; color: #f8fafc;">
              $${data.walletBalanceUsd.toFixed(2)} USD
            </td>
          </tr>` : ''}
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://shopping.impexht.com/wallet" class="button" style="background-color: #10b981;">
          Voir Mon Portefeuille &bull; View Wallet &rarr;
        </a>
      </div>

      <div style="background-color: #0f172a; border-radius: 10px; padding: 16px; font-size: 13px; color: #94a3b8; text-align: center;">
        Besoin d'un justificatif ou d'assistance ? &bull; Need assistance? Contactez <a href="mailto:cargo@impexht.com" style="color: #38bdf8; text-decoration: none;">cargo@impexht.com</a>
      </div>
    `;

    const html = this.renderBaseTemplate({
      bannerTitleFr: `Paiement Confirmé`,
      bannerTitleEn: `Payment Successfully Processed`,
      badgeTextFr: "Paiement Reçu",
      badgeTextEn: "Payment Received",
      badgeColor: "#34d399",
      contentHtml,
    });

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * 4. Bilingual Order Status Progression Email (Quote Ready, Purchased, In Transit, Arrived, Delivered, Refunded)
   */
  public static async sendOrderStatusUpdateEmail(
    to: string,
    statusType: 'QUOTE_READY' | 'PURCHASE_COMPLETED' | 'IN_TRANSIT' | 'ARRIVED_AT_IMPEX' | 'DELIVERED' | 'REFUNDED',
    data: OrderEmailData
  ): Promise<boolean> {
    const totalHtg = data.totalHtg || Math.round(data.totalUsd * this.getHtgRate());

    const configMap: Record<string, {
      titleFr: string;
      titleEn: string;
      badgeFr: string;
      badgeEn: string;
      color: string;
      descFr: string;
      descEn: string;
    }> = {
      QUOTE_READY: {
        titleFr: "Votre Devis Officiel Est Prêt (Valable 1h)",
        titleEn: "Your Official Quote Is Ready (Valid 1h)",
        badgeFr: "Devis Prêt - 1 Heure",
        badgeEn: "Quote Ready - 1 Hour",
        color: "#f59e0b",
        descFr: "Nos acheteurs ont vérifié les prix et la disponibilité. Attention : ce devis est valable pendant 1 heure seulement. Connectez-vous vite pour l'examiner et confirmer.",
        descEn: "Our purchasing team has verified pricing and stock. Warning: this quote is valid for 1 hour only. Please log in promptly to review and confirm.",
      },
      PURCHASE_COMPLETED: {
        titleFr: "Article Acheté auprès du Marchand",
        titleEn: "Item Purchased from Merchant",
        badgeFr: "Acheté",
        badgeEn: "Purchased",
        color: "#6366f1",
        descFr: "Votre commande a été passée avec succès auprès du vendeur international. Les fonds ont été capturés depuis votre portefeuille.",
        descEn: "Your order has been placed with the merchant. Reserved escrow funds have been captured to complete procurement.",
      },
      IN_TRANSIT: {
        titleFr: "Colis en Transit",
        titleEn: "Package In Transit",
        badgeFr: "En Transit",
        badgeEn: "In Transit",
        color: "#38bdf8",
        descFr: "Votre commande a quitté notre centre logistique et est en cours d'acheminement avec formalités douanières prises en charge.",
        descEn: "Your order has left our logistics facility and is currently in transit with customs clearance handled.",
      },
      ARRIVED_AT_IMPEX: {
        titleFr: "Colis Arrivé chez IMPEX & Prêt pour le Retrait !",
        titleEn: "Package Arrived at IMPEX & Ready for Pickup!",
        badgeFr: "Arrivé chez IMPEX",
        badgeEn: "Arrived at IMPEX",
        color: "#10b981",
        descFr: "Votre colis est inspecté et disponible dans notre agence IMPEX. Veuillez présenter votre code secret de retrait (OTP) au comptoir.",
        descEn: "Your package has arrived at our IMPEX facility and passed inspection. Please present your secret pickup OTP code at the counter.",
      },
      DELIVERED: {
        titleFr: "Colis Remis avec Succès",
        titleEn: "Package Successfully Delivered",
        badgeFr: "Livré",
        badgeEn: "Delivered",
        color: "#10b981",
        descFr: "Votre colis a été remis en mains propres avec succès. Merci d'avoir choisi IMPEX !",
        descEn: "Your package has been successfully delivered and received. Thank you for choosing IMPEX!",
      },
      REFUNDED: {
        titleFr: "Remboursement Effectué sur votre Portefeuille",
        titleEn: "Refund Credited to Wallet",
        badgeFr: "Remboursé",
        badgeEn: "Refunded",
        color: "#f43f5e",
        descFr: "Un remboursement a été crédité sur votre portefeuille IMPEX. Vos fonds sont immédiatement réutilisables ou retirables.",
        descEn: "A refund has been credited back to your IMPEX wallet balance and is available for immediate use.",
      },
    };

    const cfg = configMap[statusType] || configMap.QUOTE_READY;
    const isQuote = statusType === 'QUOTE_READY';
    const subject = isQuote
      ? `IMPEX - Urgent (1 Heure) : Devis Prêt pour la Commande #${data.orderNumber}`
      : `IMPEX - #${data.orderNumber} : ${cfg.titleFr} / ${cfg.titleEn}`;

    const text = `Bonjour / Hello ${data.customerName || 'Client'},

${cfg.titleFr.toUpperCase()} / ${cfg.titleEn.toUpperCase()}
Commande / Order: #${data.orderNumber}
Article / Item: ${data.productName} (${data.merchantName})
${isQuote ? `\n⚠️ ATTENTION: CE DEVIS EST VALABLE PENDANT 1 HEURE SEULEMENT.\nConnectez-vous pour examiner le devis et confirmer votre commande avant expiration.\n⚠️ WARNING: THIS QUOTE IS STRICTLY VALID FOR 1 HOUR ONLY.\nPlease log in immediately to review quote details and confirm your order.\n` : ''}
FRANÇAIS :
${cfg.descFr}
${data.pickupCode ? `CODE SECRET DE RETRAIT (OTP) AU COMPTOIR : ${data.pickupCode}\n` : ''}
${data.trackingNumber ? `Numéro de suivi : ${data.trackingNumber} (${data.carrier || 'Fret Aérien'})\n` : ''}

ENGLISH:
${cfg.descEn}
${data.pickupCode ? `SECRET COUNTER PICKUP CODE (OTP): ${data.pickupCode}\n` : ''}
${data.trackingNumber ? `Tracking Number: ${data.trackingNumber} (${data.carrier || 'Air Freight'})\n` : ''}

Examiner / Suivre sur IMPEX / Review or Track: https://shopping.impexht.com/orders
Support: cargo@impexht.com`;

    const contentHtml = `
      <div style="margin-bottom: 20px;">
        <p style="color: #f1f5f9; font-size: 15px; margin: 0 0 8px 0;">
          Bonjour <strong>${data.customerName || 'Client'}</strong>,
        </p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 6px 0;">
          ${cfg.descFr}
        </p>
        <p style="color: #94a3b8; font-size: 13px; line-height: 1.4; margin: 0;">
          ${cfg.descEn}
        </p>
      </div>

      ${isQuote ? `
      <!-- 1-Hour Quote Expiration Warning Banner -->
      <div style="background-color: #451a03; border-radius: 12px; padding: 18px 20px; border: 2px solid #f59e0b; margin-bottom: 24px; text-align: left;">
        <div style="color: #fbbf24; font-size: 15px; font-weight: 800; display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          ⏱️ AVERTISSEMENT : DEVIS VALABLE 1 HEURE SEULEMENT &bull; 1-HOUR EXPIRY
        </div>
        <p style="color: #fef3c7; font-size: 13px; line-height: 1.5; margin: 0 0 8px 0;">
          Les prix des commerçants internationaux et la disponibilité des stocks fluctuent en continu. Pour garantir ce tarif, veuillez vous connecter et valider ce devis dans un délai de <strong>1 heure</strong>.
        </p>
        <p style="color: #fcd34d; font-size: 12px; line-height: 1.4; margin: 0;">
          International merchant prices and stock availability change constantly. To lock in this price, please log in and confirm this quote within <strong>1 hour</strong>.
        </p>
      </div>
      ` : ''}

      ${data.pickupCode ? `
      <!-- Highlighted Pickup Code Box for Haiti Counter Collection -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 24px; border: 2px solid #10b981; text-align: center; margin-bottom: 24px;">
        <div style="color: #34d399; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">
          Code Secret de Retrait (OTP) &bull; Counter Pickup OTP
        </div>
        <div style="letter-spacing: 6px; font-size: 36px; font-weight: 900; color: #ffffff; background-color: #1e293b; padding: 12px 24px; border-radius: 8px; display: inline-block; margin-bottom: 10px;">
          ${data.pickupCode}
        </div>
        <p style="color: #cbd5e1; font-size: 13px; margin: 0;">
          Veuillez présenter ce code à 6 chiffres ainsi qu'une pièce d'identité valide lors du retrait à l'agence IMPEX.<br>
          <span style="color: #94a3b8; font-size: 11px;">Present this 6-digit code with your valid ID at the IMPEX pickup counter.</span>
        </p>
      </div>
      ` : ''}

      <!-- Order Details -->
      <div style="background-color: #0f172a; border-radius: 12px; padding: 18px; border: 1px solid #334155; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">N&deg; Commande / Order ID:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #38bdf8;">#${data.orderNumber}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Article / Item:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.productName}</td>
          </tr>
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">Marchand / Merchant:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.merchantName}</td>
          </tr>
          ${data.trackingNumber ? `
          <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px 0; color: #94a3b8;">N&deg; Suivi / Tracking:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #f8fafc;">${data.trackingNumber} (${data.carrier || 'Express'})</td>
          </tr>` : ''}
          <tr>
            <td style="padding: 10px 0 2px 0; color: #f1f5f9; font-weight: 700;">Montant / Total:</td>
            <td style="padding: 10px 0 2px 0; text-align: right; font-weight: 800; font-size: 16px; color: #34d399;">
              $${data.totalUsd.toFixed(2)} USD <span style="font-size: 12px; color: #94a3b8;">(~${totalHtg.toLocaleString()} HTG)</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="https://shopping.impexht.com/orders" class="button" style="background-color: ${cfg.color}; color: #0f172a !important;">
          Accéder à Ma Commande &bull; View Order &rarr;
        </a>
      </div>
    `;

    const html = this.renderBaseTemplate({
      bannerTitleFr: cfg.titleFr,
      bannerTitleEn: cfg.titleEn,
      badgeTextFr: cfg.badgeFr,
      badgeTextEn: cfg.badgeEn,
      badgeColor: cfg.color,
      contentHtml,
    });

    return this.sendEmail({ to, subject, text, html });
  }

  /**
   * Generic mail sender with SMTP delivery and fallback logger.
   */
  public static async sendEmail(options: EmailOptions): Promise<boolean> {
    const transporter = this.getTransporter();
    const fromAddress = process.env.SMTP_FROM || 'IMPEX International <noreply@impex.ht>';

    if (!transporter) {
      console.log(`\n================== [IMPEX BILINGUAL EMAIL] ==================`);
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body (Plaintext):\n${options.text}`);
      console.log(`=============================================================\n`);
      return true;
    }

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return true;
    } catch (error) {
      console.error('[EmailService] Failed to send email via SMTP, falling back to console log:', error);
      console.log(`\n================== [IMPEX FALLBACK EMAIL] ==================`);
      console.log(`To: ${options.to}`);
      console.log(`Subject: ${options.subject}`);
      console.log(`Body:\n${options.text}`);
      console.log(`============================================================\n`);
      return true;
    }
  }
}
