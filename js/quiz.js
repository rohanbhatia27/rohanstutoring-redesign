/* ============================================
   QUIZ: quiz.js
   Path finder state machine + routing + submission
   ============================================ */

const QUESTIONS = [
  {
    key: 'timeline',
    stem: 'When are you sitting the GAMSAT?',
    answers: [
      { value: 'mar-2027', label: 'March 2027' },
      { value: 'sep-2027', label: 'September 2027' },
      { value: 'later', label: 'Later than September 2027' },
      { value: 'unsure', label: 'Still deciding' },
    ],
  },
  {
    key: 'attempts',
    stem: 'Have you sat the GAMSAT before?',
    answers: [
      { value: 'first', label: 'This is my first attempt' },
      { value: 'once', label: 'I have sat it once' },
      { value: 'multi', label: 'I have sat it two or more times' },
    ],
  },
  {
    key: 'current',
    stem: 'Where are you at right now with your prep?',
    answers: [
      { value: 'new', label: 'I have not done a full mock yet' },
      { value: 'building', label: 'I have done some practice, but not a full mock' },
      { value: 'mocked', label: 'I have sat at least one full mock' },
      { value: 'exam-ready', label: 'I have sat the real exam and know roughly where I stand' },
    ],
  },
  {
    key: 'target',
    stem: 'What outcome are you aiming for?',
    answers: [
      { value: 'realistic', label: 'I want a realistic shot this cycle' },
      { value: 'competitive', label: 'I want to be competitive for stronger programs' },
      { value: 'maximise', label: 'I want to push as high as I can' },
      { value: 'figuring-out', label: 'I am still figuring out my options' },
    ],
  },
  {
    key: 'section',
    stem: 'Which section worries you most?',
    answers: [
      { value: 's1', label: 'Section 1 (Humanities)' },
      { value: 's2', label: 'Section 2 (Essays)' },
      { value: 's3', label: 'Section 3 (Sciences)' },
      { value: 'all', label: 'All of them, honestly' },
      { value: 'strategy', label: 'Stamina and strategy across the whole paper' },
    ],
  },
  {
    key: 'hours',
    stem: 'Realistically, how many hours a week can you study?',
    answers: [
      { value: 'sub5', label: 'Under 5' },
      { value: '5-10', label: '5 to 10' },
      { value: '10-20', label: '10 to 20' },
      { value: '20plus', label: '20 or more' },
    ],
  },
  {
    key: 'blocker',
    stem: 'What is the main thing holding you back right now?',
    answers: [
      { value: 'no-plan', label: 'I do not know where to start' },
      { value: 'timing', label: 'I know the content but crumble under timed conditions' },
      { value: 'essays', label: 'My essays are not scoring' },
      { value: 'plateau', label: 'I have plateaued after multiple attempts' },
      { value: 'materials', label: 'I just need better materials and more practice' },
    ],
  },
];

const STORAGE_KEY = 'rt_quiz_v2';

// Analytics helper: fires GA and PostHog in parallel
const track = (event, params = {}) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
  if (typeof window.posthog !== 'undefined') {
    window.posthog.capture(event, params);
  }
};

console.log('[quiz] loaded, questions:', QUESTIONS.length);

const CALENDLY = 'https://calendly.com/rohansgamsat/gamsat-strategy-consultation';

const PRODUCT_IMAGES = {
  MASTERY_CALL: { src: 'assets/rohan/rohan-mentoring-3637.webp', alt: 'Mastery mentoring program' },
  COMPREHENSIVE: { src: 'assets/courses/comprehensive-course-card.webp', alt: 'Comprehensive course' },
  BLUEPRINT: { src: 'assets/courses/blueprint-course-card.webp', alt: 'Blueprint course' },
  START_HERE: { src: 'assets/courses/blueprint-course-card.webp', alt: 'Essentials Playbook' },
};

const SITTING_NOTES = {
  'mar-2027': 'Built around the March 2027 sitting.',
  'sep-2027': 'Built around the September 2027 sitting. You have time, so aim for a steady start rather than a sprint.',
  later: "You're sitting after September 2027. Use this stage to build habits you can keep up for a long time.",
  unsure: "You haven't picked a sitting yet. Follow this for a month, then choose your date.",
  'unsure-resitter': 'Most re-sitters aim for the next sitting, which is March 2027.',
};

