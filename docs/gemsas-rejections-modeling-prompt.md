# GEMSAS Rejections (2023 & 2024) — Expert Analysis & Claude Modeling Prompt

**Purpose:** Single source of truth for extracting, harmonizing, and modeling **unsuccessful** (no interview) applicant rows from Luke’s r/GAMSAT workbook **Rejections** tabs.  
**Consumer:** Interview Chances Calculator — `site/js/interview-calculator.js`, `site/data/gemsas-cutoffs.json`  
**Cycles covered:** 2023 application cycle (2024 entry) + 2024 application cycle (2025 entry)  
**Legacy path:** `site/docs/2024-rejections-modeling-prompt.md` (superseded by this file)

### Data access constraint (important)

Luke’s workbooks are **view-only**: no copy, export, or download. Google Sheets renders cells on canvas; gviz/CSV endpoints redirect to the locked view. **Screenshots are the only practical ingestion path.**

Implications:

| What still works well | What needs more screenshots or conservative defaults |
|----------------------|------------------------------------------------------|
| Per-uni **rejection ceilings** (`rej_max`, `rej_p90`) from visible high-score rows | Exact percentiles (p99) with tight confidence |
| **Cross-cycle** direction (2023 vs 2024 competitiveness) | Full row counts (`n`) per uni |
| **Bonus-free vs bonus** patterns (Deakin, ANU, MQ) | Complete bonus-free filtering at scale |
| **Portfolio / GAM / UoW** flags and disclaimers | Precise `interviewMin` tweaks without human sign-off |
| **Formula validation** on transcribed rows | Low-variance RMSE per uni |

**Working files in this repo:**

- `site/data/rejections-screenshot-seed.csv` — every row transcribed from screenshots so far (grows as you add more batches)
- This doc — analysis + Claude prompt

**Do not** tell Claude to “request CSV export” as step 1. Tell it to use the seed CSV + any new screenshots attached in the chat.

---

## Part A — Expert analysis

### What these datasets are

| Attribute | Detail |
|-----------|--------|
| Source | r/GAMSAT community workbook (Luke); tab **Rejections** |
| Row unit | One applicant × one university where **no interview** was offered |
| Use in calculator | Calibrate **floor** (below `interviewMin`), validate success-pool mins, power disclaimers — **not** `p50` / `p90` (those come from **Interviews** / **Summary** tabs) |
| Duplication | Same person often appears on multiple rows (different unis) |

### Schema harmonization (2023 vs 2024)

When merging cycles, map to a **canonical 2024+ schema**. Missing 2023 fields → `null` / `0` / `N/A`.

| Canonical field | 2024 column | 2023 column | Notes |
|-----------------|-------------|-------------|-------|
| `application_cycle` | — | — | `"2023"` or `"2024"` (required on every row) |
| `timestamp` | A | A | |
| `rurality` | B | B | `Non-Rural` \| `Rural` |
| `university` | C | C | Normalize to `university_id` (see below) |
| `university_stream` | derived from P | derived from H | UQ: `gb`, `cq_wb_rmp`, `dd_mp`, `wb_rmp`, etc. |
| `final_combo` | D | D | Primary modeling variable |
| `gpa` | E | E | 7-pt GEMSAS scale |
| `gamsat` | F | F | Overall score |
| `raw_combo` | G | G | `bonus_uplift = final_combo - raw_combo` |
| `casper_quartile` | H | I | 2023: column I |
| `anu_bonus` | I | K | 2023: col K |
| `deakin_bonus` | J | J | 0–12 typical |
| `mq_bonus` | K | L | 2023 header: "MQ Bonus (GPA)" |
| `deakin_rts_tier` | L | — | 2023: often in **Notes** ("RTS Tier 1") |
| `unimelb_gam` | M | — | 2023: parse from **Notes** ("GAM applicant") |
| `undf_bonus` | N | — | 2023: parse Notes ("WA Res", "HDR") |
| `unds_bonus` | O | — | 2023: parse Notes |
| `uq_pathway` | P | H | 2023: "UQ RMP/MP Tier" |
| `uow_bonus` | Q | — | 2024 only; 2023 portfolio in Notes |
| `notes` | R | M | Portfolio, GAM, cross-offers |
| `outlier` | S | N | 2023: **"Outlier?"** with Yes + "Outlier LL" in notes |

**Confirmed base formula (both cycles, bonus-free):**

```text
raw_combo ≈ (GPA / 7) + (GAMSAT / 100)
final_combo ≈ raw_combo + f(bonuses, pathway, uni-specific rules)
```

Calculator production code (section-weighted GAMSAT may differ slightly per uni):

```javascript
combo = input.gpa / gpaScale
      + (weightedSectionMean / 100);
```

---

### 2024 cycle — summary (from prior screenshots)

