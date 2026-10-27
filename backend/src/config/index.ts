import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Load environment from backend directory, repo root, or current working directory
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "backend", ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

// Ensure DATABASE_URL is PostgreSQL
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("sqlite:")) {
  delete process.env.DATABASE_URL;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),
  BACKEND_URL: z.string().default("http://localhost:8000"),
  FRONTEND_URL: z.string().default("http://localhost:3001"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:5173,https://shopping.impexht.com,https://www.impexht.com"),
  COOKIE_DOMAIN: z.string().optional(),

  // Sourcing Strategy Feature Flag (url_only, hybrid, catalog)
  PRODUCT_SOURCE_MODE: z.enum(["url_only", "hybrid", "catalog"]).default("url_only"),

  // Database (Supabase PostgreSQL / local PostgreSQL)
  DATABASE_URL: z.string().default("postgres://postgres:postgres@localhost:5432/impex"),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),

  // Better Auth & Secrets
  BETTER_AUTH_SECRET: z.string().default("impex_production_secure_secret_key_change_in_prod_1234567890"),
  BETTER_AUTH_URL: z.string().default("http://localhost:8000"),
  JWT_SECRET: z.string().default("fMKiUk9jKH13g6Mpqm2KNCXc1SvNmXmE1Wax5yrvgm7"),
  JWT_EXPIRES_IN_MINUTES: z.coerce.number().default(1440),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Supabase Storage
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("impex-attachments"),

  // Pay'm Payment Gateway (Plop Plop Haiti API)
  PAYM_ENABLED: z.enum(["true", "false"]).default("false"),
  PAYM_API_BASE_URL: z.string().default("https://plopplop.solutionip.app"),
  PAYM_CLIENT_ID: z.string().optional(),
  PAYM_CLIENT_SECRET: z.string().optional(),
  PAYM_MERCHANT_ID: z.string().optional(),
  PAYM_API_KEY: z.string().optional(),
  PAYM_WEBHOOK_SECRET: z.string().optional(),

  // PayPal Gateway (Global USD Top-Up)
  PAYPAL_ENABLED: z.enum(["true", "false"]).default("true"),
  PAYPAL_MODE: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_BASE_URL: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Awin Feed Integration
  AWIN_PUBLISHER_ID: z.string().optional(),
  AWIN_API_KEY: z.string().optional(),
  AWIN_FEED_DATA_DIR: z.string().default("uploads/awin_feeds"),

  // Screenshot Storage
  SCREENSHOT_MAX_FILE_SIZE_MB: z.coerce.number().default(10),
  SCREENSHOT_UPLOAD_DIR: z.string().default("uploads/screenshots"),

  // Official Merchant APIs
  AMAZON_PAAPI_ACCESS_KEY: z.string().optional(),
  AMAZON_PAAPI_SECRET_KEY: z.string().optional(),
  AMAZON_ASSOCIATE_TAG: z.string().default("impex-20"),
  AMAZON_REGION: z.string().default("us-east-1"),

  EBAY_APP_ID: z.string().optional(),
  EBAY_CERT_ID: z.string().optional(),
  EBAY_DEV_ID: z.string().optional(),
  EBAY_ENV: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),

  ALIEXPRESS_APP_KEY: z.string().optional(),
  ALIEXPRESS_APP_SECRET: z.string().optional(),
  ALIEXPRESS_TRACKING_ID: z.string().optional(),

  WALMART_CONSUMER_ID: z.string().optional(),
  WALMART_PRIVATE_KEY: z.string().optional(),
  WALMART_AFFILIATE_PUBLISHER_ID: z.string().optional(),

  SHEIN_AFFILIATE_ID: z.string().optional(),
  SHEIN_API_KEY: z.string().optional(),

  FASHIONNOVA_AFFILIATE_ID: z.string().optional(),

  HM_API_KEY: z.string().optional(),
  HM_AFFILIATE_ID: z.string().optional(),

  TEMU_AFFILIATE_ID: z.string().optional(),

  // Email / SMTP Delivery
  SMTP_SERVICE: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.enum(["true", "false"]).default("false"),
  SMTP_FROM: z.string().default("IMPEX International <noreply@impexht.com>"),

  // Single Designated Admin Account
  ADMIN_EMAIL: z.string().default("duguepiterson@gmail.com"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Configuration validation error:", parsed.error.format());
}

export const config = parsed.success ? parsed.data : envSchema.parse({});

export const allowedOriginsList = config.ALLOWED_ORIGINS
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