const OUTCOMES = {
  MASTERY_CALL: {
    id: 'MASTERY_CALL',
    name: 'The Mastery Path',
    teaser: "You've sat this before. You know what doesn't work. The problem is not effort or time. Nobody has looked at your specific score profile and rebuilt your prep around what's actually leaking points. That's what one-to-one coaching is for.",
    planHtml: `
      <p>After more than one attempt, the bottleneck is rarely content. Usually nobody has looked at your score profile and rebuilt your prep around the gaps it shows. Mastery puts one-to-one work on top of the 24 live classes, and it runs up to the March 2027 sitting. This is the structure we'd work through together.</p>
      <h3>Phase 1: Now to late October: Diagnose before classes start</h3>
      <p class="plan-phase-focus">Weekly focus: one full diagnostic paper, your personalised roadmap, essays marked from week one.</p>
      <ol>
        <li>Sit a full timed paper, then break it down question by question.</li>
        <li>Build your roadmap from that evidence: your background, current scores, available hours, and what went wrong last time.</li>
        <li>Start an essay rhythm now. Marking is unlimited, so use it.</li>
      </ol>
      <h3>Phase 2: The twelve cohort weeks: Volume under pressure</h3>
      <p class="plan-phase-focus">Weekly focus: both live classes, timed mini-papers, private tutorials on your biggest leak.</p>
      <ol>
        <li>Use the live classes for the method and your private tutorials for whichever section is leaking the most marks.</li>
        <li>Bring your worst mock to a private tutorial and work out why you lost the marks, not just which answers were wrong.</li>
        <li>Lock in your S2 structure so each essay stops feeling like a fresh fight.</li>
      </ol>
      <h3>Phase 3: After the final class: Sharpen and simulate for March 2027</h3>
      <p class="plan-phase-focus">Weekly focus: a full mock every week, recovery in between, no new content.</p>
      <ol>
        <li>Sit full mocks in exam conditions and stop studying new material.</li>
        <li>Sort out stamina, food, and your exam-morning routine.</li>
        <li>Use your last monthly check-in to walk into the exam with a plan for each section.</li>
      </ol>
    `,
    primaryCta: { label: 'Book a free strategy consultation', url: CALENDLY },
    secondaryCta: { label: 'See the Mastery Program', url: '/courses/mastery' },
  },
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
    name: 'The Comprehensive Path',
    teaser: "You've got the hours to put in. The gap is real, but you can close it. Free resources probably won't get you there. Live teaching and essay feedback usually will, with a weekly structure that keeps you honest until exam day.",
    planHtml: `
      <p>Most students underestimate how much their blind spots cost them, and blind spots don't fix themselves. The Comprehensive Course is built for this gap. Classes start late October and run for twelve weeks, up to the March 2027 sitting. Here's how I'd use the time between now and exam day.</p>
      <h3>Phase 1: Now to late October: Get ahead before classes start</h3>
      <p class="plan-phase-focus">Weekly focus: the recorded library, one essay a week, one diagnostic mock.</p>
      <ol>
        <li>Sit a timed diagnostic early so you know where your marks are going before the first class.</li>
        <li>Start the S1 and S2 recorded modules. You get the library as soon as you enrol.</li>
        <li>S3 fundamentals: don't skip chemistry and physics reasoning, even if your background is biology.</li>
        <li>Write one essay a week from now. Don't wait until you feel ready.</li>
      </ol>
      <h3>Phase 2: The twelve cohort weeks: Apply under pressure, refine the essay</h3>
      <p class="plan-phase-focus">Weekly focus: both live classes, timed section drills, two essays a week.</p>
      <ol>
        <li>Treat the live classes as fixed appointments. Weekly times are confirmed before the first class, and every session is recorded.</li>
        <li>Stop doing untimed practice. Every question from here has a clock on it.</li>
        <li>Pick one S2 structure and stick with it for three weeks before changing anything.</li>
      </ol>
      <h3>Phase 3: After the final class: Exam simulation and taper for March 2027</h3>
      <p class="plan-phase-focus">Weekly focus: full mocks, review as long as you sat each one, no new content.</p>
      <ol>
        <li>Simulate exam day start times. Your brain needs to be sharp at 9am, not 9pm.</li>
        <li>Patch only the top three recurring error patterns from your mocks. Ignore the rest.</li>
        <li>In the final week, drop volume by half. Sleep and confidence matter more than one more paper.</li>
      </ol>
    `,
    primaryCta: { label: 'See the Comprehensive Course', url: '/courses/comprehensive' },
    secondaryCta: { label: 'Browse All Courses', url: '/courses' },
  },
  BLUEPRINT: {
    id: 'BLUEPRINT',
    name: 'The Flexible Path',
    teaser: "You study well on your own and you've got the time. Blueprint is 80 hours covering S1 mastery, S2 strategy, and the Expert Essay Collection, all at your own pace with lifetime access. No live sessions, no fixed schedule.",
    planHtml: `
      <p>Most students don't need live classes. They need complete content, a realistic schedule, and the discipline to follow it. Blueprint is 80 hours covering S1 and S2 mastery, advanced strategy, and the Expert Essay Collection, with lifetime access. Here is how to structure your prep around it.</p>
      <h3>Phase 1: Weeks 1 to 4: Content first, context second</h3>
      <p class="plan-phase-focus">Weekly focus: work through S1 and S2 foundations modules, one essay per week.</p>
      <ol>
        <li>Commit to finishing the S1 and S2 mastery modules in the first four weeks.</li>
        <li>Write one essay a week, using the Expert Essay Collection as your reference library.</li>
        <li>Do not skip ahead to advanced material. Foundations compound.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Apply and time-pressure</h3>
      <p class="plan-phase-focus">Weekly focus: advanced series modules, timed sections, 2 essays weekly.</p>
      <ol>
        <li>Move into the advanced series once foundations are locked in.</li>
        <li>Start timing every practice session. Blueprint gives you the strategies; pressure reveals which stick.</li>
        <li>Sit your first full mock in week 6, not week 10.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Consolidate, do not cram</h3>
      <p class="plan-phase-focus">Weekly focus: full mocks every 10 days, targeted revision.</p>
      <ol>
        <li>Revisit the Blueprint modules covering your weakest patterns. Do not rewatch everything.</li>
        <li>Use the Essay Collection to benchmark your last few essays against 80+ writing.</li>
        <li>Trust the plan. Self-paced students lose points to second-guessing, not lack of content.</li>
      </ol>
    `,
    primaryCta: { label: 'See the Blueprint', url: '/courses/blueprint' },
    secondaryCta: { label: 'Browse All Courses', url: '/courses' },
  },
  START_HERE: {
    id: 'START_HERE',
    name: "The Beginner's Path",
    teaser: "You're early. That's the best position to be in, as long as you use it. You don't need a full course yet. You need 30 days of real study, a first essay submitted, and a habit that carries you through.",
    planHtml: `
      <p>Early GAMSAT progress mostly comes down to momentum in the first month. The Essentials Playbook gets you from zero to consistent study in 30 days, including your first essay marked. Here's how the next 12 weeks should look from where you are now.</p>
      <h3>Phase 1: Weeks 1 to 4: Build the habit, not the knowledge</h3>
      <p class="plan-phase-focus">Weekly focus: follow the Playbook's 30-day plan exactly, no improvisation.</p>
      <ol>
        <li>Study every weekday, even if only 30 minutes. Consistency over volume.</li>
        <li>Write and submit your first essay by week 2. It does not matter how it scores.</li>
        <li>Use the free resources on the site to see how the full system fits together.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Widen the scope</h3>
      <p class="plan-phase-focus">Weekly focus: move beyond Playbook basics into full-section study, weekly essay.</p>
      <ol>
        <li>Add a second essay per week. Volume matters now.</li>
        <li>Start timed practice, even if scores drop. Untimed practice is a trap.</li>
        <li>Decide on your next product: Blueprint for self-paced, Comprehensive for live classes.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Decide and commit</h3>
      <p class="plan-phase-focus">Weekly focus: pick your main course and transition in.</p>
      <ol>
        <li>By now you'll know whether you need live teaching or self-paced content.</li>
        <li>Book into whichever fits and treat the Playbook as your foundation, not your finish line.</li>
        <li>If you're not sure, take the quiz again after a month of prep and compare the recommendation.</li>
      </ol>
    `,
    primaryCta: { label: 'Start with the Essentials Playbook', url: '/courses/starter-pack' },
    secondaryCta: { label: 'Browse All Courses', url: '/courses' },
  },
};