| University | Cohort | Rejected Final Combo (approx) | Critical notes |
|------------|--------|-------------------------------|----------------|
| ANU | Non-rural | 1.52 – 1.72 | Rejections can exceed current `interviewMin` (1.69) |
| Deakin | Non-rural | 1.44 – 1.71 | Raw vs final diverges with Deakin bonus |
| Griffith | Non-rural | 1.54 – 1.66 | |
| Macquarie | Non-rural | 1.58 – 1.62 | |
| Melbourne | Non-rural | 1.62 – 1.68 | GAM rows; gap vs JSON min (1.59) |
| UNDF / UNDS | Non-rural | 1.48 – 1.65 | CASPer 4th still rejected |
| UQ GB / RMP | Non-rural | 1.48 – 1.67 | Split streams |
| UWA | Non-rural | 1.51 – 1.63 | |
| UoW | Non-rural | **Bimodal:** 1.28571 cluster + 1.54–1.65 | Do not pool clusters |
| Various | Rural | 1.38 – 1.61 | Deakin rural +12% bonus still rejected |

---

### 2023 cycle — summary (new screenshots)

#### Non-rural — core GEMSAS (ANU → MQ)

| University | Rejected Final Combo | GPA (typical) | GAMSAT (typical) | 2023-specific signals |
|------------|---------------------|---------------|------------------|------------------------|
| **ANU** | 1.60 – **1.78** | 6.55 – 6.95 | 66 – 75 | Many rows **ANU Bonus = 2**; max rejection **~1.777** with bonus |
| **Deakin** | 1.62 – **1.85** | 6.6 – 7.0 | 67 – 81 | Largest 2023 block; **Deakin Bonus 0–12**; rejections at **1.85** with 8% bonus |
| **Griffith** | 1.66 – 1.73 | 6.8 – 7.0 | 69 – 77 | **4th quartile CASPer** still rejected |
| **Macquarie** | 1.61 – 1.72 | 6.5 – 7.0 | 60 – 70 | **MQ Bonus (GPA) = 3** common; "Strong Portfolio" in notes but still rejected |

#### Non-rural — Melbourne (largest 2023 block)

| Metric | Value |
|--------|-------|
| Final Combo | **1.67 – 1.781** (extends higher than 2024 rejections) |
| GPA | Often **7.0**; many 6.5–6.9 |
| GAMSAT | **67 – 83** |
| CASPer | 3rd/4th quartile common among rejections |
| Notes | **GAM** very frequent; "Monash interview offer" = cross-uni outlier |
| Flagged outlier | Combo **~1.579** (GPA 6.95, GAMSAT 57.33) — explicit **Outlier?** row |

**Implication:** Melbourne non-rural rejection ceiling in 2023 (~**1.78**) is **far above** current `interviewMin` (1.59). Strong evidence that **GAM / equity / pathway rows must be excluded** for v1 no-bonus calculator OR Melbourne `interviewMin` must be revised upward after bonus-free filter.

#### Non-rural — Notre Dame (portfolio-heavy)

| School | Final Combo | GPA | GAMSAT | CASPer / notes |
|--------|-------------|-----|--------|----------------|
| **UNDF** | 1.55 – 1.68 | 6.2 – 6.9 | 60 – 71 | **Portfolio** dominates notes; **1st quartile CASPer** rejected at ~1.638 (GPA 6.8+, GAMSAT ~72) |
| **UNDS** | 1.57 – **1.74** | **5.48 – 7.0** | **60 – 86** | Largest UNDS section (~60 rows); PhD, HDR, portfolio quality in notes |
| **UQ (WB RMP)** | 1.67 – 1.73 | **7.0** | 67 – 75 | Tier 3; all high GPA still rejected |

**Implication:** For UNDF/UNDS/UoW, numeric combo alone is a **weak** predictor; v1 calculator should flag `portfolioSensitive: true` and avoid implying precision below ~1.65 combo.

#### Non-rural — UQ / UWA / UoW (late sheet)

| Stream | Rejected Final Combo | Notes |
|--------|---------------------|-------|
| UQ **CQ-WB RMP** | 1.615 – 1.667 | GPA 7.0 + GAMSAT mid-60s insufficient |
| UQ **DD-MP** | 1.606 – 1.720 | |
| UQ **Greater Brisbane** | **1.672 – 1.733** | Highest floor; outlier flagged ~1.589 |
| **UWA** | **1.65 – 1.74** | WA resident / GAM in notes; rejections above many 2024 estimates |
| **UoW** | **1.43 – 1.54** | Portfolio notes essential; "strong portfolio" still rejected ~1.47 |

#### Rural — all universities (dedicated 2023 screenshot)

