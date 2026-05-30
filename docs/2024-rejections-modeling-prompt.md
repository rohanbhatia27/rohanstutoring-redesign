# 2024 GEMSAS Rejections — Expert Analysis & Claude Modeling Prompt

**Purpose:** Feed this document to Claude (or another model) to derive calculator parameters from the community **Rejections** tab (2024 application cycle / 2025 entry).  
**Consumer:** Rohan Stutoring Interview Chances Calculator (`site/js/interview-calculator.js`, `site/data/gemsas-cutoffs.json`).  
**Data access:** Screenshots only unless you have CSV export; full row-level extraction requires the unlocked sheet or manual transcription.

---

## Part A — Expert analysis (human-readable)

### What this dataset is

- **Source:** r/GAMSAT community workbook compiled by Luke; tab **"Rejections"** (other tabs: Interviews, Summary Non-Rural/Rural, Bonuses & CASPer, etc.).
- **Unit of observation:** One row = one applicant’s outcome **for a single university** where they did **not** receive an interview offer in the **2024** cycle.
- **Scale:** ~400+ rows visible across screenshots; same person may appear on multiple rows (different universities).
- **Primary score:** **Final Combo** (post-bonus aggregate used for ranking). **Raw Combo** is pre-bonus; often equals Final Combo when all bonus columns are zero.

### Column schema (19 columns, A–S)

| Col | Field | Type | Modeling role |
|-----|--------|------|----------------|
| A | Timestamp | datetime | Filter cycle; ignore for scoring |
| B | Rurality | `Non-Rural` \| `Rural` | **Stratify all stats** |
| C | University | string (full name) | **Primary grouping key** |
| D | Final Combo | float ~1.28–1.71 | **Main dependent variable for floors** |
| E | GPA | float 5.3–7.0 (7-pt scale) | Input feature; validate combo formula |
| F | GAMSAT | float ~57–95 (overall) | Input feature |
| G | Raw Combo | float | Detect bonus uplift: `final - raw` |
| H | CASPer Quartile | `1st`–`4th`, `N/A` | Modifier at CASPer unis only |
| I | ANU Bonuses | numeric | Uni-specific bonus |
| J | Deakin Bonus | numeric (0,2,4,6,8,10,12…) | **Often shifts raw→final** |
| K | MQ Bonus | numeric | Macquarie |
| L | Deakin RTS Tier | categorical | Sub-stream |
| M | UniMelb GAM | Yes/No/None | Equity pathway |
| N | UNDF Bonuses | None, WA Res, HDR, … | Notre Dame Fremantle |
| O | UNDS Bonuses | None, HDR, … | Notre Dame Sydney |
| P | UQ MP/RMP Tier + Location | e.g. Tier 3 Toowoomba | **Split UQ into GB vs RMP** |
| Q | UoW Bonuses | 0–4 | **Critical for UoW** |
| R | Notes | free text | Outlier flags, cross-offers |
| S | Outlier | flag | Exclude from aggregates if set |

### Universities present in screenshots

| University (sheet label) | Approx rows | Cohort in view | Rejected Final Combo (approx range) |
|--------------------------|-------------|----------------|-------------------------------------|
| Australian National University | 2–37 | Mostly non-rural | 1.52 – 1.72 |
| Deakin University | 38–98 | Mostly non-rural | 1.44 – 1.71 |
| Griffith University | 94–141 | Non-rural | 1.54 – 1.66 |
| Macquarie University | 142–153 | Non-rural | 1.58 – 1.62 |
| University of Melbourne | 154–191 | Non-rural | 1.62 – 1.68 |
| UNDF (Notre Dame Fremantle) | 233–248 | Non-rural | 1.55 – 1.65 |
| UNDS (Notre Dame Sydney) | 249–281, 286–307 | Non-rural | 1.48 – 1.59 |
| UQ Greater Brisbane | 308–340 | Non-rural | 1.54 – 1.67 |
| UQ RMP/DDMP | 341–351 | Non-rural | 1.48 – 1.63 |
| UWA | 352–360 | Non-rural | 1.51 – 1.63 |
| UoW | 361–375, 329–439 | Non-rural (+ rural tail) | **Bimodal:** many at **1.28571**, others 1.54–1.65 |
| Deakin, MQ, UNDS, UQ, UWA | 440–445 | Rural | 1.38 – 1.61 |