const COHORT_SITTING = 'mar-2027';

function routeAnswers(a, { cohortOpen = true } = {}) {
  const highHours = a.hours === '5-10' || a.hours === '10-20' || a.hours === '20plus';
  const bigHours = a.hours === '10-20' || a.hours === '20plus';
  // Re-sitters who have not picked a sitting are routed as March 2027 students
  const undecidedResitter = a.timeline === 'unsure' && a.attempts !== 'first';
  const liveCohortFit = (a.timeline === COHORT_SITTING || undecidedResitter) && cohortOpen;
  const laterSitting = a.timeline === 'sep-2027' || a.timeline === 'later';
  const earlyPrep = a.current === 'new' || a.current === 'building';
  const hasProgress = a.current === 'building' || a.current === 'mocked' || a.current === 'exam-ready';
  const seriousGoal = a.target === 'realistic' || a.target === 'competitive' || a.target === 'maximise';
  const ambitiousGoal = a.target === 'competitive' || a.target === 'maximise';

  // 1. Clear beginner signals (first-timers without a plan still get the live course if they have hours and a goal)
  if (a.attempts === 'first' && (laterSitting || a.timeline === 'unsure')) return OUTCOMES.START_HERE;
  if (a.blocker === 'no-plan' && a.attempts === 'first' && !(liveCohortFit && highHours && seriousGoal)) return OUTCOMES.START_HERE;
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

  // 4. One-time sitters chasing the ceiling with serious hours
  if (
    liveCohortFit &&
    a.attempts === 'once' &&
    (a.current === 'mocked' || a.current === 'exam-ready') &&
    a.target === 'maximise' &&
    (a.blocker === 'plateau' || a.blocker === 'timing') &&
    bigHours
  ) {
    return OUTCOMES.MASTERY_CALL;
  }

  // 5. Live course for March 2027 students with 5+ hours and a real goal
  if (liveCohortFit && highHours && seriousGoal) return OUTCOMES.COMPREHENSIVE;

  // 6. Under 5 hours, but already started and aiming for a competitive score
  if (liveCohortFit && a.hours === 'sub5' && hasProgress && ambitiousGoal) return OUTCOMES.COMPREHENSIVE;

  // 7. Self-paced fallback for everyone else, including later sittings and closed cohorts
  return OUTCOMES.BLUEPRINT;
}