| University | Rejected Final Combo | Notes |
|------------|---------------------|-------|
| ANU | ~1.51 – 1.52 | Very high GPA (~6.8–6.9), GAMSAT ~65 |
| Deakin | 1.55 – 1.75 | RTS Tier 1/2/3 in notes; Casper hurdle mentions |
| Griffith | 1.49 – 1.66 | GAM notes |
| Melbourne | 1.51 – 1.71 | **GAMSAT 95** + GPA 6.79 still rejected |
| UNDF / UNDS | 1.44 – 1.54 | MMT, WA bonus, first-time applicant |
| UQ (multi-stream) | **1.34 – 1.77** | Widest spread; Tier 2 rurality; poor GEMSAS GPA calc in notes |
| UWA | 1.55 – 1.61 | Rural MM3, WA resident |
| UoW | **1.30 – 1.50** | Portfolio + NDIS/volunteering notes |

---

### Cross-cycle insights (2023 vs 2024)

| Pattern | 2023 | 2024 | Calculator action |
|---------|------|------|-------------------|
| Melbourne rejection max (non-rural) | ~**1.78** | ~**1.68** | Use **max across cycles** for `rej_max` sanity; blend with weights |
| Deakin rejection max (with bonuses) | ~**1.85** | ~**1.71** | Keep **bonus-free** and **full** tables separate |
| UQ Greater Brisbane floor | ~**1.73** | ~**1.67** | Stream-specific `interviewMin` checks |
| UoW combo scale | 1.43–1.54 (2023) | 1.29 + 1.54–1.65 (2024) | **Segment**; never single percentile |
| UNDS rejection spread | Up to ~1.74 | Up to ~1.59 | Portfolio + CASPer; wide GPA range |
| Outlier discipline | Explicit **Outlier?** column | Notes + empty Outlier col | **Always exclude** `outlier=Yes` from aggregates |
| Formula | GPA/7 + GAMSAT/100 | Same + UoW anomaly | Per-uni RMSE validation required |

**Recommended cycle weights for blended rejection stats** (when reconciling with success-pool cutoffs that already use 2024/2025):

```text
rejection_blend_weight:
  2024: 0.45
  2023: 0.35
  (reserve 0.20 for 2025 rejections when available)
```

Success-pool weights in current JSON: 2025 55%, 2024 35%. Rejection weights intentionally skew slightly older to capture **competitive floors** across cycles without overfitting one year.

---

### Statistical rules (unchanged, reinforced)

1. **max(rejected combo) ≤ true cutoff** (approximate) → `rej_max` is an upper bound, not `interviewMin`.
2. If `rej_max > interviewMin_success` after bonus-free filter → either success min is low, or remaining noise (GAM, portfolio, preference). **Do not** blindly raise `interviewMin` to `rej_max`; use `rej_p99` and manual review.
3. **Portfolio-sensitive unis:** UNDF, UNDS, UoW — cap stated precision; add UI disclaimer in calculator copy.
4. **CASPer unis:** High quartile does **not** guarantee interview; only penalize quartile &lt; 2 in v1 JS.

---

### Quality gates before merging JSON

| Gate | Pass criterion |
|------|----------------|
| G1 Sample size | `n ≥ 8` per `(uni, cohort, cycle)` or flag `insufficient_n` |
| G2 Bonus-free integrity | ≥70% of rows in bonus-free slice for core unis |
| G3 Formula RMSE | `median(|final - (gpa/7+gamsat/100)|) < 0.02` on bonus-free rows, per uni |
| G4 Cross-cycle stability | `\|rej_max_2024 - rej_max_2023\| < 0.08` OR documented reason (UoW, Melbourne GAM) |
| G5 Success-pool coherence | `interviewMin_new ≥ rej_p99_bonus_free - 0.02` OR explicit exception documented |
| G6 Outlier audit | All `outlier=Yes` and cross-offer notes listed, excluded from aggregates |
| G7 Monotonicity | For fixed cohort, `rej_p90 ≤ rej_max` and `interviewMin ≤ p50 ≤ p90` in output JSON |

---

## Part B — Claude modeling prompt (copy from here down)