### Critical statistical insight (how rejections relate to cutoffs)

Rejections are **left-censored observations of the competitive threshold**:

- If interview minimum true cutoff = **T**, any rejected applicant has `Final Combo ≤ T` (approximately; plus noise from pathway/bonus rules).
- Therefore **max(Final Combo | rejected, uni, cohort)** is a **conservative upper bound** on T, not T itself.
- **Do not** set `interviewMin = max(rejection combo)` without adjustment — you will **overstate** competitiveness (tell students they’re safe when they aren’t).
- Recommended uses:
  1. **Floor calibration** for `mapToBand` below `interviewMin` (steep 5–15% zone).
  2. **Sanity check** on existing success-pool `interviewMin` from Interviews/Summary tabs.
  3. **Bonus-aware sub-models** later (v2).

### Patterns that will break naive models

1. **UoW 1.28571 cluster (non-rural):** Dozens of rejections share **identical** Final Combo despite GPA 5.8–7.0 and GAMSAT 57–74. Likely a **formula artifact, pathway cap, or data-entry bucket** — not the same scale as other unis’ 1.5–1.7 combos. **Segment UoW**; do not pool with standard GEMSAS combo scale without verifying Luke’s UoW formula.
2. **High performers rejected:** e.g. GPA 7.0 + GAMSAT 94+ at UQ GB; GPA 7.0 + GAMSAT 65 at Deakin with 0% bonus. Shows **bonuses, CASPer, preferences, and sub-streams** matter beyond raw GPA/GAMSAT.
3. **Raw vs Final divergence (Deakin):** Final can exceed Raw by several points when Deakin Bonus is 2–10. Calculator v1 uses **no-bonus** cutoffs — filter rejection rows where **all bonus columns are 0** (or document bonus-adjusted separately).
4. **CASPer at CASPer unis:** 4th quartile rejections exist at UoW, UNDS, UNDF — CASPer is **not sufficient**; treat as penalty below quartile 2, not a lift for high quartiles.
5. **Cross-university notes:** Rows noting interview offers elsewhere (Kimberley, RMP while rejected GB) are **not** failures of combo score globally — flag as outliers.
6. **Duplicate applicants:** Same timestamp/GPA/GAMSAT across unis — cluster-robust stats or dedupe by synthetic `applicant_id` if you can infer from timestamp+GPA+GAMSAT.

### Suggested aggregates to compute (per university × rurality)

After full CSV extraction:

```
rejection_max     = max(final_combo)
rejection_p99     = percentile(final_combo, 99)
rejection_p90     = percentile(final_combo, 90)
rejection_median  = percentile(final_combo, 50)
rejection_n       = count(rows)

bonus_free subset:
  where anu_bonus=0 AND deakin_bonus=0 AND mq_bonus=0 AND uow_bonus=0 
  AND undf in (None,'') AND unds in (None,'') AND uq_pathway empty
```

Compare `rejection_max` (bonus-free) to existing JSON `interviewMin` (from interview pool):

| Uni | Current nonRural interviewMin (gemsas-cutoffs.json) | Rejection max (visual est.) | Interpretation |
|-----|------------------------------------------------------|-----------------------------|----------------|
| ANU | 1.6917 | ~1.72 | Rejections reach **above** current min → min may be low or bonuses mixed in |
| Deakin | 1.6575 | ~1.71 | Similar tension |
| Griffith | 1.6322 | ~1.66 | Close |
| Macquarie | 1.5658 | ~1.62 | Rejections extend past min |
| Melbourne | 1.5908 | ~1.68 | Large gap — review weighting / GAM rows |
| UQ | 1.6199 | ~1.67 | Close |
| UWA | 1.6243 | ~1.63 | Aligns reasonably |
| UNDF | 1.5219 | ~1.65 | Rejections above min |
| UNDS | 1.4803 | ~1.59 | Rejections above min |
| UoW | 1.4008 | **1.28571 mode + 1.65 tail** | **Bimodal — do not use single percentile** |

### Combo formula (calculator must match dataset)

Current production formula (`interview-calculator.js`):