// Expose for console testing
window.__quizTest = { routeAnswers, OUTCOMES };

function isLiveCohortOpen() {
  const catalog = window.ProductCatalog;
  if (!catalog || typeof catalog.getCohortStatusForSlug !== 'function') return true;
  const status = catalog.getCohortStatusForSlug('comprehensive');
  return !status || status.available === true;
}

const state = {
  answers: {},
  index: 0,
  completed: false,
  outcomeId: null,
  unlocked: false,
};

function setQuizView(activeView) {
  el.quizSection.classList.toggle('quiz-section--active', activeView === 'quiz');
  el.result.classList.toggle('quiz-result--active', activeView === 'result');
}

function getScrollTopFor(target) {
  const headerHeight = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--header-height')
  ) || 0;
  const extraOffset = window.innerWidth <= 640 ? 12 : 24;
  const targetTop = target.getBoundingClientRect().top + window.scrollY;
  return Math.max(targetTop - headerHeight - extraOffset, 0);
}

function scrollToBlock(target) {
  if (!target) return;
  window.scrollTo({
    top: getScrollTopFor(target),
    behavior: 'smooth',
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

    state.answers = parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
      ? parsed.answers
      : {};
    state.index = Number.isInteger(parsed.index) ? parsed.index : 0;
    state.completed = Boolean(parsed.completed);
    state.outcomeId = typeof parsed.outcomeId === 'string' ? parsed.outcomeId : null;
    state.unlocked = Boolean(parsed.unlocked);
  } catch (e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      answers: state.answers,
      index: state.index,
      completed: state.completed,
      outcomeId: state.outcomeId,
      unlocked: state.unlocked,
    }));
  } catch (e) { /* quota, ignore */ }
}

function clearStateStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* ignore */ }
}

function resetState() {
  state.answers = {};
  state.index = 0;
  state.completed = false;
  state.outcomeId = null;
  state.unlocked = false;
  saveState();
}

