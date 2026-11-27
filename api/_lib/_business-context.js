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
1. GAMSAT March Intensive — CURRENT ACTIVE LIVE OFFER (replaces the closed
   October and Summer Comprehensive cohorts for March 2027 sitters).
   16 live S1 + S2 classes with Rohan over 8 weekends (Sat 12 Dec 2026 to
   Sat 13 Mar 2027), timed around the March 2027 sittings (S2 27–28 Feb,
   S1/S3 from 19 Mar). S1 runs Saturdays 9–10am Sydney (Fri 10pm UK); S2 runs
   Sundays 7–8pm Sydney (Sun 8am UK). Includes full Blueprint library (80+ hrs),
   Last-Two Diagnostic, Weekly Game Plan, No-Backslide Holiday Plan, January
   Restart Session (10 Jan), S1 Keep-Warm Clinic (13 Feb), timed S2 mock +
   live debrief (21 Feb), and essays marked by Rohan. Enrolment closes
   Thursday 10 December 2026. Two-class refund guarantee (email before Class 3
   on Sat 19 Dec for a full refund).
   - Base: A$1,699 paid in full (+1 bonus marked essay = 3 total), or
     3 × A$629/month (A$1,887 total). Capped at 15 places.
   - Premium: A$2,599 paid in full, or 3 × A$959/month (A$2,877 total).
     Capped at 6 places. Adds 4 semi-privates with Rohan (max 6 students),
     3 extra essays marked by Rohan (5 total), and a 30-min diagnostic with
     Shayan in early January.
   Page: /courses/march-intensive
   (Note: Live Comprehensive Course and Mastery Program summer cohorts closed /
   sold out on 27 November 2026.)
2. Step-down / nurture entry points: GAMSAT Starter Pack
   (/courses/starter-pack) and Rohan's Blueprint (/courses/blueprint, A$599).
   Blueprint is the primary self-paced downsell for leads who cannot attend
   live classes or want to study independently.
3. Essay marking — secondary offer, comes forward between cohorts. Reopened in
   September 2026: $34.99 per essay, $249 for 10, 3-day turnaround.
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
   Exception: the Mastery quiz result and the Mastery Path Kit emails link the
   consultation booking page directly, so some strategy sessions come from
   Mastery-fit quiz leads. That is intended.

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
- Do not publish June 2026, October 2026, or November 2026 summer cohort
  enrolment copy. Both the October cohort (started 28 Oct) and the Summer
  cohort (Comprehensive, Mastery, S1-only, S2-only — closed 27 Nov 2026) are
  closed / sold out to new enrolments.
- Current active live cohort for March 2027 GAMSAT sitters: **GAMSAT March
  Intensive** (/courses/march-intensive).
  - 16 live classes over 8 weekends, 12 December 2026 to 13 March 2027
    (break 21 Dec – 9 Jan; Restart Session Sun 10 Jan; S1 Keep-Warm Clinic
    Sat 13 Feb; S2 timed mock debrief Sun 21 Feb).
  - S1 Saturdays 9–10am Sydney (Fri 10pm UK); S2 Sundays 7–8pm Sydney
    (Sun 8am UK). All classes recorded.
  - Enrolment closes Thursday 10 December 2026 (or earlier on sell-out).
  - Pricing: Base A$1,699 paid in full (+1 bonus marked essay = 3 total) or
    3 × A$629 (A$1,887 total), capped at 15. Premium A$2,599 paid in full or
    3 × A$959 (A$2,877 total), capped at 6 (4 semi-privates with Rohan,
    5 essays marked by Rohan, 30-min diagnostic with Shayan).
  - Risk reversal: two-class refund guarantee only (attend or watch first two
    classes on 12–13 Dec; email before Class 3 on Sat 19 Dec for a full refund;
    no score guarantee).
  - Pitch angle: S1-led ("stop losing S1 marks between the last two options"),
    aimed at warm March 2027 leads (both re-sitters and first-timers).
- Essay marking is open ($34.99 per essay, $249 for 10, 3-day turnaround).
- Primary push: convert warm March 2027 leads into GAMSAT March Intensive
  (Base or Premium); step-down to Rohan's Blueprint (A$599) for self-paced
  or budget-constrained leads; September 2027+ sitters go to Blueprint or
  Essentials Playbook.
`;

module.exports = { BUSINESS_CONTEXT };