```
You are a statistical consultant building a **GEMSAS Interview Chances Calculator** for Australian graduate medical school applicants. You have row-level data from the Luke r/GAMSAT workbook **Rejections** tab for TWO application cycles:

- **2023 cycle** (2024 medical school entry) — ~14 columns, explicit "Outlier?" column, heavy portfolio/GAM notes
- **2024 cycle** (2025 entry) — ~19 columns, richer bonus fields (UoW bonus, UNDF/UNDS, Deakin RTS, UniMelb GAM column)

Your deliverable is a **robust, auditable parameter set** for a static web calculator that maps GPA + GAMSAT (+ CASPer + rural toggle) to **banded % chances** (5%, 10%, … 95%) per university.

---

## 1. Product & methodology (locked)

**Inputs:** GAMSAT S1/S2/S3, GPA (7-pt), CASPer quartile (optional), rural/non-rural toggle.

**Per-university combo score** (must match dataset scale ~1.3–1.8):

```javascript
gamsat_weighted = (s1*w1 + s2*w2 + s3*w3) / (w1+w2+w3);
combo = gpa / gpaScale + gamsat_weighted / 100;
```

**Band mapping** (piecewise linear; do NOT derive p50/p90 from rejections):

| Anchor | Default % |
|--------|-----------|
| score ≤ interviewMin | 5–15% (steep floor) |
| interviewMin | ~15% |
| p50 (interview pool median) | ~55% |
| p90 (interview pool 90th) | ~90% |
| above p90 | ~95% |

**CASPer:** Apply −5% (one band) only if quartile < 2 at **UNDF, UNDS, UoW** (`usesCasper: true`). Do not add positive CASPer uplift.

**v1 scope:** Bonus-free, no portfolio input, no GAM/RTS/UQ tier inputs. Rejection data informs **floors and validation**, not mid/upper anchors.

---

## 2. Canonical data model

Normalize all rows to this schema before analysis:

```typescript
type RejectionRow = {
  application_cycle: "2023" | "2024";
  timestamp: string;
  rurality: "Non-Rural" | "Rural";
  university_id: string;  // see mapping table
  university_stream: string | null;  // uq_gb | uq_cq_wb_rmp | uq_dd_mp | ...
  final_combo: number;
  raw_combo: number;
  gpa: number;
  gamsat: number;
  casper_quartile: "1st"|"2nd"|"3rd"|"4th"|"N/A"|null;
  anu_bonus: number;
  deakin_bonus: number;
  mq_bonus: number;
  deakin_rts_tier: string | null;
  unimelb_gam: boolean;
  undf_bonus: string | null;
  unds_bonus: string | null;
  uq_pathway: string | null;
  uow_bonus: number | null;
  notes: string | null;
  outlier: boolean;
  portfolio_mentioned: boolean;  // derived: notes match /portfolio/i
  gam_mentioned: boolean;        // derived: notes match /\bGAM\b/i
};
```

**University ID mapping:**

| Sheet label contains | university_id | university_stream rules |
|---------------------|---------------|-------------------------|
| Australian National University | anu | |
| Deakin | deakin | |
| Griffith | griffith | |
| Macquarie | macquarie | |
| Melbourne | melbourne | |
| Notre Dame Fremantle / UNDF | undf | |
| Notre Dame Sydney / UNDS | unds | |
| Queensland + Greater Brisbane | uq | gb |
| Queensland + CQ-WB / Wide Bay | uq | cq_wb_rmp |
| Queensland + Darling Downs / DD | uq | dd_mp |
| Queensland + WB RMP | uq | wb_rmp |
| Western Australia / UWA | uwa | |
| Wollongong / UoW | uow | |

For calculator v1 JSON, **collapse UQ streams to single `uq`** using the **strictest** (highest) `rej_max` among streams unless stakeholder requests stream-specific pages later.

---

## 3. Cleaning pipeline (strict order)

1. **Parse cycle** from file/sheet metadata.
2. **Harmonize columns** per schema mapping (Part A table). Parse 2023 GAM/RTS/WA Res from Notes when columns missing.
3. **Outlier exclusion:** Drop if `outlier === true` OR notes match: Kimberley interview, Monash interview offer, "received interview" at same pathway, "Outlier LL", explicit skew warnings.
4. **Cross-offer exclusion:** Drop rows where notes indicate success at **same** uni via alternate pathway.
5. **Rurality:** `cohort = rural | nonRural`.
6. **Bonus-free slice (v1):** Keep rows where:
   - `anu_bonus === 0`, `deakin_bonus === 0`, `mq_bonus === 0`
   - `(uow_bonus === 0 || uow_bonus === null)`
   - `!unimelb_gam`, `deakin_rts_tier` empty or "Did not apply"
   - `undf_bonus` / `unds_bonus` empty or "None"
   - `uq_pathway` empty or N/A
7. **GAM slice (report only):** `gam_mentioned === true` — separate table, do not merge into v1 params.
8. **UoW segmentation:**
   - Segment A: `1.28 <= final_combo <= 1.29` (2024 bucket)
   - Segment B: `final_combo >= 1.40` (standard scale)
   - Report separately; v1 calculator uses Segment B only unless formula audit merges them.
9. **Applicant key:** `hash(timestamp, round(gpa,3), round(gamsat,2))` for duplicate diagnostics (do not dedupe across unis).

---

## 4. Analytics (per university_id × cohort × cycle, then blended)

### 4a. Per-cycle stats (bonus-free, outliers removed)

| Stat | Definition |
|------|------------|
| n | row count |
| rej_max | max(final_combo) |
| rej_p99, rej_p95, rej_p90 | percentiles |
| rej_median | p50 of rejections |
| rej_min | min(final_combo) |
| bonus_uplift_mean | mean(final - raw) on full slice |
| casper_4th_pct | % with 4th quartile |
| portfolio_pct | % with portfolio_mentioned |
| gpa_at_rej_max, gamsat_at_rej_max | values at max row |

### 4b. Cross-cycle blend

For each `(university_id, cohort)`:

```text
rej_max_blended  = 0.45 * rej_max_2024 + 0.35 * rej_max_2023
rej_p99_blended  = 0.45 * rej_p99_2024 + 0.35 * rej_p99_2023
```

If only one cycle has `n ≥ 8`, use that cycle at weight 1.0 and flag `single_cycle_only`.

### 4c. Formula validation

Per `university_id`, on bonus-free rows:

```text
predicted = gpa/7 + gamsat/100
residual  = final_combo - predicted
```

Report: mean residual, max |residual|, % rows with |residual| > 0.03. Flag `formula_mismatch` if median |residual| > 0.02.

### 4d. Reconciliation with success pool

Existing `gemsas-cutoffs.json` (interview pool, blended 2024/2025):

```json
{
  "anu":        { "nonRural": { "interviewMin": 1.6917, "p50": 1.7227, "p90": 1.7967 }, "rural": { "interviewMin": 1.4778, "p50": 1.5854, "p90": 1.6379 } },
  "deakin":     { "nonRural": { "interviewMin": 1.6575, "p50": 1.7186, "p90": 1.7425 }, "rural": { "interviewMin": 1.5171, "p50": 1.6210, "p90": 1.6985 } },
  "griffith":   { "nonRural": { "interviewMin": 1.6322, "p50": 1.6753, "p90": 1.7117 }, "rural": { "interviewMin": 1.3442, "p50": 1.5758, "p90": 1.6465 } },
  "macquarie":  { "nonRural": { "interviewMin": 1.5658, "p50": 1.6352, "p90": 1.6585 }, "rural": { "interviewMin": 1.5658, "p50": 1.6352, "p90": 1.6585 } },
  "melbourne":  { "nonRural": { "interviewMin": 1.5908, "p50": 1.7035, "p90": 1.7536 }, "rural": { "interviewMin": 1.4249, "p50": 1.5802, "p90": 1.6870 } },
  "uq":         { "nonRural": { "interviewMin": 1.6199, "p50": 1.6686, "p90": 1.7158 }, "rural": { "interviewMin": 1.5046, "p50": 1.5865, "p90": 1.6600 } },
  "uwa":        { "nonRural": { "interviewMin": 1.6243, "p50": 1.6502, "p90": 1.6958 }, "rural": { "interviewMin": 1.4659, "p50": 1.5582, "p90": 1.7007 } },
  "undf":       { "nonRural": { "interviewMin": 1.5219, "p50": 1.6043, "p90": 1.6449 }, "rural": { "interviewMin": 1.5101, "p50": 1.5862, "p90": 1.6544 } },
  "unds":       { "nonRural": { "interviewMin": 1.4803, "p50": 1.6564, "p90": 1.7143 }, "rural": { "interviewMin": 1.4790, "p50": 1.5439, "p90": 1.5782 } },
  "uow":        { "nonRural": { "interviewMin": 1.4008, "p50": 1.5538, "p90": 1.6194 }, "rural": { "interviewMin": 1.3461, "p50": 1.5220, "p90": 1.6006 } }
}
```

**Decision rules for `interviewMin` adjustment:**

| Condition | Action |
|-----------|--------|
| `rej_p99_blended > interviewMin + 0.03` (bonus-free) | Propose `interviewMin_new = 0.55*interviewMin + 0.45*rej_p99_blended`, confidence medium, human review |
| `rej_max_blended > p50` | Flag `data_quality_warning` — likely GAM/bonus leakage; re-run filters |
| `rej_max_blended < interviewMin - 0.05` | Keep `interviewMin`; tune floor slope only |
| Melbourne or Deakin | Mandatory GAM/bonus-free re-run before any min change |
| uow segment A (1.28x) | Exclude from min adjustment |

**Do NOT change p50 or p90 from rejection data.**

### 4e. Floor slope (below interviewMin)

Current JS: `pct = max(5, 15 - (interviewMin - score) * 100)`

Propose per-uni `floor_slope_multiplier` ∈ [0.8, 1.4] based on rejection density between `rej_median` and `interviewMin`:

- Many rejections **well below** interviewMin → multiplier **> 1** (steeper drop to 5%)
- Rejections **clustered just below** min → multiplier **< 1**

---

## 5. JSON output schema (required)

Emit a patch object mergeable into `gemsas-cutoffs.json`:

```json
{
  "rejectionMeta": {
    "source": "r/GAMSAT Luke workbook Rejections tab",
    "cycles": ["2023", "2024"],
    "blendWeights": { "2023": 0.35, "2024": 0.45 },
    "method": "bonus-free, outliers excluded, v1"
  },
  "universities": [
    {
      "id": "melbourne",
      "portfolioSensitive": false,
      "rejectionStats": {
        "nonRural": {
          "byCycle": {
            "2023": { "n": 0, "max": 1.7807, "p99": 1.77, "p90": 1.75, "median": 1.71 },
            "2024": { "n": 0, "max": 1.68, "p99": 1.67, "p90": 1.66, "median": 1.65 }
          },
          "blended": { "max": 1.77, "p99": 1.74, "p90": 1.72, "median": 1.68 }
        },
        "rural": { "blended": { } }
      },
      "cutoffs": {
        "nonRural": {
          "interviewMin": 1.59,
          "interviewMin_proposed": 1.62,
          "interviewMin_confidence": "medium",
          "p50": 1.7035,
          "p90": 1.7536,
          "floorSlopeMultiplier": 1.1
        }
      },
      "flags": ["gam_rows_excluded", "rej_above_interviewMin"]
    }
  ]
}
```

Set `portfolioSensitive: true` for **undf, unds, uow**.

---

## 6. Deliverables checklist

1. **Executive summary** (≤500 words): multi-cycle findings; what students should NOT infer from combo alone.
2. **Harmonization log:** how 2023 columns mapped; % rows with parsed-from-notes fields.
3. **Per-uni × cohort tables:** 2023, 2024, blended (bonus-free + full).
4. **UQ stream appendix:** GB vs RMP vs DD — which stream sets the practical floor.
5. **UoW appendix:** 1.28 cluster (2024) vs 1.43–1.54 (2023) vs 1.54+ tail.
6. **Melbourne / Deakin appendix:** GAM and bonus leakage audit.
7. **CASPer appendix:** % 4th-quartile rejections at undf/unds/uow.
8. **JSON patch** per section 5, passing quality gates G1–G7.
9. **Top 15 surprising rejections** (highest combo, both cycles) with full context.
10. **Student copy** (2 sentences/uni, no em dashes): "In 2023–2024 community data, non-rural applicants without bonuses were sometimes rejected with combos up to X at [Uni]."
11. **Calculator QA scenarios:** 10 synthetic inputs with expected band direction (higher combo → higher band); include one UoW portfolio disclaimer case.

---

## 7. Seed data (transcribed from screenshots — extend with CSV)

### 2024 sample rows

```csv
application_cycle,rurality,university_id,final_combo,gpa,gamsat,casper,deakin_bonus,anu_bonus,uow_bonus,notes,outlier
2024,Non-Rural,anu,1.68114,6.81,65.75,2nd,0,2,0,,false
2024,Non-Rural,deakin,1.71010,6.77,65.5,3rd,0,0,0,,false
2024,Non-Rural,deakin,1.65750,7.0,65.75,2nd,0,0,0,,false
2024,Non-Rural,melbourne,1.68286,6.6,75,2nd,0,0,0,GAM Yes,false
2024,Non-Rural,uow,1.28571,6.906,74.5,1st,0,0,3,,false
2024,Non-Rural,uow,1.64970,6.803,86.5,3rd,0,0,3,,false
2024,Rural,deakin,1.61416,6.848,57.75,1st,12,0,0,,false
```

### 2023 sample rows

```csv
application_cycle,rurality,university_id,university_stream,final_combo,gpa,gamsat,casper,deakin_bonus,anu_bonus,mq_bonus,notes,outlier
2023,Non-Rural,anu,,1.77736,6.91,75,3rd,0,2,0,,false
2023,Non-Rural,anu,,1.65928,6.559,66.5,2nd,0,2,0,,false
2023,Non-Rural,deakin,,1.84991,6.967,71.75,4th,8,0,0,4% financial disadvantage bonus,false
2023,Non-Rural,deakin,,1.79821,6.865,80.75,N/A,0,0,0,above average portfolio,false
2023,Non-Rural,deakin,,1.61756,6.6,67.5,3rd,0,0,0,below average portfolio,false
2023,Non-Rural,griffith,,1.73179,6.95,77.25,4th,0,0,0,,false
2023,Non-Rural,macquarie,,1.72229,7.0,70.25,3rd,0,0,3,B.Biomed graduate,false
2023,Non-Rural,macquarie,,1.64179,6.559,66.5,2nd,0,0,3,,false
2023,Non-Rural,melbourne,,1.78070,7.0,78,4th,0,0,0,GAM applicant,false
2023,Non-Rural,melbourne,,1.67000,7.0,73.33,2nd,0,0,0,,false
2023,Non-Rural,melbourne,,1.57944,6.95,57.33,3rd,0,0,0,GAM outlier skews data,true
2023,Non-Rural,undf,,1.63800,6.85,72,1st,0,0,0,below average portfolio,false
2023,Non-Rural,unds,,1.74287,7.0,85.67,2nd,0,0,0,strong portfolio,false
2023,Non-Rural,unds,,1.57173,5.476,80,4th,0,0,0,,false
2023,Non-Rural,uq,gb,1.73330,7.0,73.33,N/A,0,0,0,,false
2023,Non-Rural,uq,cq_wb_rmp,1.66670,7.0,66.67,N/A,0,0,0,,false
2023,Non-Rural,uwa,,1.73843,6.917,72.75,3rd,0,0,0,WA resident,false
2023,Non-Rural,uow,,1.54071,5.5,73,4th,0,0,0,decent portfolio,false
2023,Non-Rural,uow,,1.43071,5.5,64.5,3rd,0,0,0,below average portfolio,false
2023,Rural,melbourne,,1.71000,6.79,95,2nd,0,0,0,GAM mature aged,false
2023,Rural,uq,gb,1.77000,7.0,84,4th,0,0,0,Tier 2 rurality,false
2023,Rural,uow,,1.30000,5.5,52,2nd,0,0,0,strong portfolio NDIS,false
```

---

## 8. Robustness principles (non-negotiable)

- **Rejections bound cutoffs; interviews define competitiveness.** Never train p50/p90 on rejections.
- **Prefer conservative student messaging:** when uncertain, wider bands and lower confidence — not false precision.
- **Multi-cycle > single cycle** for `rej_max` / disclaimers.
- **Portfolio unis:** numeric calculator is indicative only; say so explicitly.
- **Never claim official cutoffs.** Attribute r/GAMSAT community data.
- **Human review** before changing any live `interviewMin` in production JSON.
- Round all **displayed %** to nearest 5%.
- No em dashes in student-facing strings.

---

## 9. Screenshot-only ingestion (primary workflow)

The source spreadsheet **cannot be exported**. All row-level data arrives via:

1. **`site/data/rejections-screenshot-seed.csv`** in the repo (cumulative transcription), and/or
2. **New PNG/JPEG screenshots** pasted into the chat (Claude vision reads cells directly).

### How to capture screenshots for maximum modeling value

| Practice | Why |
|----------|-----|
| One university block per shot (same background colour) | Easier to tag `university_id` |
| Include **column headers** and **row numbers** (Google Sheets row index) | Harmonization + deduplication |
| Capture **top 5–10 highest Final Combo** rows per uni × cohort | Defines `rej_max` / `rej_p99` |
| Capture **Notes** and **Outlier?** columns when present | Cleaning rules |
| Label each file: `2024-rejections-uow-nonrural-rows329-375.png` | Traceability |
| 2023 and 2024 workbooks are **separate** | Always set `application_cycle` |

### Per-batch instructions for Claude (vision)

When the user attaches screenshots:

1. Transcribe **every visible row** into canonical CSV columns (do not skip “boring” rows in view).
2. Append to the master seed CSV format; flag `transcription_confidence: high|medium` per row if cells are blurry.
3. Record `screenshot_id` and `sheet_row_start`–`sheet_row_end` in a transcription log.
4. Update per-uni `rej_max` / `n_visible` — use `n_visible` not full `n` until sheet is complete.
5. Mark coverage gaps in a **transcription checklist** (see Part E).

### Confidence tiers for calculator parameters

| Tier | Condition | How to use in JSON |
|------|-----------|-------------------|
| **High** | ≥15 bonus-free rows transcribed for uni×cohort×cycle, or clear high-combo rows photographed | May propose `interviewMin` adjustment with `confidence: medium` |
| **Medium** | 5–14 rows or strong max-only evidence from screenshots | `rejectionStats` + disclaimers only; no `interviewMin` change |
| **Low** | Range estimate only (no row transcription) | Part D table + `portfolioSensitive` flags only |

---

## 10. First response from you (Claude)

When this prompt is pasted, respond in order:

1. Confirm: rejection vs interview pools; 2023/2024 harmonization; **screenshot-only access (no CSV export)**.
2. Load `rejections-screenshot-seed.csv` if provided; process any attached screenshots and list new rows added.
3. Run cleaning pipeline dry-run; report `n_transcribed` per uni/cycle and **coverage %** vs Part E checklist.
4. Produce blended `rej_max` / `rej_p90` table with **confidence tier** per cell; compare to `interviewMin` in §4d.
5. Output JSON patch only for **high/medium confidence** unis; flag low-confidence unis for more screenshots.
6. Return an updated **transcription checklist** (what row ranges to screenshot next).

```

