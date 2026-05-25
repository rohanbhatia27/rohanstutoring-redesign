# Spellar Meeting Notes Warehouse

Receive, store, and query meeting notes from Spellar AI via webhook.

---

## Environment Variables

Add these to `.env` locally and to Vercel project settings for production.

| Variable | Required | Description |
|---|---|---|
| `SPELLAR_WEBHOOK_SECRET` | Yes | Shared secret sent by Spellar with every webhook. Generate a random string (e.g. `openssl rand -hex 32`). |
| `MEETING_NOTES_API_KEY` | Yes | API key for all read endpoints. Keep server-side only. |
| `SUPABASE_URL` | Production | Your Supabase project URL, e.g. `https://xxxx.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role key from Supabase → Settings → API. Never expose to the browser. |

---

## Storage Notes

**Production (Supabase):** When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
are set, all data is stored in the `meeting_notes` Postgres table.

**Local development (JSONL fallback):** When Supabase is not configured, the
system writes to `site/data/meeting-notes/notes.jsonl`. This file is gitignored.

> **Warning:** The JSONL fallback does not work on Vercel in production.
> Vercel's serverless runtime has an ephemeral read-only filesystem — any writes
> are silently discarded between invocations. Set up Supabase before deploying.

---

## Supabase Setup (5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** and run the migration:
   ```
   site/api/_lib/migrations/001_meeting_notes.sql
   ```
3. Go to **Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
4. Add both to `.env` locally and to Vercel environment variables.

---

## Spellar Webhook Setup

1. In Spellar, go to **Settings → Integrations → Webhook**.
2. Set the webhook URL:

   ```
   https://www.rohanstutoring.com/api/spellar/webhook?secret=YOUR_SECRET
   ```

   Or configure Spellar to send the `x-spellar-secret` header instead of the
   query param — both are supported.

3. Set the trigger to fire after each meeting is processed.

---

## Testing Locally

Start the dev server (any static server works since the API runs via Vercel CLI):

```bash
cd site
vercel dev
```

Then send a test payload:

```bash
curl -X POST "http://localhost:3000/api/spellar/webhook?secret=YOUR_LOCAL_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-001",
    "title": "Test Sales Call",
    "started_at": "2026-05-25T10:00:00Z",
    "summary": "Student is interested in Comprehensive Course but concerned about price.",
    "transcript": "Full transcript goes here.",
    "action_items": ["Send follow-up message", "Share course link"]
  }'
```

Expected response:
```json
{
  "received": true,
  "id": "<uuid>",
  "title": "Test Sales Call",
  "source": "spellar",
  "external_id": "test-001"
}
```

---

## Querying Meetings

All read endpoints require the `x-api-key` header set to `MEETING_NOTES_API_KEY`.

### List meetings
```bash
curl "http://localhost:3000/api/meetings" \
  -H "x-api-key: YOUR_API_KEY"

# With filters
curl "http://localhost:3000/api/meetings?type=sales&limit=10" \
  -H "x-api-key: YOUR_API_KEY"

curl "http://localhost:3000/api/meetings?person=Sarah" \
  -H "x-api-key: YOUR_API_KEY"
```

### Get a meeting by ID
```bash
curl "http://localhost:3000/api/meetings/by-id?id=<uuid-or-external-id>" \
  -H "x-api-key: YOUR_API_KEY"
```

Returns the full record including transcript and raw_payload.

### Search
```bash
curl "http://localhost:3000/api/meetings/search?q=gamsat+section+1" \
  -H "x-api-key: YOUR_API_KEY"
```

Searches across title, summary, transcript, and tags.

### Lead context
```bash
curl "http://localhost:3000/api/meetings/lead-context?name=Emily" \
  -H "x-api-key: YOUR_API_KEY"
```

Returns:
- All meetings involving Emily
- Most recent call summary
- Extracted pain points and objections (keyword-based, no AI)
- All open action items
- Suggested next step

---

## Supported Spellar Payload Fields

The normaliser tries multiple field names so it degrades gracefully as
Spellar's schema evolves:

| Internal field | Tries these incoming fields |
|---|---|
| `external_id` | `id`, `meeting_id`, `note_id`, `event_id` |
| `title` | `title`, `name`, `meeting_title`, `calendar_event.title` |
| `started_at` | `started_at`, `start_time`, `date`, `created_at` |
| `ended_at` | `ended_at`, `end_time` |
| `summary` | `summary`, `ai_summary`, `notes.summary`, `markdown_summary` |
| `transcript` | `transcript`, `text`, `notes.transcript`, `full_transcript` |
| `action_items` | `action_items`, `tasks`, `follow_ups`, `notes.action_items` |
| `attendees` | `attendees`, `participants`, `calendar_event.attendees` |

All fields are optional except the stored `raw_payload` (always the full
incoming JSON).

---

## Security Notes

- `SPELLAR_WEBHOOK_SECRET` and `MEETING_NOTES_API_KEY` are server-side only.
  Never prefix them with `NEXT_PUBLIC_` or expose them to frontend code.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Keep it
  server-side only and never commit it to git.
- Full transcripts are never logged. Only metadata (title, started_at,
  external_id) is written to the server log.
- All read endpoints return 401 without a valid API key. There are no
  public unauthenticated read routes.

---

## What to Build Next

1. **Set up Supabase** — run the migration and add env vars to Vercel.
2. **Connect Spellar** — paste the webhook URL and test with a real call.
3. **Verify a stored meeting** — hit `GET /api/meetings` to confirm data appears.
4. **Add `meeting_type` tagging** — update the normaliser if Spellar sends a
   type field with a different name in production.
5. **Build the MCP server** — see `site/mcp/README.md` for the planned tools.
6. **Add embeddings** — once you have a body of meetings stored, add
   `pgvector` to Supabase and switch to semantic search for better recall.
7. **Add a private admin UI** — a simple password-protected HTML page that
   calls the read API and renders meetings in a readable format.