```javascript
// section-weighted GAMSAT mean, then:
combo = gpa / gpaScale + gamsat_weighted / 100
// default gpaScale=7, weights per uni in gemsas-cutoffs.json
```

**Validation task for model:** For bonus-free rows, back-solve whether `final_combo ≈ gpa/7 + gamsat/100` or whether unis use different section weights (e.g. S3 double-weight). Report RMSE per university.

---

## Part B — Claude modeling prompt (copy from here down)

```
You are a statistical consultant helping build a **GEMSAS Interview Chances Calculator** for Australian graduate medical school applicants. You will receive (or have received) row-level data from the **"Rejections"** tab of the community-compiled r/GAMSAT Luke workbook for the **2024 application cycle** (2025 medical school entry).

Your job is to turn rejection rows into **calculator parameters** that define what score combinations were **unsuccessful** (no interview), and how those relate to the **success-pool cutoffs** already estimated from interview/offer data.

---

### 1. Business context

- **Product:** Static web calculator; students enter GPA (7-pt GEMSAS), GAMSAT section scores, CASPer quartile (optional), rural toggle.
- **Output:** Per-university **banded % chance** (5%, 10%, … 95%), not exact probabilities.
- **Method (v1):** Piecewise-linear map from combo score to % using three anchors per uni × cohort:
  - `interviewMin` → ~15%
  - `p50` (median interview pool) → ~55%
  - `p90` → ~90%
  - above p90 → ~95%
- **CASPer:** Only UNDF, UNDS, UoW use CASPer in GEMSAS; apply −1 band (5%) if quartile < 2.
- **Disclaimer:** Community data, not official; rough guidance only.

Existing success-pool cutoffs live in `gemsas-cutoffs.json` (blended 2024/2025 interview data). **Rejections calibrate the bottom of the curve**, not the middle/top.

---

### 2. Input data schema

Each row is one (applicant × university) **rejection**. Columns:

- `timestamp`, `rurality` (`Non-Rural`|`Rural`), `university` (string)
- `final_combo`, `raw_combo`, `gpa`, `gamsat`
- `casper_quartile` (`1st`|`2nd`|`3rd`|`4th`|`N/A`)
- Bonus fields: `anu_bonus`, `deakin_bonus`, `mq_bonus`, `deakin_rts_tier`, `unimelb_gam`, `undf_bonus`, `unds_bonus`, `uq_mp_rmp_tier_location`, `uow_bonus`
- `notes`, `outlier`

**Normalize university names** to IDs:
`anu`, `deakin`, `griffith`, `macquarie`, `melbourne`, `uq` (split `uq_gb` vs `uq_rmp` if pathway column set), `uwa`, `undf`, `unds`, `uow`.

---

### 3. Data cleaning rules (apply in order)

1. Drop rows with `outlier` marked or notes indicating **interview obtained at same uni via different pathway** (e.g. Kimberley, sub-stream offer).
2. Parse `rurality` → `nonRural` boolean.
3. Split **UQ** into at least **Greater Brisbane** vs **RMP/DDMP** using column P when non-empty.
4. For **bonus-free cohort** (calculator v1): keep rows where ALL of: anu_bonus=0, deakin_bonus=0, mq_bonus=0, uow_bonus=0, undf/unds bonuses empty/None, unimelb_gam≠Yes, deakin_rts=Did not apply, uq pathway empty.
5. **UoW special case:** Flag rows with `final_combo` between 1.28 and 1.29 (the 1.28571 cluster). Analyze separately; report whether they match an alternate formula or incomplete bonus application.
6. Deduplicate: create `applicant_key = hash(timestamp, gpa, gamsat)`; when computing applicant-weighted stats, use one row per applicant per uni only (already satisfied), but note multi-uni dependence for uncertainty.

---

### 4. Core analytics to produce

For each `(university_id, cohort)` with `n ≥ 8` (else flag "insufficient data"):

| Stat | Definition | Use |
|------|------------|-----|
| `rej_n` | count | confidence |
| `rej_max` | max(final_combo) | upper bound on true cutoff |
| `rej_p99`, `rej_p95`, `rej_p90` | percentiles | robust upper bounds |
| `rej_median` | p50 of rejections | mass of unsuccessful applicants |
| `gpa_at_rej_max` | GPA at row achieving rej_max | narrative examples |
| `gamsat_at_rej_max` | GAMSAT at rej_max | narrative examples |
| `casper_breakdown` | % by quartile | CASPer uni modifiers |

**Bonus-aware parallel table:** same stats on full rejection set (bonuses allowed) with columns summarizing mean bonus uplift `final_combo - raw_combo`.

**Formula validation:** Regress `final_combo ~ gpa + gamsat` and `final_combo ~ gpa/7 + gamsat/100` plus uni fixed effects. Per uni, test section-weighted GAMSAT if section data become available. Report R² and max residual.

---

### 5. Mapping rejections → calculator parameters

**Do NOT** replace `p50` or `p90` from rejection data (those come from **interview** pools).

**DO** propose adjustments to:

#### 5a. `interviewMin` reconciliation

Given existing `interviewMin_success` from interview pool and `rej_max` from rejections:

- If `rej_max > interviewMin_success`: the success-pool min is **too low** OR rejections include bonus/pathway noise. Recommend `interviewMin_new = weighted_avg(interviewMin_success, rej_p99, weights=0.6, 0.4)` and explain.
- If `rej_max < interviewMin_success - 0.05`: success min is plausible; use rejections only for sub-min slope.
- Target: `P(reject | combo = interviewMin_new) ≈ 50–80%` in historical data (not strictly achievable; qualitative).

#### 5b. Below-minimum band steepness

Current JS for `score <= interviewMin`:
`pct = max(5, 15 - (interviewMin - score) * 100)`

Propose `floor_slope` per uni from rejection density below success min:
- If many rejections cluster **well below** `interviewMin`, steepen (faster drop to 5%).
- If rejections are tight just below min, gentler slope.

Output suggested `floor_slope` or piecewise second breakpoint `rejection_cluster_center`.

#### 5c. `rejectionCeiling` metadata (new JSON field)

Add per uni:
```json
"rejectionStats2024": {
  "nonRural": {
    "n": 42,
    "max": 1.682,
    "p99": 1.675,
    "bonusFreeMax": 1.668
  }
}
```
Used for copy: "Applicants with similar scores were unsuccessful at this university in 2024."

#### 5d. CASPer (UNDF, UNDS, UoW only)

Among rejections with casper_quartile 3rd/4th, compute % — if >15%, **do not** imply high CASPer rescues low combo. Tune `penaltyBands` only for quartile < 2.

---

### 6. Deliverables (structured output)

1. **Executive summary** (≤400 words): what rejections imply for students; emphasize uncertainty.
2. **Per-university tables** (bonus-free + full): n, rej_max, rej_p99, rej_p90, comparison to existing interviewMin/p50/p90.
3. **JSON patch** for `gemsas-cutoffs.json`:
   - Revised `interviewMin` per uni/cohort (if justified)
   - New `rejectionStats2024` object
   - Flags: `bimodal`, `insufficient_n`, `formula_mismatch`
4. **UoW appendix:** explain 1.28571 cluster; recommend separate handling or exclusion until formula confirmed.
5. **Outlier list:** top 10 "surprising" rejections (highest combo) with GPA, GAMSAT, bonuses, notes — for manual review.
6. **Student-facing copy snippets** (2 sentences per uni): "In 2024, non-rural applicants without bonuses were rejected with combos up to X."

---

### 7. Sample rows transcribed from screenshots (seed data — extend with full CSV)

Use these to sanity-check your pipeline until full export is available:

```csv
rurality,university,final_combo,gpa,gamsat,casper,deakin_bonus,anu_bonus,uow_bonus,notes
Non-Rural,Australian National University,1.68114,6.81,65.75,2nd,0,2,0,
Non-Rural,Australian National University,1.64710,6.548,62.25,4th,2,0,4,GAM financial disadvantage
Non-Rural,Australian National University,1.52150,6.58,61.75,3rd,2,0,2,Kimberley interview elsewhere - OUTLIER
Non-Rural,Deakin University,1.71010,6.77,65.5,3rd,0,0,0,
Non-Rural,Deakin University,1.71035,6.858,63.25,3rd,2,0,0,First class honours 2% Deakin bonus
Non-Rural,Deakin University,1.65750,7.0,65.75,2nd,0,0,0,
Non-Rural,Griffith University,1.64310,6.931,82.5,N/A,0,0,0,
Non-Rural,Griffith University,1.64530,6.813,65.5,3rd,2,0,0,
Non-Rural,Macquarie University,1.62136,6.712,86.25,4th,0,0,0,
Non-Rural,University of Melbourne,1.68286,6.6,75,2nd,0,0,0,GAM Yes
Non-Rural,University of Melbourne,1.68,6.8,77,3rd,0,0,0,approx from screenshot band
Non-Rural,University of Queensland,1.64530,7.0,94.33,N/A,0,0,0,
Non-Rural,University of Queensland,1.66610,6.6,95.0,2nd,0,0,0,
Non-Rural,University of Wollongong,1.64970,6.803,86.5,3rd,0,0,3,
Non-Rural,University of Wollongong,1.28571,6.54,61.5,3rd,0,0,3,
Non-Rural,University of Wollongong,1.28571,6.906,74.5,1st,0,0,3,
Non-Rural,University of Wollongong,1.28571,7.0,64.0,4th,0,0,1,
Rural,Deakin University,1.61416,6.848,57.75,1st,12,0,0,
Rural,Macquarie University,1.42415,5.838,59.5,4th,0,0,1,Added 5% rural bonus to UQ
Rural,University of Queensland,1.38370,5.838,59.5,4th,0,0,1,
```

---

### 8. Existing success-pool cutoffs (for comparison)

```json
{
  "anu":        { "nonRural": { "interviewMin": 1.6917, "p50": 1.7227, "p90": 1.7967 } },
  "deakin":     { "nonRural": { "interviewMin": 1.6575, "p50": 1.7186, "p90": 1.7425 } },
  "griffith":   { "nonRural": { "interviewMin": 1.6322, "p50": 1.6753, "p90": 1.7117 } },
  "macquarie":  { "nonRural": { "interviewMin": 1.5658, "p50": 1.6352, "p90": 1.6585 } },
  "melbourne":  { "nonRural": { "interviewMin": 1.5908, "p50": 1.7035, "p90": 1.7536 } },
  "uq":         { "nonRural": { "interviewMin": 1.6199, "p50": 1.6686, "p90": 1.7158 } },
  "uwa":        { "nonRural": { "interviewMin": 1.6243, "p50": 1.6502, "p90": 1.6958 } },
  "undf":       { "nonRural": { "interviewMin": 1.5219, "p50": 1.6043, "p90": 1.6449 } },
  "unds":       { "nonRural": { "interviewMin": 1.4803, "p50": 1.6564, "p90": 1.7143 } },
  "uow":        { "nonRural": { "interviewMin": 1.4008, "p50": 1.5538, "p90": 1.6194 } }
}
```

---

### 9. Constraints

- Never present outputs as official university cutoffs.
- Prefer **bonus-free** rejection stats for v1 calculator parity.
- Round published % bands to nearest 5%.
- No em dashes in student-facing copy.
- When uncertain, output **confidence: low/medium/high** per parameter.

---

### 10. If you only have screenshots (no CSV)

1. OCR/transcribe all visible rows into the CSV schema above.
2. Mark incomplete universities with `n_visible` counts.
3. Run the same analytics on partial data but widen confidence intervals.
4. Produce a **transcription checklist** of row ranges still needed.

---

Begin by confirming you understand the rejection-vs-interview-pool distinction, then request the full CSV or proceed with the seed CSV and screenshot row ranges listed in Part A.
```

---

## Part C — Next steps for Rohan

1. **Export the Rejections tab** (if Luke grants copy access) as CSV — one-time manual copy is painful at 400+ rows.
2. Paste **Part B** into Claude with the CSV attached.
3. Apply the JSON patch to `site/data/gemsas-cutoffs.json` after human review of `interviewMin` changes (especially Melbourne, UoW).
4. Optional UI: show `rejectionStats2024.bonusFreeMax` in gated breakdown copy.

---

*Generated 2026-05-30 from screenshot analysis of Luke r/GAMSAT workbook Rejections tab (2024 cycle).*
