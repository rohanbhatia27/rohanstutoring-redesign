-- Apply before deploying durable email delivery.
CREATE TABLE IF NOT EXISTS email_deliveries (
  delivery_key text PRIMARY KEY,
  provider text NOT NULL,
  payment_id text NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE email_deliveries ENABLE ROW LEVEL SECURITY;