function isValidOutcomeId(outcomeId) {
  return Boolean(outcomeId && OUTCOMES[outcomeId]);
}

function isValidQuestionIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < QUESTIONS.length;
}

function sanitizeState() {
  if (!isValidQuestionIndex(state.index)) {
    resetState();
    return;
  }

  if (state.completed && !isValidOutcomeId(state.outcomeId)) {
    resetState();
    return;
  }

  const validQuestionKeys = new Set(QUESTIONS.map((question) => question.key));
  for (const key of Object.keys(state.answers)) {
    if (!validQuestionKeys.has(key)) delete state.answers[key];
  }
}

// Elements
const el = {
  start: document.getElementById('quizStart'),
  hero: document.querySelector('.quiz-hero'),
  quizSection: document.getElementById('quizSection'),
  card: document.getElementById('quizCard'),
  progressBar: document.getElementById('quizProgressBar'),
  progressLabel: document.getElementById('quizProgressLabel'),
  back: document.getElementById('quizBack'),
  result: document.getElementById('quizResult'),
  resultName: document.getElementById('resultName'),
  resultTeaser: document.getElementById('resultTeaser'),
  resultLocked: document.getElementById('resultLocked'),
  resultUnlocked: document.getElementById('resultUnlocked'),
  resultPlan: document.getElementById('resultPlan'),
  resultPrimaryCta: document.getElementById('resultPrimaryCta'),
  resultSecondaryCta: document.getElementById('resultSecondaryCta'),
  outcomeField: document.getElementById('outcomeField'),
  sittingField: document.getElementById('sittingField'),
  subjectField: document.getElementById('subjectField'),
  retake: document.getElementById('quizRetake'),
};

function renderQuestion() {
  const q = QUESTIONS[state.index];
  const total = QUESTIONS.length;
  const pct = Math.round(((state.index + 1) / total) * 100);
  el.progressBar.style.setProperty('--progress', pct + '%');
  el.progressBar.setAttribute('aria-valuenow', String(pct));
  el.progressBar.setAttribute('aria-valuetext', `Question ${state.index + 1} of ${total}`);
  el.progressLabel.textContent = `Question ${state.index + 1} of ${total}`;
  el.back.hidden = state.index === 0;

  el.card.innerHTML = `
    <h2 class="quiz__question">${q.stem}</h2>
    <div class="quiz__answers">
      ${q.answers.map((ans, i) => `
        <button class="quiz__answer" data-value="${ans.value}" data-index="${i}">
          <span class="quiz__answer-key">${i + 1}</span>${ans.label}
        </button>
      `).join('')}
    </div>
  `;

  el.card.querySelectorAll('.quiz__answer').forEach(btn => {
    btn.addEventListener('click', () => selectAnswer(q.key, btn.dataset.value));
  });
}

