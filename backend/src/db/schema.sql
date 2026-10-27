-- =============================================================================
-- IMPEX Supabase PostgreSQL Complete Production Schema
-- Rebuilt from scratch for Node.js + Express + TypeScript + Better Auth
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. BETTER AUTH TABLES (Required by Better Auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "verification" (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  attempts INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session"(user_id);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON "account"(user_id);
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_auth_otps_email ON auth_otps(email);

-- -----------------------------------------------------------------------------
-- 2. CUSTOMER PROFILES & SAVED ADDRESSES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  gender TEXT DEFAULT 'M',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'Home',
  recipient_name TEXT,
  phone TEXT,
  is_company_address BOOLEAN DEFAULT FALSE,
  is_primary BOOLEAN DEFAULT FALSE,
  country TEXT NOT NULL DEFAULT 'Haiti',
  state TEXT NOT NULL DEFAULT 'Ouest',
  city TEXT NOT NULL DEFAULT 'Port-au-Prince',
  street TEXT NOT NULL,
  postal_code TEXT DEFAULT 'HT6110',
  managed_state_code TEXT DEFAULT 'OU',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);

-- -----------------------------------------------------------------------------
-- 3. MERCHANTS & UNIFIED PRODUCT CATALOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  icon TEXT,
  supported BOOLEAN DEFAULT TRUE,
  has_official_api BOOLEAN DEFAULT FALSE,
  has_awin_feed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  merchant_slug TEXT NOT NULL,
  external_product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category TEXT,
  price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  product_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'CATALOG',
  source_data JSONB DEFAULT '{}',
  is_available BOOLEAN DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_slug, external_product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_merchant_slug ON products(merchant_slug);
CREATE INDEX IF NOT EXISTS idx_products_title_search ON products USING gin(to_tsvector('english', title));

CREATE TABLE IF NOT EXISTS awin_feed_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  records_imported INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- -----------------------------------------------------------------------------
-- 4. PRIVATE ATTACHMENTS (Screenshot Concierge Orders)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS private_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  image_width INT,
  image_height INT,
  sha256_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_user ON private_attachments(user_id);

-- -----------------------------------------------------------------------------
-- 5. IMPEX INTERNAL WALLET & DOUBLE-ENTRY TRANSACTION LEDGER
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL UNIQUE REFERENCES customer_profiles(id) ON DELETE CASCADE,
  wallet_number TEXT UNIQUE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN DEFAULT TRUE,
  is_frozen BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL, -- 'CREDIT', 'DEBIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'REFUND'
  direction TEXT NOT NULL,   -- 'CREDIT' or 'DEBIT'
  amount_usd NUMERIC(12, 2) NOT NULL,
  balance_after_usd NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_wallet_id ON ledger_entries(wallet_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON ledger_entries(created_at);

CREATE TABLE IF NOT EXISTS wallet_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
  order_id UUID,
  amount_usd NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'RELEASED', 'CAPTURED'
  idempotency_key TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reservations_wallet_status ON wallet_reservations(wallet_id, status);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'PAYM', 'MONCASH', 'NATCASH', 'BANK'
  provider_reference TEXT,
  internal_reference TEXT UNIQUE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED', -- 'CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'
  provider_payload JSONB DEFAULT '{}',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_reference ON payment_attempts(internal_reference);

-- -----------------------------------------------------------------------------
-- 6. ORDERS, QUOTES & FULFILLMENT STATE MACHINE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_order_id TEXT UNIQUE NOT NULL,
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customer_profiles(id) ON DELETE RESTRICT,
  order_type TEXT NOT NULL DEFAULT 'LINK', -- 'LINK' or 'SCREENSHOT'
  merchant_name TEXT NOT NULL,
  merchant_domain TEXT,
  product_url TEXT,
  product_name TEXT NOT NULL,
  product_image TEXT,
  product_description TEXT,
  product_specifications JSONB DEFAULT '{}',
  variant TEXT,
  size TEXT,
  color TEXT,
  quantity INT NOT NULL DEFAULT 1,
  customer_notes TEXT,
  customer_estimated_price NUMERIC(12, 2) DEFAULT 0.00,
  customer_estimated_currency TEXT DEFAULT 'USD',
  verified_product_price NUMERIC(12, 2),
  service_fee NUMERIC(12, 2) DEFAULT 0.00,
  international_shipping_fee NUMERIC(12, 2) DEFAULT 0.00,
  delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
  quoted_total NUMERIC(12, 2),
  actual_purchase_total NUMERIC(12, 2),
  final_total NUMERIC(12, 2) DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'SUBMITTED', 
  -- States: SUBMITTED, UNDER_REVIEW, QUOTE_READY, FUNDS_RESERVED, PRICE_CHANGED, PURCHASE_COMPLETED, IN_TRANSIT, ARRIVED_AT_IMPEX, READY_FOR_PICKUP, DELIVERED, CANCELLED, REJECTED, REFUNDED
  payment_status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, AUTHORIZED, CAPTURED, REFUNDED
  purchase_status TEXT DEFAULT 'PENDING',
  shipping_status TEXT DEFAULT 'PENDING',
  delivery_status TEXT DEFAULT 'PENDING',
  pickup_code TEXT,
  merchant_order_id TEXT,
  merchant_tracking_number TEXT,
  carrier TEXT,
  shipping_address_snapshot JSONB DEFAULT '{}',
  screenshot_attachment_id UUID REFERENCES private_attachments(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  product_price NUMERIC(12, 2) NOT NULL,
  shipping_cost NUMERIC(12, 2) DEFAULT 0.00,
  tax NUMERIC(12, 2) DEFAULT 0.00,
  service_fee NUMERIC(12, 2) DEFAULT 0.00,
  international_fee NUMERIC(12, 2) DEFAULT 0.00,
  delivery_fee NUMERIC(12, 2) DEFAULT 0.00,
  discount NUMERIC(12, 2) DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL,
  total_htg NUMERIC(12, 2) NOT NULL,
  exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 132.5000,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'EXPIRED'
  expires_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_by_user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_quotes_order_id ON order_quotes(order_id);

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT,
  actor_type TEXT NOT NULL, -- 'customer', 'admin', 'system'
  actor_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- -----------------------------------------------------------------------------
-- 7. INITIAL REGISTERED MERCHANTS (The 8 Target Merchants)
-- -----------------------------------------------------------------------------
INSERT INTO merchants (slug, name, domain, domains, icon, supported) VALUES
('amazon', 'Amazon US', 'amazon.com', ARRAY['amazon.com', 'www.amazon.com', 'a.co', 'amzn.to'], '🛒', TRUE),
('shein', 'SHEIN US', 'shein.com', ARRAY['shein.com', 'us.shein.com', 'm.shein.com'], '👗', TRUE),
('aliexpress', 'AliExpress', 'aliexpress.com', ARRAY['aliexpress.com', 'www.aliexpress.com', 'a.aliexpress.com'], '📦', TRUE),
('ebay', 'eBay US', 'ebay.com', ARRAY['ebay.com', 'www.ebay.com'], '🏷️', TRUE),
('fashionnova', 'Fashion Nova', 'fashionnova.com', ARRAY['fashionnova.com', 'www.fashionnova.com'], '✨', TRUE),
('hm', 'H&M US', 'hm.com', ARRAY['hm.com', 'www2.hm.com'], '🧥', TRUE),
('temu', 'Temu', 'temu.com', ARRAY['temu.com', 'www.temu.com', 'share.temu.com'], '⚡', TRUE),
('walmart', 'Walmart US', 'walmart.com', ARRAY['walmart.com', 'www.walmart.com'], '🏬', TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  domain = EXCLUDED.domain,
  domains = EXCLUDED.domains,
  icon = EXCLUDED.icon,
  supported = EXCLUDED.supported;

-- -----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) LOCKDOWN
-- Protects Supabase PostgREST Data API from unauthenticated or anonymous access.
-- The Node.js backend connects via PostgreSQL direct connection pool (postgres superuser)
-- and service_role, which bypasses RLS automatically.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS private_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS wallet_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS awin_feed_sync_logs ENABLE ROW LEVEL SECURITY;