---

## Part C — Implementation hooks (for Rohan / dev)

| Step | Action |
|------|--------|
| 1 | Screenshot **Rejections** tab blocks (see Part E checklist); no export available |
| 2 | Run Claude with **Part B** + `site/data/rejections-screenshot-seed.csv` + new images; merge transcribed rows back into seed CSV |
| 3 | Review proposed `interviewMin` changes only where confidence ≥ medium (quality gates G1–G7) |
| 4 | Merge `rejectionStats` + `portfolioSensitive` into `gemsas-cutoffs.json` |
| 5 | Add portfolio disclaimer in `interview-calculator.html` for undf, unds, uow |
| 6 | Optional: `site/scripts/aggregate-rejections.js` reads seed CSV and recomputes stats locally |

### Repeatable Claude session (copy-paste opener)

```text
Read site/docs/gemsas-rejections-modeling-prompt.md Part B.
Data is screenshot-only (view-only sheet). Use site/data/rejections-screenshot-seed.csv
plus the attached screenshot(s). Transcribe visible rows, append to seed CSV format,
update rejection stats and checklist. Do not ask for CSV export.
```

---

## Part E — Transcription coverage checklist

Use this to track what still needs screenshots. Check off when seed CSV has ≥10 transcribed rows for that block (or max-combo rows captured).