function selectAnswer(key, value) {
  state.answers[key] = value;
  track('quiz_question_answered', { question: key, answer: value, index: state.index });
  if (state.index < QUESTIONS.length - 1) {
    state.index++;
    saveState();
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function goBack() {
  if (state.index > 0) {
    state.index--;
    saveState();
    renderQuestion();
  }
}

function finishQuiz() {
  const outcome = routeAnswers(state.answers, { cohortOpen: isLiveCohortOpen() });
  state.completed = true;
  state.outcomeId = outcome.id;
  saveState();
  track('quiz_completed', { outcome: outcome.id });
  showResult(outcome);
}

function showResult(outcome) {
  if (!outcome) {
    resetState();
    el.result.hidden = true;
    el.hero.style.display = '';
    el.quizSection.hidden = true;
    setQuizView(null);
    return;
  }

  el.quizSection.hidden = true;
  el.result.hidden = false;
  setQuizView('result');
  el.resultName.textContent = outcome.name;
  el.resultTeaser.textContent = outcome.teaser;
  const sittingEl = document.getElementById('resultSitting');
  const sittingKey = state.answers.timeline === 'unsure' && state.answers.attempts !== 'first'
    ? 'unsure-resitter'
    : state.answers.timeline;
  if (sittingEl) sittingEl.textContent = SITTING_NOTES[sittingKey] || '';
  el.outcomeField.value = outcome.id;
  if (el.sittingField) el.sittingField.value = state.answers.timeline || '';
  el.subjectField.value = `New quiz lead: ${outcome.name}`;
  el.resultPrimaryCta.textContent = outcome.primaryCta.label;
  el.resultPrimaryCta.href = outcome.primaryCta.url;
  el.resultSecondaryCta.textContent = outcome.secondaryCta.label;
  el.resultSecondaryCta.href = outcome.secondaryCta.url;
  el.resultPlan.innerHTML = outcome.planHtml;

  const productImg = PRODUCT_IMAGES[outcome.id];
  if (productImg && document.getElementById('resultProduct')) {
    document.getElementById('resultProduct').innerHTML = `<img src="${productImg.src}" alt="${productImg.alt}">`;
  }

  if (state.unlocked) unlockResult();

  scrollToBlock(el.result);
}

function unlockResult() {
  state.unlocked = true;
  saveState();
  el.resultLocked.hidden = true;
  el.resultUnlocked.hidden = false;
}

function startQuiz() {
  track('quiz_started');
  el.hero.style.display = 'none';
  el.quizSection.hidden = false;
  el.result.hidden = true;
  setQuizView('quiz');
  renderQuestion();
  scrollToBlock(el.quizSection);
}

function retakeQuiz() {
  resetState();
  el.result.hidden = true;
  el.hero.style.display = 'none';
  el.quizSection.hidden = false;
  setQuizView('quiz');
  renderQuestion();
  scrollToBlock(el.quizSection);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (el.quizSection.hidden) return;
  const q = QUESTIONS[state.index];
  const num = parseInt(e.key, 10);
  if (!isNaN(num) && num >= 1 && num <= q.answers.length) {
    selectAnswer(q.key, q.answers[num - 1].value);
  } else if (e.key === 'Backspace' && state.index > 0) {
    goBack();
  }
});

// Wire up
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  sanitizeState();
  if (el.start) el.start.addEventListener('click', startQuiz);
  if (el.back) el.back.addEventListener('click', goBack);
  if (el.retake) el.retake.addEventListener('click', retakeQuiz);

  // Resume in-progress quiz
  if (state.completed && state.outcomeId) {
    el.hero.style.display = 'none';
    const hasAllAnswers = QUESTIONS.every((question) => state.answers[question.key]);
    const outcome = hasAllAnswers
      ? routeAnswers(state.answers, { cohortOpen: isLiveCohortOpen() })
      : OUTCOMES[state.outcomeId];
    state.outcomeId = outcome ? outcome.id : null;
    saveState();
    showResult(outcome);
  } else if (Object.keys(state.answers).length > 0) {
    startQuiz();
  } else {
    setQuizView(null);
  }
});

// Formspree submission handler
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resultForm');
  if (!form) return;
  const submitBtn = document.getElementById('resultSubmit');
  const btnText = submitBtn?.querySelector('.form-submit__text');
  const btnLoading = submitBtn?.querySelector('.form-submit__loading');
  const errorBox = document.getElementById('resultError');
  const errorText = errorBox?.querySelector('.form-error__text');
  const setSubmitLoading = (isLoading) => {
    if (btnText) btnText.hidden = isLoading;
    if (btnLoading) btnLoading.hidden = !isLoading;
    if (submitBtn) submitBtn.disabled = isLoading;
  };
  const showError = (msg) => {
    if (errorText) errorText.textContent = msg;
    if (errorBox) errorBox.hidden = false;
  };
  const hideError = () => {
    if (errorBox) errorBox.hidden = true;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    setSubmitLoading(true);
    hideError();

    const payload = {
      firstName: String(form.elements.firstName?.value || '').trim(),
      email: String(form.elements.email?.value || '').trim(),
      outcome: String(form.elements.outcome?.value || state.outcomeId || '').trim(),
      sitting: String(form.elements.sitting?.value || state.answers.timeline || '').trim(),
    };
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const leadPayload = { form_id: 'quiz', outcome: state.outcomeId };
        track('generate_lead', leadPayload);
        track('quiz_email_captured', leadPayload);
        unlockResult();
        clearStateStorage();
      } else {
        showError('Something went wrong. Try again or email hello@rohanstutoring.com.');
      }
    } catch (err) {
      showError('Something went wrong. Try again or email hello@rohanstutoring.com.');
    } finally {
      setSubmitLoading(false);
    }
  });
});
