# Interview Chances Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free on-site calculator that turns a student's GAMSAT, GPA, and CASPer quartile into a rough (5%-banded) interview-chance estimate per GEMSAS university, behind a soft email gate.

**Architecture:** Static page (`interview-calculator.html`) + page CSS + a browser IIFE (`js/interview-calculator.js`) that exposes pure calculation functions on `window.InterviewCalc` for testability. All historical cutoffs and per-uni weighting formulas live in `data/gemsas-cutoffs.json`, fetched at runtime. No backend; email capture reuses `js/free-resource-form.js`. GEMSAS unis only; USyd deferred.

**Tech Stack:** Vanilla HTML/CSS/JS, `fetch` for JSON, `node:test` + `node:assert/strict` + `vm` for tests (matching existing suite).

**Spec:** `docs/superpowers/specs/2026-05-30-interview-chances-calculator-design.md`

---

## File Structure

- Create `data/gemsas-cutoffs.json` — extracted per-uni cutoffs (interview/offer min + offer mean, rural + non-rural, across cycles), per-uni weighting formula inputs, CASPer config. Single source of truth for data.
- Create `js/interview-calculator.js` — browser IIFE. Pure math on `window.InterviewCalc` (`computeComboScore`, `mapToBand`, `applyCasper`, `rankUniversities`); plus DOM wiring (form read, render, soft gate) guarded so it no-ops without the page.
- Create `css/interview-calculator.css` — page-specific styling layer (form, results table, gated section, disclaimer).
- Create `interview-calculator.html` — page shell: nav, form, results region, soft-gate form, footer, attribution + disclaimer.
- Create `tests/interview-calculator.test.js` — unit tests for the pure functions + JSON schema/shape validation.
- Modify `sitemap.xml` — add the new URL.
- Modify `tests/free-resource-pages.test.js` OR `tests/repo-hygiene.test.js` — only if those tests enumerate tool pages (verify during Task 6; otherwise add coverage in the new test file).

---

## Task 1: Extract historical data into `data/gemsas-cutoffs.json`

This task is interactive (the source sheets are export-locked; extraction is visual) and produces the data file the rest of the plan depends on. It is gated by a schema test so "done" is objective.

**Files:**
- Create: `data/gemsas-cutoffs.json`
- Test: `tests/interview-calculator.test.js` (schema portion)

- [ ] **Step 1: Write the failing schema test**

Create `tests/interview-calculator.test.js`:

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/gemsas-cutoffs.json'), 'utf8'));

test('cutoffs data: top-level shape', () => {
  assert.equal(typeof data.source, 'string');
  assert.ok(Array.isArray(data.cycles) && data.cycles.length >= 1);
  assert.ok(Array.isArray(data.universities) && data.universities.length >= 1);
});

