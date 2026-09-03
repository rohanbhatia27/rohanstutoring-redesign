'use strict';

/**
 * Durable commercial context for the weekly analytics insight engine.
 *
 * The serverless function cannot read rohans-content-os/, so this is a
 * hand-maintained snapshot. Keep the OFFER LADDER + FUNNEL sections stable;
 * update the CURRENT PRIORITY section whenever a launch changes.
 *
 * The /weekly-insights slash command reads the live content-os instead, so
 * the on-demand version is always current; this snapshot powers the cron email.
 */

const BUSINESS_CONTEXT = `# Rohan's GAMSAT — Business Context

## What the business is
Premium, founder-led GAMSAT prep. Sells a serious, live method (structure,
teaching, standards, feedback, accountability) — not a content dump. Voice is
warm, direct, calm, confident. Avoid hype and scarcity pressure.

## Offer ladder (highest commercial priority first)
1. Comprehensive Course — FLAGSHIP and the top commercial priority. Live S1 + S2
   prep system run in cohorts. March 2027 cohort is open. $1599 early bird
   until 1 October 2026, then $1799. No instalment option during early bird.
   Page: /store/p/comprehensive
2. Step-down / nurture entry points: GAMSAT Starter Pack
   (/store/p/gamsat-starter-pack) and the Blueprint. Existing Blueprint buyers
   are an upsell target into the Comprehensive Course via a one-off discount.
3. Essay marking — secondary offer, comes forward between cohorts.
4. Private 1:1 sales calls (15–20 min) — NOT a public product and NOT sold.
   It is a private conversion mechanic: the booking link is sent only to vetted,
   high-intent leads via email, Instagram DM, or TikTok DM, to protect Rohan's
   time. Low, intentional volume — do not treat a low count as underperformance.
   IMPORTANT FOR AI ANALYST: "Strategy sessions" in the analytics data maps to
   these private calls. A count of 2–6 per month is normal and intentional.
   NEVER flag a low strategy session count as a problem, a gap, or an opportunity
   to "increase call capacity". The link is never advertised publicly; calls are
   issued manually to hot leads only. Any insight suggesting a low strategy session
   count needs investigation or action is incorrect and should be disregarded.

## Lead magnets currently in rotation (the main top-of-funnel capture)
- GAMSAT S1 Mini Mock  (historically the best converter)
- GAMSAT S2 Slam System
- GAMSAT S1 Question Tracker
All exist to capture an email, then feed the email nurture.

## The funnel (what the dashboard metrics mean commercially)
Discovery is mostly social — Instagram, YouTube, TikTok — plus some referrals.
Most people enter by opting into a lead magnet, which captures their email.
The core engine is then EMAIL nurture: heavy email sequences pushing leads toward
the Comprehensive Course. Hot/engaged leads (e.g. segments who have clicked links
before) are invited to a private 1:1 sales call, which is the main 1:1 conversion
step into the course.

So on the dashboard:
- "Visitors" and social/referral sources = top-of-funnel discovery.
- "Leads generated" / "Resource downloads" = email capture via lead magnets — the
  most important early metric, since email is the conversion channel.
- "Strategy sessions" = the private 1:1 sales calls (invite-only, low by design).
- "Checkout clicks" / "Course purchases" = Comprehensive Course intent and sales.
The historically weakest link is lead → checkout: people opt in for free
resources but stall before the paid course. The job is to move email leads to
the course, and to surface which leads are hot enough for a sales-call invite.

## What "good" looks like
- Lead magnets should capture email at a healthy opt-in rate; S1 Mini Mock is the benchmark.
- Email engagement (clicks) is the signal that identifies sales-call candidates.
- High-traffic pages converting under ~2% are leaks worth fixing.
- Social drives discovery but often under-converts directly; judge it on lead capture, not direct sales.

## Recorded assets
- A one-off live workshop was run on 24 May 2026, recorded and uploaded to YouTube.
  It is now an evergreen content asset, NOT a recurring event. Do not flag
  "low workshop registrations" — the workshop no longer runs.

## CURRENT PRIORITY  (snapshot — update when the launch changes)
- Do not publish June 2026 start-date copy. That cohort date has passed.
- The March 2027 cohort is open for enrolment. The live class schedule is
  confirmed before classes begin, so use schedule-pending language until it is
  published.
- Pricing: $1599 early bird until 1 October 2026, then $1799. Full payment only
  during the early bird window; there is no instalment plan right now.
- Primary push: email nurture off lead magnets → quiz, Blueprint, private
  mentoring, or waitlist depending on fit and availability; invite hot/engaged
  email leads to a private 1:1 sales call.
- Step-down paths: GAMSAT Starter Pack, Blueprint, essay marking, and private
  tutoring.
`;

module.exports = { BUSINESS_CONTEXT };