### 2024 cycle (Rejections tab)

| Block | Sheet rows (approx) | University | Cohort | Status |
|-------|---------------------|------------|--------|--------|
| A | 2–37 | ANU | Non-rural | Partial (samples in seed) |
| B | 38–98 | Deakin | Non-rural | Partial |
| C | 94–141 | Griffith | Non-rural | Partial |
| D | 142–153 | Macquarie | Non-rural | Partial |
| E | 154–191 | Melbourne | Non-rural | Partial |
| F | 189–232 | Melbourne | Non-rural | Overlap with E — one pass |
| G | 233–281 | UNDF / UNDS | Non-rural | Partial |
| H | 286–307 | UNDS | Non-rural | Partial |
| I | 308–351 | UQ GB / RMP | Non-rural | Partial |
| J | 352–360 | UWA | Non-rural | Partial |
| K | 361–375 | UoW | Non-rural | Partial |
| L | 329–439 | UoW | Non-rural | **Priority** (1.28571 cluster) |
| M | 440–448 | Deakin, MQ, UQ, UWA | Rural | Partial |

### 2023 cycle (Rejections tab)

| Block | Sheet rows (approx) | University | Cohort | Status |
|-------|---------------------|------------|--------|--------|
| N | 2–48 | ANU, Deakin | Non-rural | Partial |
| O | 49–87 | Griffith, Macquarie | Non-rural | Partial |
| P | 88–178 | Melbourne | Non-rural | Partial (incl. outlier row) |
| Q | 179–215 | UNDF | Non-rural | Partial |
| R | 216–285 | UNDS | Non-rural | Needs more rows |
| S | 286–340 | UQ streams, UWA, UoW | Non-rural | Partial |
| T | (rural section) | All rural blocks | Rural | Partial (one full-colour screenshot) |

