# Interview Chances Calculator — Design

Date: 2026-05-30
Status: Approved (pending spec review)

## Goal

A free, on-site calculator where a prospective medical student enters their GAMSAT
results, GPA, and CASPer quartile, and sees a rough, banded estimate of their interview
(and offer) chances across the GEMSAS universities. Output is intentionally approximate,
rounded to the nearest 5% (e.g. 25%, 65%, 75%) — not a precise probability. It runs as a
lead magnet in the existing site funnel.

Scope for v1: GEMSAS universities only. University of Sydney (different metric system,
separate spreadsheets) is explicitly deferred to a later version.

## Decisions (locked with stakeholder)

- **Methodology:** Threshold model. Compare the student's per-uni combo score against
  historical interview/offer cutoffs; map to a banded %. No raw-row distribution modelling.
- **Data source:** The r/GAMSAT ("Luke") GEMSAS offer workbooks (6 application cycles).
  Proceed using the aggregated cutoffs, with visible r/GAMSAT attribution in the tool.
- **Combo formula source:** Per-uni GEMSAS weighting formulas come from the stakeholder /
  the spreadsheets (a tab/doc Rohan will point to), so conversion matches the dataset's method.
- **CASPer:** Applied as a modifier/gate only for the unis that use CASPer; ignored for the rest.
- **Rural/non-rural:** User-controlled toggle (not auto-detected).
- **Lead gate:** Soft gate. Headline result shown immediately; full ranked per-uni
  breakdown + "how to improve your odds" guidance gated behind email capture.
- **Architecture:** Static page + separate JSON data file (no backend).

## Data source reality

- The source workbooks are view-only with copy/export deliberately disabled by the owner.
  The gviz/CSV export endpoints redirect back to the locked view — programmatic export is
  blocked. Google Sheets renders cells in a canvas, so DOM text extraction yields only tab
  names, not values.
- Therefore extraction is **visual/manual**: screenshot the small summary tabs and transcribe.
- This is tractable because the needed data is the pre-aggregated **Statistics** tabs, not
  raw rows. Per workbook: the `Statistics (vs Interviews)`, `Statistics (Non-Rural)`, and
  `Statistics (Rural)` tabs hold per-uni `Interview Minimum`, `Offer Minimum`, and mean
  combo scores. ~11 unis × a few values × 2 cohorts × 6 years is a handful of screenshots.
- Universities observed: ANU, Deakin, Griffith, MQ, UniMelb, UNDF, UNDS, UQ, UWA, UoW
  (plus an "Overall" aggregate row).

## Architecture

Option A (chosen): static page + separate JSON data file. Pure client-side, matches the
existing free-tool pattern (quote-generator, quiz), fully static/cacheable, and yearly data
refreshes only touch the JSON file.

New files:
- `interview-calculator.html` — page shell, styled with `css/style.css` + a small
  page-specific `css/interview-calculator.css`.
- `js/interview-calculator.js` — input handling, combo-score conversion, threshold→% mapping,
  rendering, soft-gate integration.
- `data/gemsas-cutoffs.json` — extracted cutoffs + per-uni weighting formulas + CASPer config.

Reused:
- `css/style.css` tokens/layout, nav, footer.
- `js/free-resource-form.js` for the email soft gate (FormKit/Formspree), matching other tools.
- Analytics/consent scripts in the standard `<head>` order used by other tool pages.

## Data model (`data/gemsas-cutoffs.json`)

```jsonc
{
  "source": "r/GAMSAT GEMSAS offer data (compiled by Luke)",
  "cycles": ["2020", "2021", "2022", "2023", "2024", "2025"],
  "universities": [
    {
      "id": "uq",
      "name": "University of Queensland",
      "usesCasper": true,
      "weighting": { /* per-uni GEMSAS formula inputs: GPA weight, GAMSAT weight,
                        section weighting e.g. s3 double-weighted, GPA scale, etc. */ },
      "cutoffs": {
        "nonRural": { "interviewMin": 1.60, "offerMin": 1.66, "offerMean": 1.72 },
        "rural":    { "interviewMin": 1.50, "offerMin": 1.55, "offerMean": 1.63 }
      }
      // Per-cycle values may be stored as arrays and averaged/trended in JS,
      // or pre-averaged at extraction time. Decided during extraction.
    }
  ],
  "casper": { /* which quartiles gate/modify, per relevant uni */ }
}
```

Exact cutoff representation (per-cycle arrays vs pre-averaged) is finalised during the
extraction step once the spread across years is visible.

## Combo-score conversion

Inputs: GAMSAT overall + 3 section scores, GPA (GEMSAS 7-point), CASPer quartile, rural toggle.
For each uni, apply that uni's `weighting` to produce the student's combo score on the same
scale as the dataset cutoffs (~1.4–1.7 range observed).

## Threshold → % mapping (rounded to nearest 5%)

Per uni, using that uni's cutoffs (trended across the 6 cycles), with anchor bands:
- below interview minimum → ~5–15%
- between interview minimum and offer mean → scales through the middle
- at offer mean → ~50%
- well above offer mean → ~80–95%

Anchors (5 / 50 / 95) are tunable constants in `interview-calculator.js`. CASPer applies only
for `usesCasper` unis, as a modifier/gate on the computed band.

## UI / funnel

Single results page:
1. Input form: GAMSAT (overall + sections), GPA, CASPer quartile, rural/non-rural toggle.
2. "Calculate" → headline result shown immediately (e.g. best-chance uni or overall band).
3. Soft gate (`free-resource-form.js`): email unlocks the full ranked per-uni table
   (uni → banded %) plus "how to improve your odds" guidance.
4. Persistent disclaimer: rough estimate, not advice; visible r/GAMSAT attribution.

## Out of scope (v1)

- University of Sydney and any non-GEMSAS metric system.
- Raw-row distribution / logistic modelling.
- Server-side computation or storing user inputs beyond the existing email-capture flow.

## Open items to resolve during build

- Rohan to point to the per-uni weighting formulas (sheet tab or doc).
- Confirm which GEMSAS unis use CASPer and how their quartile gating works.
- Confirm GAMSAT input granularity needed by the weighting formulas (overall vs per-section).
```
