# Quiz March 2027 Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retarget `/quiz`, its routing, its lead capture, and its four Kit follow-up sequences at the March 2027 sitting now that September 2026 has passed.

**Architecture:** The quiz stays a static page (`quiz.html` + `js/quiz.js`). Routing gains two inputs it lacks today: which sitting the student chose, and whether the live cohort is still enrolling (read from `js/catalog.js`, the existing source of truth). The chosen sitting is sent to Kit as a custom field so nurture can be segmented. Kit email edits are manual and need approval one by one.

**Tech Stack:** Static HTML/CSS, vanilla JS, Node `node:test`, Vercel serverless (`api/leads.js`), Kit v4 API.

**Status (13 September 2026, end of session):**

- Done and live: Tasks 1 to 6 (quiz), 7 (local and production smoke tests; no test lead submitted), 10 (Sunday FAQ removed, Mastery 24 classes), 11 (essay marking reopened), 9 (docs and business context synced). Commits `4065820`, `d7b8990`, `9e4665d` plus the docs commit.
- Kit: `quiz_sitting` custom field created (id 1364524). Comprehensive Path email 3 (9865061) class times replaced; Kit reported the update as a draft even with `published: true`, so Rohan should confirm it is live in the editor.
- Skipped by Rohan: K4 (Mastery email 1 wording stays).
- Waiting on dates: K2 price wording on 1 October (Rohan's calendar re-audit). K6 in late October: close `COHORT_STATUSES.liveCoaching`, deploy, then pause The Comprehensive Path and The Mastery Path.
- Not done: Task 11 step 9 (optional replies to waitlist enquiries).
- Routing widened after review (Rohan, 13 September 2026), based on a simulation of all 19,200 answer combinations. Changes A to E: (A) March 2027 first-timers who "don't know where to start", with 5+ hrs and a real goal, get Comprehensive; (B) no full mock yet + "realistic shot" + 5+ hrs gets Comprehensive; (C) sat once + mocked or sat the exam + "push as high as I can" + plateau or timing + 10+ hrs gets Mastery; (D) re-sitters who pick "Still deciding" are routed as March 2027, with a note saying so; (E) under 5 hrs + started prep + competitive or maximise goal gets Comprehensive. Simulated March 2027 split moved from 39.7% Comprehensive / 11.5% Mastery to 54.6% / 12.3%.
- Fixed after review: Mastery checkout summary tagline now says "Enrolment open" (`js/catalog.js:440`), and both checkout pages load a freshly versioned `catalog.js`.

**Audit date:** 13 September 2026. Sources: `js/quiz.js`, `quiz.html`, `tests/quiz-*.test.js`, `api/leads.js`, `api/_lib/_kit.js`, `js/catalog.js`, `api/_lib/_business-context.js`, course pages, live Kit sequences and tags.

---

## 1. Audit findings

### Quiz page and routing (site)

| # | Severity | Finding | Where |
|---|---|---|---|
| Q1 | High | First timeline answer is "September 2026", which has passed. "Later than March 2027" lumps September 2027 in with 2028+. | `js/quiz.js:11-14` |
| Q2 | High | `longRunway` treats `sep-2026` and `mar-2027` as live-cohort sittings. With no September 2027 option, a student sitting in September 2027 can't be told apart from one sitting in 2028. A re-sitter who picks "Still deciding" still gets Mastery, because Mastery rules 2 and 3 never check the timeline. | `js/quiz.js:232, 243-260` |
| Q3 | High | Routing ignores enrolment status. Once classes start in late October and `COHORT_STATUSES.liveCoaching` is closed, the quiz will keep sending people to Comprehensive and Mastery. | `js/quiz.js:230-278`, `js/catalog.js:23-37` |
| Q4 | High | Returning visitors resume from localStorage (`rt_quiz_v1`). Anyone who finished before today gets their old result back, including answers based on September 2026. | `js/quiz.js:80, 540-545` |
| Q5 | High | The result page shows the public Calendly consultation link as the primary CTA for Mastery and Comprehensive. Business context says the 1:1 call link is invite-only and never advertised. | `js/quiz.js:94, 132, 163`, `api/_lib/_business-context.js` |
| Q6 | Medium | Every result says "10-week plan", but the Blueprint plan runs 12 weeks, the Kit emails say "12-week", and Comprehensive itself is 12 weeks from late October. None of the plans are tied to March 2027. | `quiz.html:151`, `js/quiz.js:109-222` |
| Q7 | Medium | The Comprehensive plan says "A 5+ point jump is realistic". That's an outcome claim with no source. | `js/quiz.js:140` |
| Q8 | Medium | Comprehensive's primary CTA is "Book a free strategy call" rather than the course, even though Comprehensive is the flagship and is enrolling. | `js/quiz.js:163-164` |
| Q9 | Medium | Only `quiz_outcome` reaches Kit. The sitting isn't stored, so nurture can't separate March 2027 leads from September 2027 leads. | `api/leads.js:15-25`, `api/_lib/_kit.js:149-176` |
| Q10 | Low | Meta description and OG description say "10-week study plan". | `quiz.html:10, 12` |
| Q11 | Low | Tests use `sep-2026` fixtures and split on the `rt_quiz_v1` string. | `tests/quiz-page.test.js:11, 79, 92` |

### Kit follow-up sequences (live, all active)

Tags: `quiz_start_here` 115, `quiz_comprehensive` 87, `quiz_blueprint` 18, `quiz_mastery` 28. Custom field `quiz_outcome` exists. `quiz_sitting` does not.

| # | Severity | Finding | Sequence / email id |
|---|---|---|---|
| K1 | High | Email 3 gives class times ("Tuesdays at 6pm Sydney time", "Wednesdays at 7pm AEST"). Business context says weekly times are confirmed before the first class, so no times should be quoted yet. | The Comprehensive Path 2764641 / 9865061 |
| K2 | High | Email 5 says "$1,599 until 1 October, then $1,799. Or four payments of $449." This goes stale on 1 Oct, and the instalment line contradicts business context ("no instalment plan right now"). The checkout still shows a 4 × $449 option. | 2764641 / 9865078 |
| K3 | High | Mastery emails say "24 live S1 and S2 classes". The Mastery page detail table says "20 sessions (S1 + S2)", while the Mastery FAQ says 24. | The Mastery Path 2764688 / 9865210, 9865214; `courses/mastery.html:246` vs `:88` |
| K4 | Medium | Email 1 says Mastery includes "Multiple weekly classes with Rohan". Email 3 says the private tutorials are "with our expert team". | 2764688 / 9865207 vs 9865210 |
| K5 | Medium | Mastery emails 1, 2, 4 and 6 link the public Calendly consultation (same issue as Q5). | 2764688 |
| K6 | Medium | Emails 1, 2 and 6 say the cohort "starts in October". This is accurate until late October, then wrong for anyone tagged afterwards. | 2764641 / 9865039, 9865049, 9865088 |
| K7 | Low | The docs in `docs/email-sequences/*.md` no longer match live Kit: they still say September 2026, $1,699 / $2,249, 50+ hr, AEDT class times and 48hr turnaround. | `docs/email-sequences/` |

### Stale items outside the quiz

- `index.html:857-862`: FAQ promises a "free Sunday strategy session" after the quiz, but the workshop no longer runs. Covered by Task 10.
- `courses/mastery.html` table says "20 sessions", but the FAQ and emails say 24. Covered by Task 10.
- Essay marking still shows "Reopening Sept 2026" across `index.html`, `courses.html`, `courses/essay-marking.html` and `js/catalog.js`, but it is open again. Covered by Task 11.
- Flag only: `rohans-content-os/CURRENT_LAUNCH_CONTEXT.md` still describes the June 2026 Cohort 2.
- Flag only: the Mastery catalog tagline says "Waitlist open" (`js/catalog.js:440`), but Mastery is enrolling. Check where the tagline renders before changing it.
- Flag only: the 1 October Comprehensive price cutover (`js/catalog.js:327`) is on Rohan's calendar for a full re-audit.

---

## 2. Decisions

Confirmed by Rohan on 13 September 2026:

- **D1 Timeline and routing: March 2027 only.** Options are March 2027 / September 2027 / Later than September 2027 / Still deciding. Comprehensive and Mastery are only recommended for March 2027 while the cohort is open. Everyone else who would have qualified goes to Blueprint.
- **D2 Calendly on the quiz: keep it on Mastery only.** The Mastery result keeps "Book a free strategy consultation" as its primary CTA. The Comprehensive result's primary CTA becomes the Comprehensive course page. The Mastery Kit emails keep their Calendly links.
- **D3 Plan framing: anchor to March 2027.** "10-week" goes. Comprehensive and Mastery plans run in three stages: now to late October, the twelve cohort weeks, then the run-in to the March 2027 exam. Blueprint and Start Here become 12 weeks (matching Kit) and get a one-line note for the chosen sitting.
- **D4 Instalments: 4 × $449 is on sale.** Kit email 9865078 and the checkout are correct. The business context file is the one that's wrong.

- **D5 After classes start: close and reroute.** When Comprehensive classes start in late October, set `COHORT_STATUSES.liveCoaching` to closed. The quiz then reroutes to Blueprint (Task 3), and The Comprehensive Path and The Mastery Path Kit sequences are paused (Task 8).
- **D6 Mastery: 24 live classes.** The Mastery page table changes from 20 to 24 (Task 10). The emails already say 24.
- **D7 Homepage FAQ: remove the free Sunday session.** The "Is there a free taster session?" item is deleted (Task 10).
- **D8 Essay marking: reopen on the pre-August terms.** $34.99 per essay, $249 for 10, 3-day turnaround. The 10-essay pack returns as a Blueprint checkout add-on, and the waitlist CTAs become buy CTAs (Task 11).
- **Price cutover:** Rohan re-audits pricing on 1 October from a calendar reminder, so this plan doesn't cover it beyond K2.

---

## 3. File map

- Modify `js/quiz.js`: questions, storage key, routing, cohort check, CTAs, plan copy, sitting note, payload.
- Modify `quiz.html`: catalog script, cache-busted quiz script, sitting hidden input, sitting note element, gate heading, meta copy.
- Modify `css/quiz.css`: style for the sitting note.
- Modify `api/leads.js`: accept `sitting`.
- Modify `api/_lib/_kit.js`: write `quiz_sitting`.
- Modify `tests/quiz-page.test.js` and `tests/quiz-lead.test.js`.
- Modify `index.html`: remove the Sunday session FAQ (Task 10) and restore open essay marking copy (Task 11).
- Modify `courses/mastery.html`: 24 sessions (Task 10).
- Modify `courses/essay-marking.html`, `courses.html`, `js/catalog.js`, `api/_lib/_enquiry-offers.js`: reopen essay marking (Task 11).
- Modify `tests/url-normalization.test.js`, `tests/checkout.test.js`, `tests/enquiry-automation.test.js` (Tasks 10 and 11).
- Modify `docs/email-sequences/*.md`: sync to live Kit after Task 8.

**Execution order:** Tasks 10 and 11 are independent of the quiz and can ship first. Then Tasks 1 to 7, then 8 and 9.
- Modify `api/_lib/_business-context.js` only if D4 or D5 changes a fact.

---

## 4. Tasks

### Task 1: Upcoming sittings and a fresh storage key (Q1, Q4, Q11)

**Files:** Modify `js/quiz.js:6-16, 80`. Test `tests/quiz-page.test.js`.

- [ ] **Step 1: Update the test harness and add failing tests**

In `tests/quiz-page.test.js`, change line 11 to:

```js
const quizQuestionsBlock = quizJs.split("const STORAGE_KEY = 'rt_quiz_v2';")[0];
```

Append:

```js
test('quiz timeline only offers upcoming sittings', () => {
  assert.doesNotMatch(quizQuestionsBlock, /sep-2026|September 2026/);
  assert.match(quizQuestionsBlock, /value: 'mar-2027', label: 'March 2027'/);
  assert.match(quizQuestionsBlock, /value: 'sep-2027', label: 'September 2027'/);
  assert.match(quizQuestionsBlock, /value: 'later', label: 'Later than September 2027'/);
});

test('quiz storage key is bumped so answers saved before the March 2027 refresh are discarded', () => {
  assert.match(quizJs, /const STORAGE_KEY = 'rt_quiz_v2';/);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd site && node --test tests/quiz-page.test.js`
Expected: FAIL on both new tests.

- [ ] **Step 3: Implement**

In `js/quiz.js`, replace the timeline answers:

```js
    answers: [
      { value: 'mar-2027', label: 'March 2027' },
      { value: 'sep-2027', label: 'September 2027' },
      { value: 'later', label: 'Later than September 2027' },
      { value: 'unsure', label: 'Still deciding' },
    ],
```

and `const STORAGE_KEY = 'rt_quiz_v1';` with `const STORAGE_KEY = 'rt_quiz_v2';`.

- [ ] **Step 4: Run and confirm pass.** Expect the new tests to pass. The existing routing test still uses `sep-2026`; Task 2 updates it.

- [ ] **Step 5: Commit**

```bash
git add js/quiz.js tests/quiz-page.test.js
git commit -m "Offer March 2027 and later sittings in the quiz and reset saved answers"
```

### Task 2: Route live-cohort offers only for the March 2027 sitting (Q2) [D1]

**Files:** Modify `js/quiz.js:230-278`. Test `tests/quiz-page.test.js:74-141`.

- [ ] **Step 1: Update old fixtures and add a failing test**

In `tests/quiz-page.test.js`, change both `timeline: 'sep-2026'` fixtures (lines 79 and 92) to `timeline: 'mar-2027'`. Their expected outcomes (BLUEPRINT, COMPREHENSIVE) don't change.

Append:

```js
test('quiz only routes into live cohorts for the March 2027 sitting while enrolment is open', () => {
  const route = loadQuizRouter();
  const resitter = { attempts: 'multi', current: 'mocked', target: 'competitive', section: 's1', hours: '10-20', blocker: 'timing' };
  const committed = { attempts: 'once', current: 'mocked', target: 'competitive', section: 's2', hours: '10-20', blocker: 'essays' };

  assert.equal(route({ ...resitter, timeline: 'mar-2027' }).id, 'MASTERY_CALL');
  assert.equal(route({ ...resitter, timeline: 'sep-2027' }).id, 'BLUEPRINT');
  assert.equal(route({ ...resitter, timeline: 'unsure' }).id, 'BLUEPRINT');
  assert.equal(route({ ...committed, timeline: 'mar-2027' }).id, 'COMPREHENSIVE');
  assert.equal(route({ ...committed, timeline: 'later' }).id, 'BLUEPRINT');
  assert.equal(route({ ...committed, timeline: 'mar-2027' }, { cohortOpen: false }).id, 'BLUEPRINT');
  assert.equal(route({ ...resitter, timeline: 'mar-2027' }, { cohortOpen: false }).id, 'BLUEPRINT');
  assert.equal(
    route({ attempts: 'first', current: 'new', target: 'realistic', section: 'all', hours: '5-10', blocker: 'materials', timeline: 'sep-2027' }).id,
    'START_HERE'
  );
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd site && node --test tests/quiz-page.test.js`
Expected: FAIL. `sep-2027` and `unsure` re-sitters currently get MASTERY_CALL, and `cohortOpen` is ignored.

- [ ] **Step 3: Implement**

Replace `routeAnswers` in `js/quiz.js`, keeping it above the `// Expose for console testing` comment because the test loader cuts there:

```js
const COHORT_SITTING = 'mar-2027';

function routeAnswers(a, { cohortOpen = true } = {}) {
  const highHours = a.hours === '5-10' || a.hours === '10-20' || a.hours === '20plus';
  const liveCohortFit = a.timeline === COHORT_SITTING && cohortOpen;
  const laterSitting = a.timeline === 'sep-2027' || a.timeline === 'later';
  const earlyPrep = a.current === 'new' || a.current === 'building';
  const hasProgress = a.current === 'building' || a.current === 'mocked' || a.current === 'exam-ready';
  const seriousGoal = a.target === 'realistic' || a.target === 'competitive' || a.target === 'maximise';
  const ambitiousGoal = a.target === 'competitive' || a.target === 'maximise';

  // 1. Clear beginner signals
  if (a.attempts === 'first' && (laterSitting || a.timeline === 'unsure')) return OUTCOMES.START_HERE;
  if (a.blocker === 'no-plan' && a.attempts === 'first') return OUTCOMES.START_HERE;
  if (earlyPrep && a.target === 'figuring-out') return OUTCOMES.START_HERE;

  // 2. High-friction re-sitters who need hands-on support (Mastery runs with the live cohort)
  if (
    liveCohortFit &&
    a.attempts === 'multi' &&
    hasProgress &&
    (a.blocker === 'plateau' || a.blocker === 'timing' || a.blocker === 'materials') &&
    highHours
  ) {
    return OUTCOMES.MASTERY_CALL;
  }

  // 3. Exam-ready multi-attempters chasing the ceiling
  if (liveCohortFit && a.current === 'exam-ready' && a.target === 'maximise' && a.attempts === 'multi') {
    return OUTCOMES.MASTERY_CALL;
  }

  // 4. Live course for March 2027 students with hours and a serious goal
  if (
    liveCohortFit && (
      (hasProgress && seriousGoal && highHours) ||
      (a.current === 'new' && highHours && ambitiousGoal) ||
      (a.current === 'new' && a.attempts !== 'first' && a.blocker === 'essays' && highHours && seriousGoal)
    )
  ) {
    return OUTCOMES.COMPREHENSIVE;
  }

  // 5. Self-paced fallback for everyone else, including later sittings and closed cohorts
  return OUTCOMES.BLUEPRINT;
}
```

(The old rule 5 returned BLUEPRINT, the same as the fallback, so it is folded in.)

- [ ] **Step 4: Run and confirm pass**

Run: `cd site && node --test tests/quiz-page.test.js`
Expected: PASS, including the existing five routing assertions.

- [ ] **Step 5: Commit**

```bash
git add js/quiz.js tests/quiz-page.test.js
git commit -m "Only recommend live cohorts to March 2027 quiz takers"
```

### Task 3: Read cohort status from the catalog (Q3) [D5]

**Files:** Modify `quiz.html:239`, `js/quiz.js` (`finishQuiz` and the resume block). Test `tests/quiz-page.test.js`.

- [ ] **Step 1: Failing test**

```js
test('quiz page loads the catalog before quiz.js and routes with live cohort status', () => {
  const catalogIdx = quizHtml.search(/<script src="js\/catalog\.js[^"]*" defer><\/script>/);
  const quizIdx = quizHtml.indexOf('<script src="js/quiz.js');
  assert.notEqual(catalogIdx, -1, 'expected catalog.js on the quiz page');
  assert.ok(catalogIdx < quizIdx, 'catalog.js must load before quiz.js');
  assert.match(quizJs, /routeAnswers\(state\.answers, \{ cohortOpen: isLiveCohortOpen\(\) \}\)/);
});
```

- [ ] **Step 2: Run and confirm failure.** `cd site && node --test tests/quiz-page.test.js`

- [ ] **Step 3: Implement**

In `quiz.html`, replace `<script src="js/quiz.js" defer></script>` with:

```html
  <script src="js/catalog.js?v=20260913-quiz" defer></script>
  <script src="js/quiz.js?v=20260913-march-2027" defer></script>
```

In `js/quiz.js`, add below `// Expose for console testing` / `window.__quizTest`:

```js
function isLiveCohortOpen() {
  const catalog = window.ProductCatalog;
  if (!catalog || typeof catalog.getCohortStatusForSlug !== 'function') return true;
  const status = catalog.getCohortStatusForSlug('comprehensive');
  return !status || status.available === true;
}
```

In `finishQuiz`, change the first line to:

```js
  const outcome = routeAnswers(state.answers, { cohortOpen: isLiveCohortOpen() });
```

In the resume block inside `DOMContentLoaded`, replace `showResult(OUTCOMES[state.outcomeId]);` with:

```js
    const hasAllAnswers = QUESTIONS.every((question) => state.answers[question.key]);
    const outcome = hasAllAnswers
      ? routeAnswers(state.answers, { cohortOpen: isLiveCohortOpen() })
      : OUTCOMES[state.outcomeId];
    state.outcomeId = outcome ? outcome.id : null;
    saveState();
    showResult(outcome);
```

- [ ] **Step 4: Run full suite.** `cd site && npm test`, expecting all tests to pass.

- [ ] **Step 5: Commit**

```bash
git add quiz.html js/quiz.js tests/quiz-page.test.js
git commit -m "Reroute quiz results away from live cohorts once enrolment closes"
```

### Task 4: Keep the consultation link on Mastery only (Q5, Q8) [D2]

**Files:** Modify `js/quiz.js:163-164`. Test `tests/quiz-page.test.js`.

- [ ] **Step 1: Failing test**

```js
test('only the Mastery result offers the consultation link; Comprehensive points at the course', () => {
  const route = loadQuizRouter();
  const comprehensive = route({ timeline: 'mar-2027', attempts: 'once', current: 'mocked', target: 'competitive', section: 's2', hours: '10-20', blocker: 'essays' });
  const mastery = route({ timeline: 'mar-2027', attempts: 'multi', current: 'mocked', target: 'competitive', section: 's1', hours: '10-20', blocker: 'timing' });

  assert.equal(comprehensive.primaryCta.url, '/courses/comprehensive');
  assert.equal(comprehensive.primaryCta.label, 'See the Comprehensive Course');
  assert.doesNotMatch(comprehensive.primaryCta.url + comprehensive.secondaryCta.url, /calendly\.com/i);
  assert.match(mastery.primaryCta.url, /calendly\.com\/rohansgamsat\/gamsat-strategy-consultation/);
});
```

- [ ] **Step 2: Run and confirm failure.** `cd site && node --test tests/quiz-page.test.js`, which should fail because Comprehensive's primary CTA is still Calendly.

- [ ] **Step 3: Implement.** Keep `CALENDLY` and the Mastery CTAs as they are. Change the Comprehensive CTAs:

```js
    primaryCta: { label: 'See the Comprehensive Course', url: '/courses/comprehensive' },
    secondaryCta: { label: 'Browse All Courses', url: '/courses' },
```

- [ ] **Step 4: Run and confirm pass.** `cd site && npm test`

- [ ] **Step 5: Commit**

```bash
git add js/quiz.js tests/quiz-page.test.js
git commit -m "Send Comprehensive quiz results straight to the course page"
```

### Task 5: Anchor plan copy to the chosen sitting (Q6, Q7, Q10) [D3]

**Files:** Modify `js/quiz.js` (OUTCOMES copy, new `SITTING_NOTES`, `showResult`), `quiz.html:10, 12, 145-151`, `css/quiz.css`. Test `tests/quiz-page.test.js`.

Copy gate: all visitor-facing text in this task is drafted with `/humanizer`, uses no em dashes, and is shown to Rohan before it is committed. Business facts come only from the live Comprehensive and Mastery pages: late October start, twelve weeks, capped at 25, weekly times confirmed before the first class.

- [ ] **Step 1: Failing test**

```js
test('quiz plans are tied to the sitting and avoid unsupported claims', () => {
  assert.doesNotMatch(quizHtml, /10-week/i);
  assert.doesNotMatch(quizJs, /10 weeks|10-week/i);
  assert.doesNotMatch(quizJs, /5\+ point jump/i);
  assert.match(quizJs, /const SITTING_NOTES = \{/);
  assert.match(quizJs, /'mar-2027':/);
  assert.match(quizJs, /'sep-2027':/);
  assert.match(quizHtml, /id="resultSitting"/);
  assert.doesNotMatch(quizJs + quizHtml, /—/);
});
```

- [ ] **Step 2: Run and confirm failure.**

- [ ] **Step 3: Implement structure**

In `quiz.html` result header, after `<h2 id="resultName"></h2>`:

```html
          <p class="result__sitting" id="resultSitting"></p>
```

Change the gate heading to `<h3>Unlock your full study plan.</h3>`. Meta and OG descriptions (draft, pending sign-off):

```html
  <meta name="description" content="Seven questions, two minutes. Get a personalised GAMSAT study plan for your sitting and the course recommendation that actually fits.">
  <meta property="og:description" content="Seven questions, two minutes. Get a personalised GAMSAT study plan built around where you are and when you're sitting.">
```

In `css/quiz.css`, after the `.quiz-hero__inner h1 em` rule:

```css
.result__sitting { color: var(--blue-light); font-weight: 600; font-size: 0.95rem; margin: 0 0 12px; }
.result__sitting:empty { display: none; }
```

In `js/quiz.js`, above `OUTCOMES` (draft copy, pending humanizer and sign-off):

```js
const SITTING_NOTES = {
  'mar-2027': 'Built for the March 2027 sitting.',
  'sep-2027': 'Built for the September 2027 sitting. You have time, so the aim is a steady start, not a sprint.',
  later: 'Built for a sitting after September 2027. This stage is about habits, not cramming.',
  unsure: 'You have not picked a sitting yet. Follow this for a month, then choose your date.',
};
```

In `showResult`, after `el.resultTeaser.textContent = outcome.teaser;`:

```js
  const sittingEl = document.getElementById('resultSitting');
  if (sittingEl) sittingEl.textContent = SITTING_NOTES[state.answers.timeline] || '';
```

- [ ] **Step 4: Rewrite plan copy** with these stage headings:
  - `COMPREHENSIVE.planHtml` and `MASTERY_CALL.planHtml`: `Stage 1: Now to late October: before classes start`, `Stage 2: The twelve cohort weeks`, `Stage 3: After the final class: full mocks and the run-in to March 2027`. Remove the "5+ point jump" sentence. The Mastery version keeps the private tutorials and monthly check-ins as it has now, with the class count set per D6.
  - `BLUEPRINT.planHtml`: `Weeks 1 to 4`, `Weeks 5 to 9`, `Weeks 10 to 12`, matching the live Flexible Path email 9844777. Replace "how your next 10 weeks should look" style lines.
  - `START_HERE.planHtml`: `Weeks 1 to 4`, `Weeks 5 to 9`, `Weeks 10 to 12`, matching Beginner's Path email 9822088.
  - Teasers: remove "ten focused weeks" from COMPREHENSIVE.

  Run `/humanizer` on the drafts, show Rohan the before and after, then apply.

- [ ] **Step 5: Run and confirm pass.** `cd site && npm test`

- [ ] **Step 6: Commit**

```bash
git add quiz.html js/quiz.js css/quiz.css tests/quiz-page.test.js
git commit -m "Tie quiz study plans to the student's sitting"
```

### Task 6: Send the chosen sitting to Kit (Q9)

**Files:** Modify `quiz.html` (hidden input), `js/quiz.js` (`showResult`, submit payload), `api/leads.js:15-25`, `api/_lib/_kit.js:149-155`. Test `tests/quiz-lead.test.js`, `tests/quiz-page.test.js`.

- [ ] **Step 1: Create the Kit custom field** `quiz_sitting` (Kit write, ask first), then confirm it appears in `list_custom_fields`.

- [ ] **Step 2: Failing tests.** Append to `tests/quiz-lead.test.js`:

```js
test('syncQuizLead stores the chosen sitting alongside the outcome', async () => {
  const calls = [];
  const originalWarn = console.warn;
  process.env.KIT_API_KEY = 'kit_test_123';
  delete process.env.KIT_TAG_ID_QUIZ_COMPREHENSIVE;
  console.warn = () => {};

  kit.__setFetch(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ subscriber: { id: 901 } }) };
  });

  try {
    await kit.syncQuizLead({ firstName: 'Jane', email: 'jane@example.com', outcome: 'COMPREHENSIVE', sitting: 'mar-2027' });
    assert.deepEqual(JSON.parse(calls[0].options.body).fields, {
      quiz_outcome: 'COMPREHENSIVE',
      quiz_sitting: 'mar-2027',
    });
  } finally {
    console.warn = originalWarn;
    kit.__resetForTests();
    delete process.env.KIT_API_KEY;
  }
});

test('normaliseQuizLead passes through a short sitting value', () => {
  const lead = quizLeadHandler.normaliseQuizLead({
    firstName: 'Jane',
    email: 'jane@example.com',
    outcome: 'BLUEPRINT',
    sitting: 'sep-2027',
  });
  assert.equal(lead.sitting, 'sep-2027');
});
```

Append to `tests/quiz-page.test.js`:

```js
test('quiz lead payload includes the chosen sitting', () => {
  assert.match(quizHtml, /<input type="hidden" name="sitting" id="sittingField">/);
  assert.match(quizJs, /sitting: String\(form\.elements\.sitting\?\.value \|\| state\.answers\.timeline \|\| ''\)\.trim\(\)/);
});
```

- [ ] **Step 3: Run and confirm failure.** `cd site && node --test tests/quiz-lead.test.js tests/quiz-page.test.js`

- [ ] **Step 4: Implement**

`quiz.html`, next to `outcomeField`:

```html
            <input type="hidden" name="sitting" id="sittingField">
```

`js/quiz.js`: add `sittingField: document.getElementById('sittingField'),` to `el`. In `showResult`, after `el.outcomeField.value = outcome.id;`:

```js
  if (el.sittingField) el.sittingField.value = state.answers.timeline || '';
```

Payload:

```js
    const payload = {
      firstName: String(form.elements.firstName?.value || '').trim(),
      email: String(form.elements.email?.value || '').trim(),
      outcome: String(form.elements.outcome?.value || state.outcomeId || '').trim(),
      sitting: String(form.elements.sitting?.value || state.answers.timeline || '').trim(),
    };
```

`api/leads.js` `normaliseQuizLead`:

```js
  const outcome = String(body.outcome || '').trim();
  const sitting = String(body.sitting || '').trim().slice(0, 20);
  ...
  return { firstName: firstName.slice(0, 120), email, outcome, sitting };
```

`api/_lib/_kit.js` `syncQuizLead`:

```js
async function syncQuizLead({ email, firstName = '', outcome = '', sitting = '' }) {
  const safeOutcome = String(outcome || '').trim();
  const safeSitting = String(sitting || '').trim();
  const fields = {};
  if (safeOutcome) fields.quiz_outcome = safeOutcome;
  if (safeSitting) fields.quiz_sitting = safeSitting;

  const subscriber = await upsertSubscriber({ email, firstName, fields });
```

(The rest of the function stays as is.)

- [ ] **Step 5: Run full suite.** `cd site && npm test`, expecting all tests to pass, including the existing `fields: { quiz_outcome: 'START_HERE' }` assertion.

- [ ] **Step 6: Commit**

```bash
git add quiz.html js/quiz.js api/leads.js api/_lib/_kit.js tests/quiz-lead.test.js tests/quiz-page.test.js
git commit -m "Store the student's GAMSAT sitting on quiz leads in Kit"
```

### Task 7: Verify and ship

- [ ] `cd site && npm test`: all pass.
- [ ] Preview at `/quiz` (Browser pane, `site` launch config). Walk through three paths and screenshot each result at desktop and mobile widths:
  1. March 2027 / sat once / mocked / competitive / S2 / 10-20 / essays → The Comprehensive Path, sitting note "March 2027", CTA to `/courses/comprehensive`.
  1b. March 2027 / sat 2+ times / mocked / competitive / S1 / 10-20 / timing → The Mastery Path, CTA to the Calendly consultation.
  2. September 2027 / first / new / realistic / all / 5-10 / materials → The Beginner's Path.
  3. Same as 1, with `COHORT_STATUSES.liveCoaching.available` set to `false` in DevTools before the last answer → The Flexible Path.
- [ ] Check the console for errors, and check that a reload after finishing doesn't bring back `rt_quiz_v1` state.
- [ ] Push to `main` (ask first) and confirm the Vercel production deploy.
- [ ] Production smoke test with a test address Rohan owns. Confirm in Kit: `quiz_outcome`, `quiz_sitting` and the outcome tag are set, and the matching sequence email arrives. Then ask before removing the test subscriber.

### Task 8: Fix live Kit sequences (manual; each edit needs explicit approval)

- [ ] K1: The Comprehensive Path email 9865061. Replace the class-times sentence with: "Weekly class times are confirmed before the first class, and every class is recorded."
- [ ] K2: email 9865078. The instalment line stays (D4). Before 1 October, draft the cutover version: subject "The Comprehensive Course is $1,799. Here is how I think about that." and body price "$1,799, or four payments of $449" (confirm the post-cutover instalment amount against `js/catalog.js:327-362` first). Swap it in on 1 October.
- [ ] K3: No email change. The Mastery emails already say 24 live classes (D6). The page is fixed in Task 10.
- [ ] K4: Mastery email 9865207. Change "Multiple weekly classes with Rohan" to "24 live S1 and S2 classes", which matches emails 9865210 and 9865214 and the Mastery page. The email 3 wording "5 private tutorials with our expert team" stays unless Rohan says the tutorials are with him.
- [ ] K5: No change. The Mastery emails keep their Calendly links (D2).
- [ ] K6: When classes start in late October (D5), in this order: set `COHORT_STATUSES.liveCoaching` in `js/catalog.js` to `{ status: 'closed', available: false, ... }` with the closed label and message Rohan approves, run `npm test`, and deploy. Then pause The Comprehensive Path (2764641) and The Mastery Path (2764688) in Kit, with Rohan's approval.
- [ ] Copy changes go through `/humanizer`, and Rohan approves before each Kit update.

### Task 10: Remove the Sunday session FAQ and fix the Mastery class count [D6, D7]

**Files:** Modify `index.html:857-862`, `courses/mastery.html:246`. Test `tests/url-normalization.test.js`.

- [ ] **Step 1: Failing tests.** Append to `tests/url-normalization.test.js`:

```js
test('homepage FAQ no longer promises the retired Sunday strategy session', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, /Sunday strategy session/i);
  assert.doesNotMatch(html, /Is there a free taster session\?/);
});

test('mastery page states 24 live classes everywhere', () => {
  const html = read('courses/mastery.html');
  assert.doesNotMatch(html, /20 sessions/);
  assert.match(html, /<span>Live Classes<\/span><strong>24 sessions \(S1 \+ S2\)<\/strong>/);
});
```

- [ ] **Step 2: Run and confirm failure.** `cd site && node --test tests/url-normalization.test.js`

- [ ] **Step 3: Implement.** In `index.html`, delete this whole block and the blank line before it:

```html
        <details class="faq__item reveal reveal--delay-4">
          <summary>Is there a free taster session?</summary>
          <div class="faq__answer">
            <p>Yes. Take the quiz to get your personalised study plan. Based on your results, you'll get access to the free Sunday strategy session where you can ask questions, see exactly how Rohan teaches, and get a real plan before spending a cent. <a href="/quiz">Start the quiz &rarr;</a></p>
          </div>
        </details>
```

The JSON-LD FAQ item "Is there a free way to get started?" (`index.html:224-229`) doesn't mention the session and stays.

In `courses/mastery.html:246`, change `<strong>20 sessions (S1 + S2)</strong>` to `<strong>24 sessions (S1 + S2)</strong>`.

- [ ] **Step 4: Run full suite.** `cd site && npm test`

- [ ] **Step 5: Commit**

```bash
git add index.html courses/mastery.html tests/url-normalization.test.js
git commit -m "Drop the retired Sunday session FAQ and state 24 Mastery classes consistently"
```

### Task 11: Reopen essay marking on the pre-August terms [D8]

Background: commit `670afd3` (19 August 2026) paused essay marking. Most of it is controlled by `ESSAY_MARKING_AVAILABLE` in `js/catalog.js`. Once the flag is `true`, catalog availability, the Blueprint checkout bumps (`js/checkout.js` `UNAVAILABLE_PRODUCT_SLUGS`), the add-on guard (`api/_lib/products.js`) and enquiry routing (`api/_lib/_enquiry-offers.js`) all reopen, so those guards stay in the code. The same commit's Drive-sharing skip for essay products in `_fulfill-payment-intent.js` and `_paypal-fulfillment.js`, and its tests in `tests/fulfillment-alerts.test.js` and `tests/stripe-webhook.test.js`, is a separate bug fix and must NOT be reverted. Only the page copy and three test files are reversed. Both reversals were dry-run on 13 September and apply cleanly.

**Files:** Modify `js/catalog.js:13, 49-52`, `api/_lib/_enquiry-offers.js:5-6`, `courses/essay-marking.html`, `index.html`, `courses.html`. Test `tests/checkout.test.js`, `tests/enquiry-automation.test.js`, `tests/url-normalization.test.js`.

- [ ] **Step 1: Restore the open-state tests.** This brings back the Blueprint essay-pack bump ($848 total), the essay upload metadata test, essay-help routing to Essay Marking, and the homepage checkout links.

```bash
cd site
git show 670afd3 -- tests/checkout.test.js tests/enquiry-automation.test.js tests/url-normalization.test.js | git apply -R --check
git show 670afd3 -- tests/checkout.test.js tests/enquiry-automation.test.js tests/url-normalization.test.js | git apply -R
```

Append to `tests/url-normalization.test.js`:

```js
test('essay marking is open on the pre-August terms', () => {
  const { CATALOG } = require('../api/_lib/catalog.server.js');
  assert.equal(CATALOG['essay-marking'].available, true);
  assert.equal(CATALOG['essay-marking'].priceCents, 3499);
  assert.equal(CATALOG['essay-pack-10'].available, true);
  assert.equal(CATALOG['essay-pack-10'].priceCents, 24900);

  const page = read('courses/essay-marking.html');
  assert.doesNotMatch(page, /Reopening September 2026|Join the Waitlist|Submissions Closed/i);
  assert.match(page, /\$34\.99/);
  assert.match(page, /3-day turnaround/i);

  for (const file of ['index.html', 'courses.html']) {
    assert.doesNotMatch(read(file), /Reopening Sept|Closed to new submissions/i, `${file} still shows essay marking as closed`);
  }
});
```

- [ ] **Step 2: Run and confirm failure.** `cd site && npm test`. Expect failures in the restored checkout, enquiry and homepage tests, and in the new test.

- [ ] **Step 3: Flip the flag and update comments.** In `js/catalog.js`, change line 13 to:

```js
 * To pause essay marking: set ESSAY_MARKING_AVAILABLE to false.
```

and lines 49-52 to:

```js
  // Essay marking is open. Setting this to false pauses new submissions: it hides
  // the single essay, the 10-essay pack, and the essay pack order bumps on the
  // Blueprint checkouts.
  const ESSAY_MARKING_AVAILABLE = true;
```

In `api/_lib/_enquiry-offers.js`, replace the two comment lines above `ESSAY_MARKING_OPEN` with:

```js
// When essay marking is paused (ESSAY_MARKING_AVAILABLE in js/catalog.js),
// essay-help leads are routed to Blueprint S2 instead of an offer they cannot buy.
```

- [ ] **Step 4: Restore the open-state page copy.**

```bash
git show 670afd3 -- courses/essay-marking.html index.html courses.html | git apply -R --check
git show 670afd3 -- courses/essay-marking.html index.html courses.html | git apply -R
```

- [ ] **Step 5: Review the restored copy.** Run `git diff courses/essay-marking.html index.html courses.html`. Check that prices are $34.99 and $249, the turnaround is 3 days, there are no em dashes in visible text, and there are no stale dates. Also check that the marking-entitlement copy from `da4da95` is still there. Show Rohan the diff before committing.

- [ ] **Step 6: Run the full suite and the price audit.**

```bash
cd site
npm test
npm run audit:prices
```

Expected: all tests pass and the price audit reports no mismatches.

- [ ] **Step 7: Browser check.** Check `/courses/essay-marking` at desktop and mobile widths. Both buy CTAs should go to `/checkout/?product=essay-marking` and `/checkout/?product=essay-pack-10`. `/checkout/?product=blueprint` should offer the 10-essay pack bump at $249. The homepage and `/courses` should show no "Reopening" badges. Don't complete a payment.

- [ ] **Step 8: Commit**

```bash
git add js/catalog.js api/_lib/_enquiry-offers.js courses/essay-marking.html index.html courses.html tests/checkout.test.js tests/enquiry-automation.test.js tests/url-normalization.test.js
git commit -m "Reopen essay marking at \$34.99 per essay and \$249 for ten"
```

- [ ] **Step 9: Waitlist.** While closed, the waitlist CTA went to `/contact`, so waitlist students are in contact-form enquiries, not a Kit list. Ask Rohan whether he wants replies drafted to those enquiries. Draft only; nothing is sent without approval.

### Task 9: Sync docs

- [ ] Rewrite `docs/email-sequences/comprehensive-quiz-result-sequence.md` and `mastery-quiz-result-sequence.md` from the live Kit content after Task 8, so the repo matches what subscribers get.
- [ ] Update `api/_lib/_business-context.js` per D4. In the offer ladder and the CURRENT PRIORITY block, replace "No instalment option during early bird" and "Full payment only during the early bird window; there is no instalment plan right now." with "Instalments: 4 × $449." Also record that the Mastery quiz result links the consultation call publicly (D2), so the weekly insights engine doesn't flag those bookings as unexpected.
- [ ] If D5 changes a fact, update the CURRENT PRIORITY block too.
- [ ] Commit: `git commit -m "Sync quiz email sequence docs with live Kit copy"`.