**Minimum viable for v1 calculator floor validation:** For each GEMSAS uni in `gemsas-cutoffs.json`, capture screenshots showing the **5–10 highest Final Combo rejections** per cohort (non-rural + rural), bonus columns visible.

### Suggested disclaimer copy (portfolio-sensitive)

> At [University], portfolio and personal qualities weigh heavily. A numeric score alone does not determine interview outcomes. Treat this estimate as rough guidance only.

---

## Part D — Quick reference: rejection ceilings (visual estimates, bonus-free where possible)

| Uni | 2023 rej max (est.) | 2024 rej max (est.) | Current interviewMin (nonRural) | Action |
|-----|---------------------|---------------------|----------------------------------|--------|
| ANU | 1.78 (with bonus rows lower) | 1.72 | 1.6917 | Review bonus-free p99 |
| Deakin | 1.80+ (bonus) / ~1.72 base | 1.71 | 1.6575 | Strict bonus-free filter |
| Griffith | 1.73 | 1.66 | 1.6322 | Align |
| Macquarie | 1.72 | 1.62 | 1.5658 | 2023 > min — review |
| Melbourne | **1.78** | 1.68 | 1.5908 | **High priority** GAM exclusion |
| UQ (GB) | **1.73** | 1.67 | 1.6199 | Stream-aware |
| UWA | **1.74** | 1.63 | 1.6243 | 2023 higher — review |
| UNDF | 1.68 | 1.65 | 1.5219 | Portfolio flag |
| UNDS | **1.74** | 1.59 | 1.4803 | Portfolio flag |
| UoW | 1.54 (2023) / 1.29* (2024) | bimodal | 1.4008 | Segment + disclaimer |

\*2024 UoW 1.28571 cluster — exclude from blended max unless formula validated.

---

*Last updated: 2026-05-30 — screenshot-only workflow; 2024 + 2023 Rejections tab analysis.*
