ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment', 'pending_contact', 'contacted', 'confirmed', 'completed', 'cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_released_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_token_hash TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country_code TEXT NOT NULL DEFAULT 'US';
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('manual', 'paypal'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'failed', 'unpaid', 'refunded'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_currency_code_check;
ALTER TABLE orders ADD CONSTRAINT orders_currency_code_check CHECK (currency_code = 'USD');

CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_order_unique_idx ON orders (paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_paypal_capture_unique_idx ON orders (paypal_capture_id) WHERE paypal_capture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  processing_status TEXT NOT NULL,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
