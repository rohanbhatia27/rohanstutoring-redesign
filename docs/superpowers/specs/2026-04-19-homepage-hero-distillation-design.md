# Homepage Hero Distillation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the homepage hero so cold visitors can understand the live offer, trust the tutor, and choose a CTA in one fast scan.

**Architecture:** Keep the existing homepage structure and brand system, but strip the hero back to a tighter reading flow: slim urgency line, decisive headline, single support sentence, compact two-point proof row, then two CTAs. Implement this by editing only the homepage hero markup in `index.html`, replacing the hero-specific CSS treatment in `css/style.css`, and deleting the no-longer-needed hero stat counter logic from `js/main.js`.

**Tech Stack:** Static HTML, shared CSS, vanilla JavaScript, local manual verification via `python3 -m http.server`

---

## File Structure

- Modify: `site/index.html`
  Purpose: Replace the current hero announcement card, headline, support copy, CTA labels, three-stat strip, floating credential card, and scroll indicator with the approved distilled structure.
- Modify: `site/css/style.css`
  Purpose: Rework the hero presentation from layered card/stat-strip styling into a calmer editorial masthead with a restrained proof row and lighter atmosphere.
- Modify: `site/js/main.js`
  Purpose: Remove the hero counter animation code that only exists for the outgoing stat-strip implementation.

## Constraints To Preserve

- Keep the hero left-weighted.
- Keep the navy editorial frame and existing typography system.
- Keep live-enrolment urgency visible above the fold.
- Keep both CTAs, with `See the Courses` visually dominant over `Join This Week's Free GAMSAT Webinar`.
- Keep Rohan's image only as restrained atmosphere, not a competing focal point.
- Do not broaden scope into deeper homepage sections, redirects, metadata, or a larger redesign.

## Manual Verification Setup

- [ ] **Step 1: Confirm working tree context before edits**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
git status --short
```

Expected: Existing unrelated changes may already be present in `index.html`, `css/style.css`, and `js/main.js`; do not revert them.

- [ ] **Step 2: Start a local preview server for visual checks**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
python3 -m http.server 8000
```

Expected: Local preview available at `http://127.0.0.1:8000/`.

### Task 1: Replace The Hero Markup With The Approved Reading Flow

**Files:**
- Modify: `site/index.html`
- Verify: `site/index.html`

- [ ] **Step 1: Replace the current linked announcement card with a slim text-first enrolment line**

Replace the current card-style block around lines 198-205 with a lighter structure that still links to the relevant course:

```html
<a href="/courses/comprehensive" class="hero__urgency reveal">
  <span class="hero__urgency-dot" aria-hidden="true"></span>
  <span class="hero__urgency-text">September 2026 enrolments now live</span>
</a>
```

- [ ] **Step 2: Replace the current two-line headline with the approved headline**

Replace the current `h1` block around lines 207-210 with:

```html
<h1 class="hero__headline reveal reveal--delay-1">
  Stop guessing. Start getting in.
</h1>
```

- [ ] **Step 3: Replace the support copy with the approved single-sentence trust line**

Replace the current paragraph around lines 212-214 with:

```html
<p class="hero__sub reveal reveal--delay-2">
  GAMSAT tutoring shaped by a top 1% scorer, trusted by 1,300+ future doctors across Australia, the UK, and Ireland.
</p>
```

- [ ] **Step 4: Update CTA labels to the approved hierarchy**

Replace the current CTA block around lines 216-219 with:

```html
<div class="hero__ctas reveal reveal--delay-4">
  <a href="#courses" class="btn btn--primary btn--lg">See the Courses</a>
  <a href="/webinar" class="btn btn--ghost btn--lg">Join This Week's Free GAMSAT Webinar</a>
</div>
```

- [ ] **Step 5: Replace the three-stat strip with a compact two-item proof row**

Replace the current `hero__stats` block around lines 221-243 with:

```html
<div class="hero__proof reveal reveal--delay-3" aria-label="Hero proof points">
  <span class="hero__proof-item">1,300+ students coached</span>
  <span class="hero__proof-separator" aria-hidden="true"></span>
  <span class="hero__proof-item">Top 1% scorer</span>
</div>
```

- [ ] **Step 6: Remove the floating credential card and scroll indicator from the hero**

Delete these now-obsolete blocks entirely:

```html
<div class="hero__cred-card reveal reveal--delay-3">...</div>
<div class="hero__scroll">...</div>
```

Expected result: The hero now reads top-to-bottom as urgency, headline, support line, proof row, and CTAs, with no floating accessory UI.

- [ ] **Step 7: Verify the hero markup hierarchy**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
sed -n '155,245p' index.html
```

Expected: No `hero__announcement`, `hero__stats`, `hero__cred-card`, or `hero__scroll` markup remains inside the hero section.

- [ ] **Step 8: Commit the markup slice**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
git add index.html
git commit -m "refactor: distill homepage hero markup"
```

