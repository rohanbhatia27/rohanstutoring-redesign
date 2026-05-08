# Launch Readiness: Items 3, 4, 5

Date: 2026-05-09
Scope: pre-launch checkpoint, SEO/config verification, redirect verification readiness
Working canonical domain: `https://www.rohanstutoring.com`

## Item 3: Pre-Launch Checkpoint

Current repo state at capture time:

- Branch: `main`
- HEAD: `07fe41ee9812d562272c98cfa5c1740b7da0ea9f`
- Recent commits:
  - `07fe41e Add k`
  - `606bc05 Add k`
  - `4f3a134 Add k`
  - `93e8c9b Add k`
  - `82923b4 Update site content and footer links`

Working tree was not clean at checkpoint time. Launch-sensitive local changes present:

- modified: `css/style.css`
- modified: `.gitignore`
- modified: `index.html`
- modified: `js/analytics.js`
- modified: `js/posthog-init.js`
- modified: `package.json`
- modified: `robots.txt`
- modified: `tests/url-normalization.test.js`
- modified: `vercel.json`
- untracked: `assets/homepage/logo-home-120.png`
- untracked: `redirect-audit.example.csv`
- untracked: `redirect-audit.launch.csv`
- untracked: `scripts/redirect-audit.js`
- untracked: `tests/redirect-audit.test.js`
- untracked: `docs/launch/2026-05-09-launch-readiness-items-3-4-5.md`

Pre-launch git checkpoint procedure:

1. Run `git -C site status --short --branch`
2. Review every modified or untracked launch file
3. Run `npm test`
4. Create a pre-launch checkpoint commit once the worktree is intentional
5. Record the production deployment URL or deployment ID after the final Vercel production push

Rollback note:

- Code rollback target: commit `07fe41ee9812d562272c98cfa5c1740b7da0ea9f` or the final pre-launch commit that replaces it
- Vercel rollback path: use `vercel rollback <deployment-url-or-id>` if a new production deploy breaks
- DNS rollback path: restore the previous web DNS records or nameservers if cutover breaks routing
- Email rollback path: restore previous MX, SPF, DKIM, and DMARC records exactly if mail is affected

## Item 4: Final SEO and Config Verification

Verification run:

- `node --test tests/url-normalization.test.js tests/redirect-audit.test.js`

Result:

- pass: `23/23`

Verified as aligned with `https://www.rohanstutoring.com`:

- `robots.txt` sitemap URL points to `https://www.rohanstutoring.com/sitemap.xml`
- `sitemap.xml` uses `https://www.rohanstutoring.com` entries
- canonical tags on indexable pages use clean public URLs
- `og:url` values match canonical URLs on indexable pages
- course schema URLs do not point at `.html` variants
- public links no longer point at `.html` paths
- webinar redirect target still points at `https://www.rohanstutoring.com/webinar/thanks`

Observed notes:

- The repo scan still contains many hardcoded `https://www.rohanstutoring.com` references by design. If the canonical launch domain changes away from `www.rohanstutoring.com`, these must be updated before launch.
- `redirect-audit-launch-output.csv` is a generated artifact and is now ignored by git.

## Item 5: Redirect Verification Readiness

Redirect verification assets now in repo:

- input list: `redirect-audit.launch.csv`
- script: `scripts/redirect-audit.js`
- tests: `tests/redirect-audit.test.js`

Verification run:

- `node --test tests/redirect-audit.test.js`

Result:

- pass: `6/6`

Launch audit command:

```bash
cd site
npm run audit:redirects -- redirect-audit.launch.csv --output=redirect-audit-launch-output.csv
```

Current limitation:

- The audit script itself works, but this Codex sandbox cannot successfully fetch the public domain, so live redirect results from this environment are not authoritative.
- Run the command from a network-enabled environment after the domain is live on Vercel, then review:
  - `ok = yes`
  - `final_status = 200`
  - `hop_count <= 1`
  - `notes` empty for must-pass rows

Recommended launch-day interpretation:

- Any `expected_mismatch` on legacy URLs is a real launch blocker
- Any `redirect_chain` on high-traffic marketing URLs should be cleaned up if possible
- Any checkout or success-page URL that does not land cleanly is a blocker

## Related launch docs

- `docs/launch/2026-05-09-dns-email-cutover-checklist.md`
- `docs/launch/2026-05-09-payment-url-audit.md`
- `docs/launch/2026-05-09-leadgen-integration-audit.md`
