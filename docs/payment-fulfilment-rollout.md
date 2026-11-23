# Payment fulfilment rollout

Apply `migrations/002_create_paypal_orders.sql` and `migrations/003_create_email_deliveries.sql` to the target Supabase project before deploying the payment changes. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ADMIN_ALERT_EMAIL`, `BLUEPRINT_DRIVE_URL`, and `CRON_SECRET` in the target environment. The tables have row-level security and must only be accessed through the server-side service role.

The `SUPABASE_SERVICE_ROLE_KEY` setting accepts either a current `sb_secret_` key or a legacy service-role JWT. `FULFILLMENT_RESEND_API_KEY`, when set, takes precedence for fulfilment emails; this allows a test deployment to leave unrelated email integrations disabled. Set `SANDBOX_ALLOWED_EMAILS` to a comma-separated list on a test deployment to block fulfilment messages to other addresses. Do not set a test recipient restriction on production.

The daily `auditInstalments` cron alerts for active instalment subscriptions whose cancellation schedule cannot be verified. It reports failures when Stripe, Supabase, or alert delivery is unavailable. It does not modify existing subscriptions.

Only instalment checkout sessions created by this version carry the schedule-version marker that permits automatic schedule creation. Replayed older checkout events do not alter existing subscriptions; review those plans individually before requesting permission to change them.

The `email_deliveries` table retains accepted message IDs by provider, payment ID, and purpose. A pending delivery older than 23 hours requires manual review against Resend before another send; this prevents a duplicate after Resend's idempotency window. A known rejection can be retried after correcting the cause. PayPal orders with no private checkout record require manual recipient verification before fulfilment.

Before production rollout, run the PayPal sandbox flow using different student and payer addresses and replay its capture webhook. Reconcile existing subscriptions and invoices, orders containing `upsell_slug_2`, and recorded email events against provider records. Do not infer corrections from the new fulfilment records alone: historical orders predate these tables.
