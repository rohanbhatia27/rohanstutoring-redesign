# Lead Magnet Delivery — Server-Owned via Resend

**Date:** 2026-06-30
**Branch context:** builds on the uncommitted v4-API work on `checkout-funnel-abandonment-recovery`
**Status:** design approved, pending spec review

## Problem

Students sign up for free lead magnets but do not receive them.

### Root cause (confirmed with live Kit data, 2026-06-30)

Delivery currently depends on a Kit **form-triggered automation** dropping each
new subscriber into a delivery funnel whose first email carries the download
link. Subscribers are added to the Kit form server-side via the authenticated
v4 API (`POST /forms/{id}/subscribers`). That API addition does **not** reliably
fire the form's visual automation / incentive email the way a real browser
opt-in does, so subscribers land on the form but never enter the funnel.

Evidence:

| Resource | Form subscribers | Delivery funnel | In funnel |
|---|---|---|---|
| S1 Tracker | 193 | GAMSAT S1 TRACKER FUNNEL (2723708) | 4 |
| S1 Mini Mock | 303 | GAMSAT S1 MINI MOCK - 2026 FUNNEL (2718570) | 1 |
| S2 Slam System | 875 | S2 Slam System Nurture (2786194) | 13 |

The June v4-API fix succeeded at getting people onto the form (fresh signups on
6/28 and 6/30 confirmed) but did not fix delivery, because delivery was never
the website's job — it was delegated to a Kit automation the website cannot see,
control, or verify.

**Any design that keeps Kit as the delivery mechanism stays exposed to this.**

## Goal

Make lead-magnet delivery a code path the website owns, sends synchronously, and
can verify in tests and preview. Remove the invisible dependency on Kit
automations for delivery. Keep Kit for list-building and nurture.

## Scope

**In scope:** `s1-tracker`, `s1-mock`, `s2-slam-system`.

**Out of scope:** `interview-calculator` — its form (9502408) has 0 subscribers
ever and no funnel; it is a separate wiring failure to be handled later.

## Asset links (extracted from the existing Kit funnel emails)

- **s1-tracker** → `https://docs.google.com/spreadsheets/d/1eaDltkkqWrejF1bIgoW48MZLguXzeHMOhxfE4xoZLlc/edit?gid=788264791#gid=788264791`
- **s1-mock** → `https://drive.google.com/file/d/12rRPRFxmef7Oe8FU2oTWP3Sp0jdnLztt/view?usp=sharing`
- **s2-slam-system** → `https://download.filekitcdn.com/d/2hU8i25SXZz1XsLtQta7Yr/9LJePVqF4moaNxMtw6K9uB`

## Design

### 1. Asset registry (`api/_lib/_free-resource.js`)

Extend each `FREE_RESOURCES` entry with the fields delivery needs:

- `downloadUrl` — the real asset link above (the primary thing we send).
- `emailSubject` — per-resource delivery subject (e.g. "Your free S1 Question Tracker is inside").
- `kitSequenceId` — the nurture sequence to enroll the lead into (see §4).

The existing `kitFormId` and `backupUrlEnv` stay. `backupUrlEnv` becomes a
secondary safety net only (see §5).

### 2. Delivery email (primary path)

Promote today's `sendFallbackEmail` into the primary delivery email:

- Rename intent from "backup / Kit didn't confirm" to a proper "here's your
  resource" delivery. Reuse the existing branded HTML table template.
- The body leads with the download link (`downloadUrl`), keeps Rohan's voice,
  and sets up the nurture that follows. Final copy runs through `/humanizer`
  before ship; no em dashes (per CLAUDE.md).
- Sent from `hello@rohanstutoring.com` via Resend (domain already used by the
  current fallback; confirm verified in Resend before ship).
- Returns Resend's message id; log it as the delivery success signal.

### 3. New flow in `handleResourceLead` (`api/leads.js`)

Reorder so delivery is first and independent of Kit:

1. **Send the Resend delivery email.** Success = the student has their resource.
   This is the guaranteed, testable path.
2. **Best-effort Kit sync (non-blocking):** add subscriber to the Kit form/list
   and tag, and enroll into the nurture sequence (§4). Wrapped so any Kit error
   is logged but never fails the request or blocks delivery.
3. **If the Resend send throws:** this is now the real failure. Return the
   on-page backup fallback (existing `buildFallbackPayload` / UI) and log a hard
   error for follow-up.

The response contract to the frontend stays compatible: `status: 'delivered'`
on success (was `'kit'`), `status: 'fallback'` when Resend fails. Frontend copy
that keys on these is checked and updated if needed.

### 4. Nurture enrollment (deterministic, replaces the broken form trigger)

- Add `addSubscriberToSequence({ sequenceId, email, firstName })` to
  `api/_lib/_kit.js` — v4 `POST /sequences/{id}/subscribers`. This enrollment is
  deterministic (unlike the form-automation trigger), so nurture actually starts.
- Map each resource to its nurture sequence via `kitSequenceId`:
  - s1-tracker → 2723708
  - s1-mock → 2718570
  - s2-slam-system → 2786194 (confirm this is the canonical nurture vs the
    older single-email "Send Slam System" 2483831 during review)
- **Manual Kit-side step (Rohan):** delete email #1 (the delivery email) from
  each funnel so the sequence becomes pure nurture (emails 2-6), since the
  server now owns delivery. Documented as a runbook step, not code.

### 5. Error handling & safety nets

- Resend send failure → on-page backup link (existing behaviour) + hard error log.
- Kit failure (list add / sequence enroll) → logged, non-blocking; student still
  got the asset from step 1.
- `backupUrlEnv` retained as the on-page fallback link source.

## Testing

Extend `tests/free-resource-lead.test.js`:

- Delivery email is sent with the correct `downloadUrl` per resource.
- Delivery success returns `status: 'delivered'` even when Kit calls throw.
- Resend failure returns the `fallback` payload.
- Kit sequence enrollment is attempted with the right `kitSequenceId` and its
  failure does not fail the request.
- Unknown / out-of-scope resource keys are rejected.

Use the existing `__setResendFactory` / Kit `__setFetch` test seams; no live
network calls.

## Manual verification before ship

1. Local: submit each of the three forms, confirm the Resend delivery email
   arrives with the correct link.
2. Confirm `hello@rohanstutoring.com` is a verified Resend sender.
3. Confirm the three subscribers appear in the correct Kit nurture sequences.
4. Rohan trims funnel email #1 in each Kit sequence.

## Out of scope / follow-ups

- Interview Calculator delivery + why its form never received anyone.
- Any redesign of the nurture email copy itself.
- Backfilling the ~1,300 historical form subscribers who never got their asset
  (separate one-off broadcast decision for Rohan).
