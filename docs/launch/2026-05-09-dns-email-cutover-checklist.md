# DNS + Email Cutover Checklist

Canonical domain assumed in this worksheet: `https://www.rohanstutoring.com`

## Cutover rule

Do not switch nameservers or registrar control until the new DNS zone contains every mail-critical record from the current zone.

## Mailboxes and sender identities used by this site

- `rohan@rohanstutoring.com`
  - Public contact address in privacy and terms pages.
- `hello@rohanstutoring.com`
  - Public support address in quiz and payment confirmation messaging.
- `noreply@rohanstutoring.com`
  - Payment confirmation sender used by Resend.
- `essays@rohanstutoring.com`
  - Essay submission fallback address shown on checkout success flows.

## Records that must survive the move

Copy these from the current DNS host before changing anything:

- Google Workspace `MX` records
- Domain SPF `TXT` record
- Google DKIM `TXT` record
- DMARC `TXT` record
- Any Google verification `TXT` or `CNAME` records
- Any existing `CAA` records
- Existing apex and `www` web records
- Any TXT/CNAME records used by Resend domain verification
- Any legacy verification records you still need for Search Console or other dashboards

## Integration-specific DNS notes

### Google Workspace

- Gmail continuity depends on preserving `MX`, SPF, DKIM, and DMARC.
- If you move nameservers, recreate the full Google mail record set first, then switch nameservers.
- After cutover, send and receive a real test email using:
  - `rohan@rohanstutoring.com`
  - `hello@rohanstutoring.com`
  - `noreply@rohanstutoring.com` if that mailbox exists

### Resend

- The payment confirmation flow sends from `noreply@rohanstutoring.com`.
- Preserve any Resend verification records in DNS.
- After cutover, place a test order and confirm the payment email arrives from `noreply@rohanstutoring.com`.

### Vercel

- Add both apex and `www` in Vercel before changing DNS.
- Decide the canonical redirect rule:
  - apex -> `www`
  - or `www` -> apex
- Make sure DNS reflects that exact plan.

## Pre-cutover export checklist

- Screenshot or export the entire current DNS zone
- Copy all current `MX`, `TXT`, `CNAME`, `A`, and `AAAA` records into a cutover note
- Record current TTL values
- Record current nameservers
- Record which provider currently hosts DNS
- Confirm who currently owns the domain registration

## Cutover checklist

- Recreate all Google Workspace mail records at the new DNS host if nameservers are changing
- Recreate all Resend verification records
- Add Vercel-required web records for apex and `www`
- Leave unrelated TXT verification records in place unless you are certain they are obsolete
- Verify Vercel sees the domain as configured before making the public switch

## Post-cutover checks

### Website

- `https://www.rohanstutoring.com` loads the new Vercel site
- HTTP redirects to HTTPS
- non-canonical host redirects to the canonical host

### Email

- Send from a non-Google address to `rohan@rohanstutoring.com`
- Reply from `rohan@rohanstutoring.com`
- Send from the site purchase flow and confirm the Resend confirmation email arrives
- Confirm no bounce, SPF fail, DKIM fail, or DMARC fail in message headers

## Repo-coupled email dependencies to sanity-check

- Payment confirmation email sender: `noreply@rohanstutoring.com`
- Payment confirmation reply/support copy: `hello@rohanstutoring.com`
- Essay upload fallback copy: `essays@rohanstutoring.com`
- Contact/legal copy: `rohan@rohanstutoring.com`

## Decision log

- DNS host after launch: `_____`
- Registrar after launch: `_____`
- Canonical host after launch: `_____`
- Nameservers changed: `yes / no`
- Google Workspace mail test passed: `yes / no`
- Resend test passed: `yes / no`