test('cutoffs data: each university is well-formed', () => {
  for (const uni of data.universities) {
    assert.equal(typeof uni.id, 'string', 'uni.id string');
    assert.equal(typeof uni.name, 'string', 'uni.name string');
    assert.equal(typeof uni.usesCasper, 'boolean', uni.id + '.usesCasper boolean');
    assert.equal(typeof uni.weighting, 'object', uni.id + '.weighting object');
    for (const cohort of ['nonRural', 'rural']) {
      const c = uni.cutoffs[cohort];
      assert.ok(c, uni.id + '.cutoffs.' + cohort + ' present');
      for (const k of ['interviewMin', 'offerMin', 'offerMean']) {
        assert.equal(typeof c[k], 'number', uni.id + '.' + cohort + '.' + k + ' number');
        assert.ok(c[k] > 0 && c[k] < 7.1, uni.id + '.' + cohort + '.' + k + ' in range');
      }
      assert.ok(c.interviewMin <= c.offerMean, uni.id + '.' + cohort + ' interviewMin<=offerMean');
    }
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: FAIL — cannot read `data/gemsas-cutoffs.json` (file does not exist).

- [ ] **Step 3: Get the per-uni weighting formulas from Rohan**

Ask Rohan to point to the GEMSAS weighting formulas (the sheet tab/doc he referenced). Record, per uni: GPA weight, GAMSAT weight, GAMSAT section weighting (e.g. S3 double-weighted), the GPA scale used, and any normalisation so the computed score lands on the same ~1.4–1.7 "combo" scale as the cutoffs. Do not guess — if a uni's formula is unavailable, flag it and leave that uni out of v1 rather than approximate.

- [ ] **Step 4: Extract cutoffs from the 6 workbooks (visual)**

For each cycle workbook (the 6 URLs Rohan provided), open the `Statistics (Non-Rural)` and `Statistics (Rural)` tabs (and `Statistics (vs Interviews)` for interview minimums). Screenshot and transcribe, per uni: `interviewMin`, `offerMin`, `offerMean`, for both cohorts. Record per-cycle values so they can be trended. Use the claude-in-chrome MCP: navigate the automation tab to each workbook URL, dismiss the "Security limitations" popup, click the relevant bottom tab, screenshot, transcribe. Cross-check transcribed numbers against the screenshot before saving.

- [ ] **Step 5: Write `data/gemsas-cutoffs.json`**

Populate the file. Per-cycle cutoffs stored as arrays; the calc module averages them (Task 2). Shape (values illustrative — use real extracted numbers):

```json
{
  "source": "r/GAMSAT GEMSAS offer data (compiled by Luke)",
  "attribution": "Data compiled by the r/GAMSAT community",
  "cycles": ["2020", "2021", "2022", "2023", "2024", "2025"],
  "casper": { "gatedQuartileBelow": 2, "penaltyBands": 1 },
  "universities": [
    {
      "id": "uq",
      "name": "University of Queensland",
      "usesCasper": true,
      "weighting": { "gpa": 0.5, "gamsat": 0.5, "sectionWeights": [1, 1, 2], "gpaScale": 7 },
      "cutoffs": {
        "nonRural": { "interviewMin": 1.60, "offerMin": 1.66, "offerMean": 1.72 },
        "rural": { "interviewMin": 1.50, "offerMin": 1.55, "offerMean": 1.63 }
      }
    }
  ]
}
```

- [ ] **Step 6: Run the schema test to verify it passes**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: PASS (both schema tests green).

- [ ] **Step 7: Commit**

```bash
cd site
git add data/gemsas-cutoffs.json tests/interview-calculator.test.js
git commit -m "feat: add GEMSAS cutoffs dataset + schema test for interview calculator"
```

---

## Task 2: Pure calculation module (`js/interview-calculator.js`)

Builds the math as pure functions on `window.InterviewCalc`, testable via `vm` like other scripts in the repo. No DOM yet.

**Files:**
- Create: `js/interview-calculator.js`
- Test: `tests/interview-calculator.test.js` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/interview-calculator.test.js`:

```javascript
const vm = require('node:vm');

function loadCalc() {
  const code = fs.readFileSync(path.join(ROOT, 'js/interview-calculator.js'), 'utf8');
  const sandbox = { window: {}, document: { addEventListener() {} } };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.InterviewCalc;
}

test('computeComboScore: applies gpa/gamsat split and section weights', () => {
  const calc = loadCalc();
  const weighting = { gpa: 0.5, gamsat: 0.5, sectionWeights: [1, 1, 2], gpaScale: 7 };
  // gpa 6.5/7; gamsat sections 70,70,80 -> weighted mean = (70+70+160)/4 = 75
  const score = calc.computeComboScore({ gpa: 6.5, sections: [70, 70, 80] }, weighting);
  assert.equal(typeof score, 'number');
  assert.ok(score > 0);
});

test('mapToBand: rounds to nearest 5 and respects anchors', () => {
  const calc = loadCalc();
  const cutoffs = { interviewMin: 1.5, offerMin: 1.6, offerMean: 1.7 };
  assert.ok(calc.mapToBand(1.3, cutoffs) <= 15); // below interview min -> low
  assert.equal(calc.mapToBand(1.7, cutoffs), 50); // at offer mean -> 50
  assert.ok(calc.mapToBand(2.0, cutoffs) >= 80); // well above -> high
  const band = calc.mapToBand(1.62, cutoffs);
  assert.equal(band % 5, 0, 'rounded to nearest 5');
});

test('applyCasper: only penalises uni that uses casper, never below floor', () => {
  const calc = loadCalc();
  assert.equal(calc.applyCasper(60, { usesCasper: false }, 1), 60); // ignored
  assert.ok(calc.applyCasper(60, { usesCasper: true }, 1) <= 60); // gated quartile penalised
  assert.ok(calc.applyCasper(10, { usesCasper: true }, 1) >= 0); // never negative
});

test('rankUniversities: returns sorted bands per uni', () => {
  const calc = loadCalc();
  const result = calc.rankUniversities(
    { gpa: 6.5, sections: [70, 70, 80], casperQuartile: 4, rural: false },
    data
  );
  assert.ok(Array.isArray(result));
  assert.ok(result.length >= 1);
  for (const r of result) {
    assert.equal(typeof r.name, 'string');
    assert.equal(typeof r.band, 'number');
    assert.equal(r.band % 5, 0);
  }
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].band >= result[i].band, 'sorted descending');
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: FAIL — `js/interview-calculator.js` not found / `InterviewCalc` undefined.

- [ ] **Step 3: Write the minimal implementation**

Create `js/interview-calculator.js`:

```javascript
/* ============================================
   INTERVIEW CHANCES CALCULATOR: interview-calculator.js
   Pure math on window.InterviewCalc + DOM wiring (guarded)
   ============================================ */
(function () {
  'use strict';

  function round5(n) {
    return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
  }

  // Weighted GAMSAT section mean, then 50/50 (or per-uni) blend with GPA,
  // scaled onto the dataset's combo scale.
  function computeComboScore(input, weighting) {
    var sw = weighting.sectionWeights || [1, 1, 1];
    var swSum = sw[0] + sw[1] + sw[2];
    var gamsat = (input.sections[0] * sw[0] + input.sections[1] * sw[1] + input.sections[2] * sw[2]) / swSum;
    var gpaScale = weighting.gpaScale || 7;
    // Normalise both to 0..1, blend, then express on the dataset scale (max == gpaScale-ish).
    var gpaNorm = input.gpa / gpaScale;       // 0..1
    var gamsatNorm = gamsat / 100;            // 0..1 (GAMSAT section scores are ~0..100)
    var blend = weighting.gpa * gpaNorm + weighting.gamsat * gamsatNorm;
    return blend * gpaScale;                  // back onto ~combo scale
  }

  // Piecewise-linear: interviewMin -> 15, offerMean -> 50, +0.15 above mean -> 95.
  function mapToBand(score, cutoffs) {
    var low = cutoffs.interviewMin;
    var mid = cutoffs.offerMean;
    var hi = mid + 0.15;
    var pct;
    if (score <= low) {
      pct = Math.max(5, 15 - (low - score) * 100);
    } else if (score <= mid) {
      pct = 15 + ((score - low) / (mid - low)) * (50 - 15);
    } else if (score <= hi) {
      pct = 50 + ((score - mid) / (hi - mid)) * (95 - 50);
    } else {
      pct = 95;
    }
    return round5(pct);
  }

  // CASPer gate: only for usesCasper unis. penaltyBands is in 5% units.
  function applyCasper(band, uni, casperPenaltyBands) {
    if (!uni.usesCasper) return band;
    return round5(Math.max(0, band - casperPenaltyBands * 5));
  }

  function rankUniversities(input, data) {
    var cohort = input.rural ? 'rural' : 'nonRural';
    var casperGateBelow = (data.casper && data.casper.gatedQuartileBelow) || 2;
    var penaltyBands = (data.casper && data.casper.penaltyBands) || 1;
    var out = data.universities.map(function (uni) {
      var score = computeComboScore(input, uni.weighting);
      var band = mapToBand(score, uni.cutoffs[cohort]);
      var penalty = (input.casperQuartile && input.casperQuartile < casperGateBelow) ? penaltyBands : 0;
      band = applyCasper(band, uni, penalty);
      return { id: uni.id, name: uni.name, band: band, usesCasper: uni.usesCasper };
    });
    out.sort(function (a, b) { return b.band - a.band; });
    return out;
  }

  window.InterviewCalc = {
    round5: round5,
    computeComboScore: computeComboScore,
    mapToBand: mapToBand,
    applyCasper: applyCasper,
    rankUniversities: rankUniversities
  };

  // DOM wiring added in Task 4 (guarded so this file stays test-loadable).
})();
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: PASS (all Task 1 + Task 2 tests green).

- [ ] **Step 5: Commit**

```bash
cd site
git add js/interview-calculator.js tests/interview-calculator.test.js
git commit -m "feat: add interview calculator pure math module + unit tests"
```

---

## Task 3: Page shell + CSS

Build the static page matching existing tool pages (head order, nav, footer), with form, results region, soft-gate container, attribution, and disclaimer. No new behaviour beyond Task 2/4.

**Files:**
- Create: `interview-calculator.html`
- Create: `css/interview-calculator.css`
- Test: `tests/interview-calculator.test.js` (append page-presence assertions)

- [ ] **Step 1: Write the failing page test**

Append to `tests/interview-calculator.test.js`:

```javascript
test('page exists with required structure', () => {
  const html = fs.readFileSync(path.join(ROOT, 'interview-calculator.html'), 'utf8');
  assert.match(html, /css\/style\.css/, 'loads base stylesheet');
  assert.match(html, /css\/interview-calculator\.css/, 'loads page stylesheet');
  assert.match(html, /js\/interview-calculator\.js/, 'loads calculator script');
  assert.match(html, /id="ic-form"/, 'has the input form');
  assert.match(html, /id="ic-results"/, 'has results region');
  assert.match(html, /name="gamsat-s1"|id="ic-gamsat-s1"/, 'has gamsat section input');
  assert.match(html, /rural/i, 'has rural toggle');
  assert.match(html, /r\/GAMSAT|community/i, 'shows attribution');
  assert.match(html, /estimate|not advice|guidance only/i, 'shows disclaimer');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: FAIL — `interview-calculator.html` not found.

- [ ] **Step 3: Build the page**

Create `interview-calculator.html` copying the exact `<head>` script/preconnect/font order and nav/footer markup from `quote-generator.html` (consent.js, analytics.js, posthog-init.js, fonts, favicons, `css/style.css`, then `css/interview-calculator.css`). Set title/meta/canonical for `/interview-calculator`. Body contains:
- `<form id="ic-form">` with: three GAMSAT section number inputs (`id="ic-gamsat-s1"`, `-s2`, `-s3`), optional GAMSAT overall (display), GPA number input (`id="ic-gpa"`, 0–7 step 0.01), CASPer quartile `<select id="ic-casper">` (1–4 + "not sat"), rural/non-rural toggle (`<input type="checkbox" id="ic-rural">` or radio pair), and a submit button.
- `<section id="ic-results" hidden>` — headline result region (always shown after calculate) and a `<div id="ic-results-full" hidden>` for the gated full ranked table.
- Soft-gate form block reusing the `free-resource-form.js` markup/classes (copy the form structure from an existing tool, e.g. `section-1-tracker.html`), configured for this resource.
- A disclaimer paragraph (rough estimate, guidance only, not admissions advice) and r/GAMSAT attribution line.

Create `css/interview-calculator.css` using existing tokens from `css/style.css` (colours, spacing, radius). Style: form grid, results table (uni name + band %), gated-section blur/lock state, disclaimer muted style. Follow BEM-like `interview-calc__*` naming.

- [ ] **Step 4: Run to verify it passes**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: PASS (page-presence test green).

- [ ] **Step 5: Visual check**

Run: `cd site && python3 -m http.server 8000` and open `http://localhost:8000/interview-calculator.html`. Confirm nav, form, footer render and the page is mobile-clean. Stop the server.

- [ ] **Step 6: Commit**

```bash
cd site
git add interview-calculator.html css/interview-calculator.css tests/interview-calculator.test.js
git commit -m "feat: add interview calculator page shell + styles"
```

---

## Task 4: Wire form -> calc -> render + soft gate

Connect the DOM to `InterviewCalc`: read inputs, fetch the JSON, compute, render the headline immediately, gate the full breakdown behind the email form.

**Files:**
- Modify: `js/interview-calculator.js` (add guarded DOM wiring after the IIFE math block)
- Modify: `interview-calculator.html` (only if wiring needs hooks/ids)
- Test: `tests/interview-calculator.test.js` (append a render-helper unit test)

- [ ] **Step 1: Write the failing test for the render helper**

Append to `tests/interview-calculator.test.js`:

```javascript
test('renderHeadline returns best uni summary string', () => {
  const calc = loadCalc();
  const ranked = [
    { id: 'uq', name: 'University of Queensland', band: 65 },
    { id: 'deakin', name: 'Deakin University', band: 40 }
  ];
  const headline = calc.renderHeadline(ranked);
  assert.match(headline, /University of Queensland/);
  assert.match(headline, /65/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: FAIL — `calc.renderHeadline is not a function`.

- [ ] **Step 3: Add `renderHeadline` to the math module and the DOM wiring**

In `js/interview-calculator.js`, add `renderHeadline` to the exported object:

```javascript
  function renderHeadline(ranked) {
    if (!ranked || !ranked.length) return 'Enter your scores to see your estimate.';
    var top = ranked[0];
    return 'Your strongest interview chance is ' + top.name + ' at about ' + top.band + '%.';
  }
```

Add `renderHeadline: renderHeadline` to the `window.InterviewCalc` object.

Then, after the `window.InterviewCalc` assignment but inside the IIFE, add guarded DOM wiring:

```javascript
  if (typeof document !== 'undefined' && document.getElementById) {
    document.addEventListener('DOMContentLoaded', function () {
      var form = document.getElementById('ic-form');
      if (!form) return;
      var results = document.getElementById('ic-results');
      var fullBox = document.getElementById('ic-results-full');
      var dataPromise = fetch('/data/gemsas-cutoffs.json').then(function (r) { return r.json(); });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        dataPromise.then(function (data) {
          var input = {
            gpa: parseFloat(document.getElementById('ic-gpa').value),
            sections: [
              parseFloat(document.getElementById('ic-gamsat-s1').value),
              parseFloat(document.getElementById('ic-gamsat-s2').value),
              parseFloat(document.getElementById('ic-gamsat-s3').value)
            ],
            casperQuartile: parseInt(document.getElementById('ic-casper').value, 10) || null,
            rural: !!(document.getElementById('ic-rural') && document.getElementById('ic-rural').checked)
          };
          var ranked = window.InterviewCalc.rankUniversities(input, data);
          results.hidden = false;
          var headlineEl = document.getElementById('ic-headline');
          if (headlineEl) headlineEl.textContent = window.InterviewCalc.renderHeadline(ranked);
          if (fullBox) {
            fullBox.innerHTML = ranked.map(function (r) {
              return '<tr><td>' + r.name + '</td><td>' + r.band + '%</td></tr>';
            }).join('');
          }
        });
      });
    });
  }
```

The full table stays hidden until the soft-gate email form fires its success state (handled by `free-resource-form.js`, which reveals `#ic-results-full` on success — confirm the success hook/class wiring in Task 5).

- [ ] **Step 4: Run to verify it passes**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd site
git add js/interview-calculator.js interview-calculator.html tests/interview-calculator.test.js
git commit -m "feat: wire interview calculator form, calculation, and render"
```

---

## Task 5: Soft email gate

Reveal the full ranked breakdown only after email capture, reusing the existing `free-resource-form.js` flow.

**Files:**
- Modify: `interview-calculator.html` (gate form config + reveal target)
- Modify: `js/interview-calculator.js` (reveal `#ic-results-full` on gate success)
- Test: `tests/interview-calculator.test.js` (append gate-presence assertion)

- [ ] **Step 1: Write the failing test**

Append:

```javascript
test('page has email soft-gate wired to free-resource-form', () => {
  const html = fs.readFileSync(path.join(ROOT, 'interview-calculator.html'), 'utf8');
  assert.match(html, /free-resource-form\.js/, 'loads the lead form script');
  assert.match(html, /id="ic-results-full"/, 'has the gated full-results container');
  assert.match(html, /data-free-resource|formkit|tracker-form/i, 'uses the lead form markup hooks');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: FAIL until markup/script added.

- [ ] **Step 3: Implement the gate**

Inspect `js/free-resource-form.js` and an existing consumer (`section-1-tracker.html`) to copy the exact form attributes/classes and success hook. Add the `<script src="/js/free-resource-form.js" defer></script>` include and the gate form to `interview-calculator.html`, configured with this tool's resource name. Ensure the gate form's success state reveals `#ic-results-full` — either via the script's existing success callback/class, or by adding a small listener in `js/interview-calculator.js` that unhides `#ic-results-full` when the gate form gains `data-state="success"`. Show the headline ungated; show the full table only post-success.

- [ ] **Step 4: Run to verify it passes**

Run: `cd site && node --test tests/interview-calculator.test.js`
Expected: PASS.

- [ ] **Step 5: Manual flow check**

Serve locally, submit scores -> headline appears; submit email -> full ranked table reveals. Confirm no console errors.

- [ ] **Step 6: Commit**

```bash
cd site
git add interview-calculator.html js/interview-calculator.js tests/interview-calculator.test.js
git commit -m "feat: gate full interview-chance breakdown behind email capture"
```

---

## Task 6: Integrate into site (nav, sitemap, hygiene)

Make the page discoverable and pass the repo's existing hygiene/page tests.

**Files:**
- Modify: `interview-calculator.html` + other tool pages' nav "Free Resources" dropdown (add link)
- Modify: `sitemap.xml`
- Modify: existing test(s) only if they enumerate tool pages (verify)

- [ ] **Step 1: Check whether existing tests enumerate tool pages**

Run: `cd site && node --test tests/free-resource-pages.test.js tests/repo-hygiene.test.js`
Read those test files. If they assert a fixed list of tool pages / nav links / sitemap entries, note exactly what they expect.

- [ ] **Step 2: Add the page to navigation**

Add an `<a href="/interview-calculator">Interview Chances Calculator</a>` entry to the "Free Resources" dropdown in the shared nav markup wherever other tools are listed (match the existing dropdown items in `quote-generator.html`/`section-1-tracker.html`). Keep markup identical across pages.

- [ ] **Step 3: Add to `sitemap.xml`**

Add a `<url>` entry for `https://www.rohanstutoring.com/interview-calculator` matching the format of other tool URLs in the file.

- [ ] **Step 4: Run the full suite**

Run: `cd site && npm test`
Expected: PASS. Fix any hygiene-test expectations that legitimately need the new page registered (e.g. add the page to an allowed-pages list). Do not weaken unrelated assertions.

- [ ] **Step 5: Run redirect + price audits (sanity)**

Run: `cd site && npm run audit:redirects -- redirect-audit.launch.csv --origin=https://www.rohanstutoring.com && npm run audit:prices`
Expected: no new failures attributable to this change.

- [ ] **Step 6: Commit**

```bash
cd site
git add interview-calculator.html sitemap.xml
git commit -m "feat: surface interview calculator in nav + sitemap"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test pass**

Run: `cd site && npm test`
Expected: all tests pass.

- [ ] **Step 2: Manual end-to-end**

Serve locally; verify on desktop + mobile widths: form usability, headline appears on calculate, email gate reveals full table, disclaimer + attribution visible, no console errors.

- [ ] **Step 3: Confirm `vercel.json` needs no change**

The page is a static file at the root, served at `/interview-calculator` like other tool pages. Confirm no redirect entry is required (match how `/quote-generator` is handled). Only edit `vercel.json` if other tool pages have an explicit clean-URL entry that this page also needs.

- [ ] **Step 4: Final commit (if any residual changes)**

```bash
cd site
git add -A
git commit -m "chore: finalise interview chances calculator"
```

---

## Notes / risks carried from the spec

- Combo-score scaling (Task 2) must match the dataset's scale; validate a couple of known students/score pairs against the sheets during Task 1–2 and tune `computeComboScore` normalisation if the bands look off.
- CASPer gating config (`gatedQuartileBelow`, `penaltyBands`) is a rough first pass; refine once CASPer cutoff data is available.
- USyd and any non-GEMSAS metric are explicitly out of scope for v1.