### Task 2: Restyle The Hero As A Calmer Editorial Masthead

**Files:**
- Modify: `site/css/style.css`
- Verify: `site/css/style.css`

- [ ] **Step 1: Replace the announcement-card styles with slim urgency-link styles**

Delete the outgoing `.hero__announcement`, `.hero__announcement-kicker`, `.hero__announcement-title`, `.hero__announcement-meta`, `.hero__badge-dot`, and `@keyframes pulse` rules and replace them with:

```css
.hero__urgency {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 22px;
  color: var(--text-light);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  transition: color var(--transition), opacity var(--transition);
}
.hero__urgency:hover,
.hero__urgency:focus-visible {
  color: var(--white);
}
.hero__urgency-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 6px rgba(16, 191, 122, 0.12);
  flex-shrink: 0;
}
.hero__urgency-text {
  overflow-wrap: anywhere;
}
```

- [ ] **Step 2: Tighten the hero content column and spacing**

Update the hero layout rules so the text column reads more intentionally and leaves more breathing room:

```css
.hero__inner {
  position: relative;
  z-index: 3;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: calc(66px + 72px) 24px 96px;
}

.hero__content {
  max-width: min(500px, 46vw);
}

.hero__headline {
  max-width: 11ch;
  margin-bottom: 20px;
  color: var(--white);
  line-height: 0.98;
}

.hero__sub {
  max-width: 34rem;
  margin-bottom: 28px;
  font-size: 1.08rem;
  line-height: 1.7;
  color: var(--text-light);
}
```

- [ ] **Step 3: Replace the stat-strip styling with a compact inline proof row**

Delete the outgoing `.hero__stats`, `.hero__stat`, `.hero__stat-row`, `.hero__stat-num`, `.hero__stat-suffix`, `.hero__stat-label`, and `.hero__stat-divider` rules and add:

```css
.hero__proof {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 34px;
  color: var(--off-white);
}

.hero__proof-item {
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.hero__proof-separator {
  width: 18px;
  height: 1px;
  background: rgba(255, 255, 255, 0.28);
}
```

- [ ] **Step 4: Remove no-longer-used credential-card and scroll-indicator styles**

Delete these rule groups entirely:

```css
.hero__cred-card { ... }
.hero__cred-avatar { ... }
.hero__cred-info { ... }
.hero__cred-info strong { ... }
.hero__cred-info span { ... }
.hero__cred-badge { ... }
.hero__scroll { ... }
.hero__scroll-line { ... }
.hero__scroll-line::after { ... }
@keyframes scanLine { ... }
```

- [ ] **Step 5: Reduce decorative intensity so the image reads as atmosphere only**

Tone down the hero background and photo treatment:

```css
.hero__shader {
  opacity: 0.48;
  background:
    radial-gradient(circle at 76% 18%, rgba(91, 164, 224, 0.26) 0%, rgba(91, 164, 224, 0) 30%),
    radial-gradient(circle at 24% 30%, rgba(22, 119, 190, 0.12) 0%, rgba(22, 119, 190, 0) 36%),
    linear-gradient(135deg, rgba(8, 15, 26, 0) 0%, rgba(8, 15, 26, 0.16) 100%);
}

.hero__shader::after {
  opacity: 0.55;
}

.hero__photo {
  filter: brightness(0.96) contrast(1);
  opacity: 0.72;
}

.hero__photo-fade {
  background: linear-gradient(
    to right,
    rgba(8, 15, 26, 0.92) 0%,
    rgba(8, 15, 26, 0.7) 28%,
    rgba(8, 15, 26, 0.2) 56%,
    transparent 80%
  );
}
```

- [ ] **Step 6: Update responsive hero rules for the new simplified structure**

Replace the mobile rules that reference the outgoing announcement card, stat grid, credential card, and scroll indicator with:

```css
@media (max-width: 1100px) {
  .hero__content { max-width: 460px; }
}

@media (max-width: 960px) {
  .hero__photo-col { width: 48%; }
  .hero__content { max-width: 430px; }
}

@media (max-width: 860px) {
  .hero {
    min-height: auto;
  }

  .hero__inner {
    padding-top: calc(var(--header-height) + 48px);
    padding-bottom: 64px;
  }

  .hero__content { max-width: 100%; }
  .hero__photo-col { display: none; }
  .hero__shader { opacity: 0.38; }
  .hero__urgency {
    margin-bottom: 18px;
    font-size: 0.76rem;
  }
  .hero__headline {
    max-width: 10ch;
    margin-bottom: 18px;
  }
  .hero__sub {
    font-size: 1rem;
    margin-bottom: 24px;
  }
  .hero__proof {
    gap: 10px;
    margin-bottom: 28px;
  }
  .hero__ctas {
    gap: 12px;
    margin-bottom: 0;
  }
}

@media (max-width: 480px) {
  .hero__inner {
    padding-left: 20px;
    padding-right: 20px;
    padding-top: calc(var(--header-height) + 36px);
    padding-bottom: 52px;
  }

  .hero__proof {
    align-items: flex-start;
  }

  .hero__proof-separator {
    display: none;
  }

  .hero__proof-item {
    width: 100%;
  }
}
```

