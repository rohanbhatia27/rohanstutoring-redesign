/* ============================================
   QUIZ: quiz.js
   Path finder state machine + routing + submission
   ============================================ */

const QUESTIONS = [
  {
    key: 'timeline',
    stem: 'When are you sitting the GAMSAT?',
    answers: [
      { value: 'sep-2026', label: 'September 2026' },
      { value: 'mar-2027', label: 'March 2027' },
      { value: 'later', label: 'Later than March 2027' },
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

const STORAGE_KEY = 'rt_quiz_v1';

// Analytics helper — fires GA and PostHog in parallel
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

const OUTCOMES = {
  MASTERY_CALL: {
    id: 'MASTERY_CALL',
    name: 'The Mastery Path',
    teaser: "You've sat this before. You know what doesn't work. The problem is not effort or time. Nobody has looked at your specific score profile and rebuilt your prep around what's actually leaking points. That's what one-to-one coaching is for.",
    planHtml: `
      <p>After multiple attempts, the bottleneck is rarely content. It's that no one has looked at your specific score profile and rebuilt your prep around the actual gaps. Mastery is one-to-one coaching built around you. Below is the structure we'd work through together over 12 weeks.</p>
      <h3>Phase 1: Weeks 1 to 4: Diagnose and rebuild foundations</h3>
      <p class="plan-phase-focus">Weekly focus: one diagnostic mock, targeted weakness work, two essays marked.</p>
      <ol>
        <li>Sit a full timed paper in week 1, then break it down question by question with your tutor.</li>
        <li>Rebuild whichever section is leaking the most points, with structured coaching sessions.</li>
        <li>Establish an essay rhythm: two essays a week, marked, with revision cycles.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Volume under pressure</h3>
      <p class="plan-phase-focus">Weekly focus: 3 to 4 timed mini-papers, continued essay marking, strategy refinement.</p>
      <ol>
        <li>Shift from learning content to executing under time. Mini-papers daily, full mocks weekly.</li>
        <li>Use 1:1 sessions to autopsy each mock, not just review answers.</li>
        <li>Lock in your S2 template so essays become automatic, not agonising.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Sharpen and simulate</h3>
      <p class="plan-phase-focus">Weekly focus: full mock every week, recovery between, no new content.</p>
      <ol>
        <li>Three full mocks in exam conditions. Stop studying new material.</li>
        <li>Refine stamina, nutrition, and the morning-of routine.</li>
        <li>One final 1:1 to walk into the exam with a clear plan for each section.</li>
      </ol>
    `,
    primaryCta: { label: 'Book a free strategy consultation', url: CALENDLY },
    secondaryCta: { label: 'See the Mastery Program', url: '/courses/mastery' },
  },
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
    name: 'The Comprehensive Path',
    teaser: "You've got the time and the hours. The gap is real but closeable. Free resources won't close it. You need live teaching, regular essay feedback, and a structure that keeps you honest across five months.",
    planHtml: `
      <p>A 5+ point jump is realistic, but not through self-study alone. Most students underestimate how much their blind spots cost them, and blind spots don't fix themselves. The Comprehensive Course is built for this exact gap. Here's how your next 12 weeks should look.</p>
      <h3>Phase 1: Weeks 1 to 4: Build the foundations, section by section</h3>
      <p class="plan-phase-focus">Weekly focus: systematic S1 and S3 study, weekly essay, one diagnostic mock.</p>
      <ol>
        <li>Work through S1 humanities methodically, logic, poetry, tone, inference. Two hours a day minimum.</li>
        <li>S3 fundamentals: do not skip chemistry and physics reasoning even if your background is biology.</li>
        <li>Write one essay a week from week one. Do not wait until you feel ready.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Apply under pressure, refine the essay</h3>
      <p class="plan-phase-focus">Weekly focus: timed section drills daily, two essays a week, weekly full mock.</p>
      <ol>
        <li>Stop doing untimed practice. Every question from here has a clock on it.</li>
        <li>Develop a repeatable S2 structure and commit to it for three weeks before changing anything.</li>
        <li>After each mock, spend as long reviewing as you did sitting it.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Exam simulation and taper</h3>
      <p class="plan-phase-focus">Weekly focus: 2 full mocks per fortnight, targeted weakness patching, no new content.</p>
      <ol>
        <li>Simulate exam day start times. Your brain needs to be sharp at 9am, not 9pm.</li>
        <li>Patch only the top three recurring error patterns from your mocks. Ignore the rest.</li>
        <li>In the final week, drop volume by half. Sleep and confidence matter more than one more paper.</li>
      </ol>
    `,
    primaryCta: { label: 'Book a free strategy call', url: CALENDLY },
    secondaryCta: { label: 'See the Comprehensive Course', url: '/courses/comprehensive' },
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
      <p>The biggest predictor of early GAMSAT success is not IQ or background. It's momentum in the first month. The Essentials Playbook gets you from zero to consistent study in 30 days, including your first essay marked. Here is how the next 12 weeks should look from where you are now.</p>
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

function routeAnswers(a) {
  const highHours = a.hours === '5-10' || a.hours === '10-20' || a.hours === '20plus';
  const longRunway = a.timeline === 'sep-2026' || a.timeline === 'mar-2027';
  const earlyPrep = a.current === 'new' || a.current === 'building';
  const hasProgress = a.current === 'building' || a.current === 'mocked' || a.current === 'exam-ready';
  const seriousGoal = a.target === 'realistic' || a.target === 'competitive' || a.target === 'maximise';
  const ambitiousGoal = a.target === 'competitive' || a.target === 'maximise';

  // 1. Clear beginner signals
  if (a.attempts === 'first' && (a.timeline === 'later' || a.timeline === 'unsure')) return OUTCOMES.START_HERE;
  if (a.blocker === 'no-plan' && a.attempts === 'first') return OUTCOMES.START_HERE;
  if (earlyPrep && a.target === 'figuring-out') return OUTCOMES.START_HERE;

  // 2. High-friction re-sitters who need hands-on support
  if (
    a.attempts === 'multi' &&
    hasProgress &&
    (a.blocker === 'plateau' || a.blocker === 'timing' || a.blocker === 'materials') &&
    highHours
  ) {
    return OUTCOMES.MASTERY_CALL;
  }

  // 3. Exam-ready multi-attempters chasing the ceiling
  if (
    a.current === 'exam-ready' &&
    a.target === 'maximise' &&
    a.attempts === 'multi'
  ) {
    return OUTCOMES.MASTERY_CALL;
  }

  // 4. Structured course for students with runway, hours, and a serious goal
  if (
    (hasProgress && seriousGoal && longRunway && highHours) ||
    (a.current === 'new' && longRunway && highHours && ambitiousGoal) ||
    (a.current === 'new' && a.attempts !== 'first' && a.blocker === 'essays' && longRunway && highHours && seriousGoal)
  ) {
    return OUTCOMES.COMPREHENSIVE;
  }

  // 5. S2 pain still defaults to self-paced unless it hit the course rule above
  if (a.section === 's2' && a.blocker === 'essays' && a.target !== 'maximise') {
    return OUTCOMES.BLUEPRINT;
  }

  // 6. Fallback
  return OUTCOMES.BLUEPRINT;
}

// Expose for console testing
window.__quizTest = { routeAnswers, OUTCOMES };

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
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { /* ignore */ }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* quota, ignore */ }
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
  const outcome = routeAnswers(state.answers);
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
  el.outcomeField.value = outcome.id;
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
    showResult(OUTCOMES[state.outcomeId]);
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
        track('quiz_email_captured', { outcome: state.outcomeId });
        unlockResult();
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
