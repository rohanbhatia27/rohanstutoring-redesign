# Founder Dashboard

A simplified analytics view that answers one question:
**"What should I do this week to get more qualified GAMSAT leads and course sales?"**

## Files

| File | What it does |
|---|---|
| `site/analytics-dashboard.html` | The page (noindex, not in nav). |
| `site/css/analytics-dashboard.css` | Styles. Light blue + orange accents. |
| `site/js/analytics-dashboard.js` | Tries live `/api/analytics` first, falls back to mock. |
| `site/api/auth-google.js` | Starts the Google OAuth consent flow. |
| `site/api/auth-callback.js` | Receives `?code=`, stores encrypted refresh token in an HttpOnly cookie. |
| `site/api/analytics.js` | Pulls GA4 Data API reports for the dashboard. |
| `site/api/_lib/_ga4-auth.js` | Cookie encryption + Google token helpers. |
| `site/.env.example` | All env vars the dashboard reads. |

## Run it locally

Static-only preview (mock data, no API):
```bash
cd site
python3 -m http.server 8000
# http://localhost:8000/analytics-dashboard.html
```

With the live API working (needs Vercel CLI + env vars in `.env`):
```bash
cd site
vercel dev
# http://localhost:3000/analytics-dashboard.html
```

The dashboard tries `/api/analytics?range=30` first. If it returns 401 (not connected) or any other error, the UI falls back to mock data and shows a "Connect Google" banner.

## Auth model

OAuth 2.0, single-user (you). No service account.

- Scope: **`https://www.googleapis.com/auth/analytics.readonly`** (read-only).
- Flow: you visit `/api/auth-google`, approve, Google redirects to `/api/auth-callback?code=...`, the callback exchanges the code for a refresh token, AES-256-GCM encrypts it with `TOKEN_ENCRYPTION_KEY`, and writes it to an `HttpOnly; Secure; SameSite=Lax` cookie.
- On every `/api/analytics` call: the cookie is read server-side, the refresh token is decrypted, a short-lived access token is requested from Google, and the GA4 Data API is called.
- Tokens never reach the browser. The client secret never reaches the browser.
- To disconnect: clear cookies for the site, or revoke at https://myaccount.google.com/permissions and reconnect.

## One-time setup

### 1. Create the OAuth client in Google Cloud Console

1. Open https://console.cloud.google.com/ and pick (or create) a project.
2. **APIs & Services → Library** → enable **Google Analytics Data API**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External**.
   - App name, support email, developer email: fill in.
   - Scopes: add `https://www.googleapis.com/auth/analytics.readonly`.
   - Test users: add the Google account that owns the GA4 property (yours). While the app is in "Testing", only listed test users can authorize — that's fine for a personal dashboard.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized redirect URIs: add **both**
     - `https://YOUR-DOMAIN/api/auth-callback` (production)
     - `http://localhost:3000/api/auth-callback` (local `vercel dev`)
   - Save. Copy the **Client ID** and **Client Secret**.

### 2. Grant the Google account access to GA4

In GA4 → **Admin → Property → Property access management**, make sure the Google account that will authorize has at least **Viewer** on property `507381791`. This is the account you'll click through OAuth with — not a service account.

### 3. Set env vars

Locally, create `site/.env` based on `site/.env.example`:

```env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth-callback
GA4_PROPERTY_ID=507381791
TOKEN_ENCRYPTION_KEY=...   # 64-char hex
```

Generate the encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

On Vercel:
- Project → **Settings → Environment Variables** → add the same five vars for **Production** and **Preview**.
- For production, set `GOOGLE_REDIRECT_URI` to `https://YOUR-DOMAIN/api/auth-callback` and add that exact URI to the OAuth client's redirect list in Google Cloud Console.

### 4. Connect

1. Deploy (or run `vercel dev`).
2. Visit `/analytics-dashboard.html`. You'll see mock data and an orange "Connect Google" banner.
3. Click it → approve on the Google consent screen → you'll land back on the dashboard with live data and a "Live GA4" label in the header.

## Error responses

`/api/analytics` returns JSON with a top-level `error` key on failure:

| Status | `error` | Meaning |
|---|---|---|
| 401 | `not_connected` | No refresh-token cookie. Click Connect. |
| 401 | `token_refresh_failed` | Google rejected the saved token. Reconnect. |
| 403 | `ga4_request_failed` | The authorized Google account doesn't have access to property `GA4_PROPERTY_ID`. Add it as a Viewer in GA4 Admin. |
| 502 | `ga4_request_failed` | Other GA4 API error — see `detail`. |
| 500 | — | Env var missing. |

The dashboard JS treats all of these as "fall back to mock + show the banner".

## Tracking events to add

The GA4 reports use these event names (override per `.env.example` if yours differ):

- `generate_lead` / `lead_form_submit` / `email_signup` / `sign_up`
- `free_resource_download` / `file_download`
- `webinar_signup`
- `checkout_click` / `begin_checkout` / `checkout_start`
- `purchase`
- `strategy_call_click`, `outbound_click` (referenced by the tracking-gaps panel)

Wire them via `gtag('event', '<name>', { ... })`. Globals belong in `site/js/main.js`; page-specific events belong in the page's JS (`checkout.js`, `product.js`, `s2-slam-system.js`, `tracker.js`, etc.).

## Security notes

- The page is `noindex, nofollow` and not linked from the public nav. Treat the URL as private.
- For stronger protection, enable Vercel's deployment password protection on `/analytics-dashboard.html` and the `/api/auth-*` routes, or front the whole project with Vercel Authentication.
- `TOKEN_ENCRYPTION_KEY` must be set in every environment that runs the API. Rotating it will invalidate all existing refresh-token cookies and require a reconnect.
- Never commit `.env`. Only `.env.example` is checked in.
