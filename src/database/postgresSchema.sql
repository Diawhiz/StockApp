-- ============================================================
-- Fresh Aiven PostgreSQL Schema for Sage Logistics Split System
-- ==========================================================--
-- This schema replaces the existing SQLite sage_logistics.db
-- Optimized for Vercel serverless functions + Aiven PostgreSQL
-- Credentials (DATABASE_URL) must never be in app/browser code
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE vendor_status AS DEFAULT 'active';

-- ============================================================
-- TABLE: accounts (simple auth - one account only)
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(191) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Insert the single default account
-- PASSWORD: "sage2024" (hashed with bcrypt)
-- NOTE: In production, change this password and hash it separately
INSERT INTO accounts (username, password_hash) VALUES ('admin', '$2b$10$JjH4HdcP.Fi.x.YKx8ZMyeOUQZk.wEMlR92Z.IvIx.YIx5W5e.hPu') ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE: vendors
-- ============================================================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(191) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: vendor_items
-- ============================================================
CREATE TABLE IF NOT EXISTS vendor_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(191) NOT NULL,
  price INTEGER NOT NULL DEFAULT 0, -- stored in cents to avoid float issues
  expected INTEGER NOT NULL DEFAULT 0,
  actual INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Sync tracking
  last_sync_at TIMESTAMPTZ,
  sync_event_id UUID -- unique ID for sync conflict resolution
);

-- Index for fast vendor lookups
CREATE INDEX IF NOT EXISTS idx_vendor_items_vendor ON vendor_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_items_name ON vendor_items(name COLLATE "C");

-- ============================================================
-- TABLE: deliveries
-- ============================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  location VARCHAR(191) NOT NULL,
  rider VARCHAR(191) NOT NULL,
  product_details TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0, -- stored in cents
  fee_cents INTEGER NOT NULL DEFAULT 0, -- stored in cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: delivery_items (snapshots of stock at time of delivery)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  item_id UUID REFERENCES vendor_items(id) ON DELETE SET NULL,
  vendor_name_snapshot VARCHAR(191) NOT NULL,
  item_name_snapshot VARCHAR(191) NOT NULL,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Sync event ID for tracking
  sync_event_id UUID
);

-- Index for delivery lookups
CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_sync ON delivery_items(sync_event_id);

-- ============================================================
-- TABLE: expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  description VARCHAR(191) NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0, -- stored in cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: sync_events (tracks changes for real-time sync)
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'vendor', 'item', 'delivery', 'expense'
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  payload JSONB, -- full data of the change
  source VARCHAR(50) NOT NULL, -- 'web' or 'android_app'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT FALSE -- whether the sync has been processed
);

-- Index for sync tracking
CREATE INDEX IF NOT EXISTS idx_sync_events_source ON sync_events(source);
CREATE INDEX IF NOT EXISTS idx_sync_events_processed ON syncEvents(processed);
CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id);

-- ============================================================
-- TABLE: import_logs (Excel import tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  mode VARCHAR(20) NOT NULL, -- 'add' | 'replace'
  total_units INTEGER NOT NULL DEFAULT 0,
  vendors_added INTEGER NOT NULL DEFAULT 0,
  items_added INTEGER NOT NULL DEFAULT 0,
  items_updated INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  is_undone INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- TABLE: import_log_details (per-row import details)
-- ============================================================
CREATE TABLE IF NOT EXISTS import_log_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_log_id UUID NOT NULL REFERENCES import_logs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  item_id UUID REFERENCES vendor_items(id) ON DELETE SET NULL,
  is_new_vendor INTEGER NOT NULL DEFAULT 0,
  is_new_item INTEGER NOT NULL DEFAULT 0,
  prev_actual INTEGER NOT NULL DEFAULT 0,
  prev_expected INTEGER NOT NULL DEFAULT 0,
  prev_price_cents INTEGER NOT NULL DEFAULT 0,
  new_actual INTEGER NOT NULL DEFAULT 0,
  new_expected INTEGER NOT NULL DEFAULT 0,
  new_price_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SECURITY: Row-level security (optional, disable if preferred)
-- ============================================================
-- RLS can be enabled later if multi-tenant is needed
-- For now, simple access control via the API layer

-- ============================================================
-- VIEWS for convenience
-- ============================================================
CREATE OR REPLACE VIEW vendor_stock_summary AS
SELECT
  v.id,
  v.name,
  COUNT(vi.id) AS item_count,
  COALESCE(SUM(vi.actual), 0) AS total_actual,
  COALESCE(SUM(vi.expected), 0) AS total_expected,
  COALESCE(SUM(vi.actual - vi.expected), 0) AS total_missing
FROM vendors v
LEFT JOIN vendor_items vi ON v.id = vi.vendor_id
GROUP BY v.id, v.name;

CREATE OR REPLACE VIEW delivery_activity AS
SELECT
  d.id,
  d.date,
  d.rider,
  d.location,
  d.price_cents / 100 AS price_dollars,
  d.fee_cents / 100 AS fee_dollars,
  COUNT(di.id) AS item_count
FROM deliveries d
LEFT JOIN delivery_items di ON d.id = di.delivery_id
GROUP BY d.id, d.date, d.rider, d.location, d.price_cents, d.fee_cents
ORDER BY d.created_at DESC;