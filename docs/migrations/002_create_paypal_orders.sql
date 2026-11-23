-- Private server-side checkout data; apply before deploying PayPal changes.
CREATE TABLE IF NOT EXISTS paypal_orders (
  order_id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  purchase jsonb NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL,
  payer_email text
);
ALTER TABLE paypal_orders ENABLE ROW LEVEL SECURITY;