- [ ] **Step 7: Verify the stylesheet no longer contains obsolete hero patterns**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
rg -n "hero__announcement|hero__stats|hero__cred-card|hero__scroll|hero__stat-num|scanLine|pulse" css/style.css
```

Expected: No matches.

- [ ] **Step 8: Commit the styling slice**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
git add css/style.css
git commit -m "refactor: restyle homepage hero for trust-first hierarchy"
```

### Task 3: Remove Obsolete Hero Counter Logic And Verify The Full Flow

**Files:**
- Modify: `site/js/main.js`
- Verify: `site/index.html`
- Verify: `site/css/style.css`
- Verify: `site/js/main.js`

- [ ] **Step 1: Delete the hero counter observer and animation helper**

Remove the entire block below from `site/js/main.js`:

```js
/* ---- Counter animation (hero stats) ---- */
const counters = document.querySelectorAll('.hero__stat-num');
if (prefersReducedMotion) {
  counters.forEach((el) => {
    const target = parseInt(el.dataset.count || '0', 10);
    el.textContent = target.toLocaleString();
    el.dataset.animated = '1';
  });
} else {
  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = '1';
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach((el) => counterObserver.observe(el));
}

function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const duration = 1800;
  const startTime = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  const tick = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.round(easeOut(progress) * target);
    el.textContent = value.toLocaleString();
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
```

- [ ] **Step 2: Verify the JS no longer references the removed hero stat implementation**

Run:

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
rg -n "hero__stat-num|animateCounter|data-count" js/main.js index.html
```

Expected: No matches.

- [ ] **Step 3: Run a visual verification pass on desktop and mobile widths**

Check the homepage at `http://127.0.0.1:8000/` and confirm:

```text
Desktop:
- The urgency line reads as a slim notice, not a card
- The headline is the clear focal point
- The support line and proof row sit in one calm reading flow
- The proof row contains only "1,300+ students coached" and "Top 1% scorer"
- The webinar CTA is visibly secondary to "See the Courses"
- Rohan's image stays atmospheric, not dominant

Mobile:
- The hero remains above-the-fold coherent without hidden decorative crutches
- The proof row stacks cleanly without feeling like a stat grid
- CTA labels wrap cleanly with no overflow
- Spacing feels intentional, not cramped
```

- [ ] **Step 4: Run a final diff check**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
git diff -- index.html css/style.css js/main.js
```

Expected: Diff is limited to hero markup, hero CSS, and removal of obsolete hero counter logic.

- [ ] **Step 5: Commit the cleanup and verification slice**

```bash
cd /Users/rohanbhatia/Desktop/rohanstutoring-redesign/site
git add index.html css/style.css js/main.js
git commit -m "refactor: simplify homepage hero interactions"
```

## Self-Review

### Spec Coverage

- Urgency retained and de-carded: covered in Task 1 Step 1 and Task 2 Step 1.
- Approved headline and support line: covered in Task 1 Steps 2-3.
- Proof row reduced to two signals: covered in Task 1 Step 5 and Task 2 Step 3.
- CTA hierarchy updated: covered in Task 1 Step 4 and Task 2 Step 6.
- Floating card, scroll indicator, and layered chrome removed: covered in Task 1 Step 6, Task 2 Step 4, and Task 3 Step 1.
- Decorative intensity reduced while preserving editorial frame: covered in Task 2 Step 5.
- Mobile composure verified: covered in Task 2 Step 6 and Task 3 Step 3.

### Placeholder Scan

- No `TODO`, `TBD`, or deferred implementation notes remain.
- Each code-edit step names exact files and includes concrete replacement code or deletion targets.
- Each verification step includes exact commands or explicit manual checks.

### Type Consistency

- Final hero class set is `hero__urgency`, `hero__headline`, `hero__sub`, `hero__proof`, `hero__proof-item`, `hero__proof-separator`, and `hero__ctas`.
- Removed class set is `hero__announcement`, `hero__stats`, `hero__cred-card`, `hero__scroll`, and all `hero__stat*` classes.

Plan complete and saved to `site/docs/superpowers/specs/2026-04-19-homepage-hero-distillation-design.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
