# Free resource Kit reliability

## Observed failure

`/api/leads` sends the resource through Resend, then `syncKitForResource` catches each Kit error and still returns `synced: true`. The response therefore hides a failed tag or enrollment. The March 2027 Game Plan has used this path since 30 September 2026.

## Design

Use the existing service-role-only Supabase `purchase_events` table as a small durable lead ledger, with a dedicated `free_resource.lead` event type. Insert a pending row before attempting email delivery. If storage is unavailable, return the existing on-page backup link without sending email, so no emailed lead is silently unrecorded. After Resend accepts a message, update the row with its message ID, attempt each configured Kit step, and mark the row synced or failed. A failed Kit step leaves the PDF delivered but changes the API status to `delivered_pending_sync` and sends an internal alert through the configured admin address. Check Resend's `{error}` result explicitly.

A daily Vercel cron retries incomplete ledger rows. Successful Kit operations are idempotent for the Game Plan tag; for resources with several steps, the row records failed steps so retries avoid repeating successful steps. The cron uses the existing `CRON_SECRET` authorization and returns only counts.

On the first cron run, reconcile Game Plan emails sent since the 30 September launch using Resend's sent-email list and the Kit tag's subscriber list. Tag only addresses present in Resend and missing from the Kit tag, and record each recovered signup in the ledger. Store a completion marker so this one-time backfill does not run again. Send an admin summary with counts. Never expose subscriber addresses in the public response or logs.

## Failure handling

If Resend rejects delivery, record `delivery_failed` and use the on-page backup. If ledger updates fail after sending, the original pending row remains retryable; repeated Kit tagging is safe. If the alert itself fails, preserve the ledger status and log the alert failure. If reconciliation cannot access the sent list or tag list, leave the completion marker absent so the next cron can retry.

## Verification

Tests cover Resend error results, each Kit failure, durable state changes, retry behavior, authorization, and reconciliation pagination and deduplication. Run the full Node test suite and verify the deployed cron result and Kit tag count before calling the live issue resolved.
