-- Run once against your Supabase project (SQL Editor or CLI).
-- Tracks safe fulfillment lifecycle events for debugging and audit.

CREATE TABLE IF NOT EXISTS purchase_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  event_type     text        NOT NULL,           -- e.g. 'payment_intent.created', 'stripe.fulfilled'
  provider       text,                           -- 'stripe' | 'paypal'
  payment_id     text,                           -- payment intent ID or PayPal order ID
  product_slug   text,
  upsell_slug    text,
  customer_email text,
  customer_name  text,
  amount_cents   integer,
  currency       text,
  outcome        text,                           -- 'success' | 'failure' | 'skipped'
  error_message  text,
  meta           jsonb
);

CREATE INDEX IF NOT EXISTS purchase_events_payment_id_idx  ON purchase_events (payment_id);
CREATE INDEX IF NOT EXISTS purchase_events_event_type_idx  ON purchase_events (event_type);
CREATE INDEX IF NOT EXISTS purchase_events_created_at_idx  ON purchase_events (created_at DESC);

-- Row-level security: service-role key can insert; anon cannot read.
ALTER TABLE purchase_events ENABLE ROW LEVEL SECURITY;
