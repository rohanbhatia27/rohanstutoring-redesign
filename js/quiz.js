/* ============================================
   QUIZ: quiz.js
   Path finder state machine + routing + submission
   ============================================ */

const QUESTIONS = [
  {
    key: 'timeline',
    stem: 'When are you sitting the GAMSAT?',
    answers: [
      { value: 'sep-2026', label: 'September 2026 (5 months out)' },
      { value: 'mar-2027', label: 'March 2027 (about 11 months out)' },
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
    stem: 'Where are you scoring right now, in practice or in the real thing?',
    answers: [
      { value: 'untested', label: 'I have not done a full practice yet' },
      { value: 'sub55', label: 'Below 55' },
      { value: '55-60', label: '55 to 60' },
      { value: '60-64', label: '60 to 64' },
      { value: '65plus', label: '65 or above' },
    ],
  },
  {
    key: 'target',
    stem: 'What score do you need?',
    answers: [
      { value: '60', label: 'Around 60, a safe pass' },
      { value: '63-65', label: '63 to 65, competitive' },
      { value: '65-68', label: '65 to 68, top-tier' },
      { value: '68plus', label: '68 or above, elite' },
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

// Analytics helper: no-op until GA is installed
const track = (event, params = {}) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
};

console.log('[quiz] loaded, questions:', QUESTIONS.length);

const CALENDLY = 'https://calendly.com/rohansgamsat/gamsat-strategy-consultation';

const OUTCOMES = {
  MASTERY_CALL: {
    id: 'MASTERY_CALL',
    name: 'The Mastery Path',
    teaser: "You've sat this before. You know what doesn't work. You're not short on motivation or time, you're short on a system built around you. The path forward isn't another course, it's one-to-one coaching with accountability baked in.",
    planHtml: `
      <p>When you've already sat the GAMSAT more than once and you're still chasing a serious jump, the bottleneck almost never is content. It's diagnosis. You need someone who can look at your specific score profile, the way you think, the way you write, and build the next 12 weeks around your actual gaps. That's what Mastery is for. What follows is the structure we'd work through together, so you can see exactly what the next three months look like.</p>
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
    primaryCta: { label: 'Book your strategy consultation', url: CALENDLY },
    secondaryCta: { label: 'See the Mastery Program', url: '/courses/mastery' },
  },
  COMPREHENSIVE: {
    id: 'COMPREHENSIVE',
    name: 'The Comprehensive Path',
    teaser: "You've got the runway, you've got the hours, and you've got a real gap to close. What you need isn't more free resources, it's a full system with live teaching, essay feedback, and someone driving the bus for the next five months.",
    planHtml: `
      <p>A 5+ point jump is absolutely doable, but only if the structure is right. Most students trying this self-study underestimate how much their own blind spots cost them. The Comprehensive Course exists because that's the exact gap it's built to close. Here's how your next 12 weeks should look, whether you take the course or not.</p>
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
    primaryCta: { label: 'See the Comprehensive Course', url: '/courses/comprehensive' },
    secondaryCta: { label: 'Book a 15-min chat first', url: CALENDLY },
  },
  ELITE_EXCELLENCE: {
    id: 'ELITE_EXCELLENCE',
    name: 'The Elite Excellence Path',
    teaser: "You're already in the top bracket. The leap from 65 to the top 5% isn't more content, it's sharper strategy, cleaner S2 writing, and eliminating the last handful of costly patterns. You need a course built for where you already are, not a rerun of the basics.",
    planHtml: `
      <p>At 65+, most general GAMSAT courses waste your time. You already know the content. What separates 65 from the top 5% is the compounding of small strategy wins across all three sections, plus an S2 that stops scoring in the 70s and starts scoring in the 80s. The Elite Excellence Course is built for exactly this leap. Here's the 12-week structure that bridges the gap.</p>
      <h3>Phase 1: Weeks 1 to 4: Autopsy your ceiling</h3>
      <p class="plan-phase-focus">Weekly focus: one full mock, granular error analysis, 1 advanced essay per week.</p>
      <ol>
        <li>Identify the exact question types you're losing points on. It's almost never random.</li>
        <li>Stop doing standard practice. Move to elite-level S1 questions and advanced S3 reasoning.</li>
        <li>Study high-scoring essays, do not just write more of your own.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Compound the edge</h3>
      <p class="plan-phase-focus">Weekly focus: elite-level drills, 2 essays weekly with focus on expression.</p>
      <ol>
        <li>Stretch your S1 depth: inference, tone, layered meaning. The top-tier questions reward nuance.</li>
        <li>In S3, work on speed not knowledge. Your bottleneck is time allocation, not content.</li>
        <li>Refine your S2 voice. Your structure is probably fine; your sentences are not.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Peak and protect</h3>
      <p class="plan-phase-focus">Weekly focus: one mock per week, strategic rest, micro-refinement.</p>
      <ol>
        <li>Do fewer, better mocks. Over-practising at your level causes regression.</li>
        <li>Protect sleep, protect confidence. You're optimising a 90th percentile brain.</li>
        <li>Walk into the exam planning to score 70+, not planning to avoid mistakes.</li>
      </ol>
    `,
    primaryCta: { label: 'See the Elite Excellence Course', url: '/courses/advanced' },
    secondaryCta: { label: 'Join the free Sunday webinar', url: '/webinar' },
  },
  BLUEPRINT: {
    id: 'BLUEPRINT',
    name: 'The Blueprint Path',
    teaser: "You're self-directed, you've got reasonable time, and you want a complete system without live-class constraints. Blueprint is 80 hours of structured content you can run at your own pace, and it's the most popular course for a reason.",
    planHtml: `
      <p>Most students do not need live classes. They need clear content, a realistic schedule, and the discipline to actually follow it. That's what Blueprint is built for, 80 hours covering S1 and S2 mastery, advanced strategy, and the Expert Essay Collection, with lifetime access so your pace is your pace. Here's the structure to plug it into.</p>
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
    secondaryCta: { label: 'Join the free Sunday webinar', url: '/webinar' },
  },
  ESSAY_ACCELERATOR: {
    id: 'ESSAY_ACCELERATOR',
    name: 'The Essay Accelerator',
    teaser: "S1 and S3 are not your problem. Your writing is. And S2 is the single most fixable section in the GAMSAT once you see what a top-scoring essay actually looks like from the inside.",
    planHtml: `
      <p>S2 has the steepest score curve in the GAMSAT. Most students never see 25 essays that actually scored above 80, broken down with commentary on structure, language, and thinking. The Expert Essay Collection fixes that gap for $79. Here's how to use it alongside your existing study.</p>
      <h3>Phase 1: Weeks 1 to 4: Re-learn what good looks like</h3>
      <p class="plan-phase-focus">Weekly focus: study 3 to 4 essays from the Collection, write 1 essay.</p>
      <ol>
        <li>Read high-scoring essays before you write more of your own. Pattern-match first.</li>
        <li>Identify the 2 or 3 structural moves that appear across most top essays.</li>
        <li>Write one essay a week using a single borrowed structure. Do not invent.</li>
      </ol>
      <h3>Phase 2: Weeks 5 to 9: Build your own voice on a proven frame</h3>
      <p class="plan-phase-focus">Weekly focus: 2 essays per week, self-marked against the Collection.</p>
      <ol>
        <li>Lock in a template. Any template. Consistency beats creativity at this stage.</li>
        <li>Every essay gets reviewed against a Collection essay with a similar theme.</li>
        <li>If you can, submit at least one for marking, external feedback catches what you cannot.</li>
      </ol>
      <h3>Phase 3: Weeks 10 to 12: Refine language, not structure</h3>
      <p class="plan-phase-focus">Weekly focus: one essay per week, heavy revision, read-alouds.</p>
      <ol>
        <li>Stop changing your structure. At this point it's language work only.</li>
        <li>Read your essays aloud. If a sentence trips you, cut it.</li>
        <li>Practice quote integration from memory, the Quote Generator is free on the site.</li>
      </ol>
    `,
    primaryCta: { label: 'Get the Expert Essay Collection', url: '/courses/essay-collection' },
    secondaryCta: { label: 'Add a one-off essay marking', url: '/courses/essay-marking' },
  },
  START_HERE: {
    id: 'START_HERE',
    name: 'The Start Here Path',
    teaser: "You're early. That's actually the best possible position to be in, as long as you don't waste it. What you need right now isn't a big course, it's a 30-day kickstart that turns 'I'll study soon' into 'I'm studying'.",
    planHtml: `
      <p>The biggest predictor of GAMSAT success is not IQ, not background, not raw hours. It's momentum in the first month. The Essentials Playbook is built to get you from zero to consistent study in 30 days, including your first essay marked. Here's how the next 12 weeks should unfold for someone in your position.</p>
      <h3>Phase 1: Weeks 1 to 4: Build the habit, not the knowledge</h3>
      <p class="plan-phase-focus">Weekly focus: follow the Playbook's 30-day plan exactly, no improvisation.</p>
      <ol>
        <li>Study every weekday, even if only 30 minutes. Consistency over volume.</li>
        <li>Write and submit your first essay by week 2. It does not matter how it scores.</li>
        <li>Attend one Sunday webinar to see how the full system fits together.</li>
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
        <li>If you're not sure, book a free 15-minute chat to get a straight recommendation.</li>
      </ol>
    `,
    primaryCta: { label: 'Start with the Essentials Playbook', url: '/courses/starter-pack' },
    secondaryCta: { label: 'Join the free Sunday webinar', url: '/webinar' },
  },
};

const CURRENT_SCORE = { untested: 55, sub55: 50, '55-60': 57, '60-64': 62, '65plus': 66 };
const TARGET_SCORE  = { '60': 60, '63-65': 64, '65-68': 66.5, '68plus': 69 };

function routeAnswers(a) {
  const current = CURRENT_SCORE[a.current];
  const target = TARGET_SCORE[a.target];
  const gap = target - current;
  const highHours = a.hours === '10-20' || a.hours === '20plus';
  const longRunway = a.timeline === 'sep-2026' || a.timeline === 'mar-2027';

  // 1. Hot re-sitter with capacity
  if (a.attempts === 'multi' && gap >= 5 && highHours) return OUTCOMES.MASTERY_CALL;

  // 2. Already high scorer chasing top tier
  if (a.current === '65plus' && (a.target === '65-68' || a.target === '68plus')) return OUTCOMES.ELITE_EXCELLENCE;

  // 3. Serious gap with runway and hours
  if (gap >= 5 && longRunway && highHours) return OUTCOMES.COMPREHENSIVE;

  // 4. S2-only pain
  if (a.section === 's2' && a.blocker === 'essays' && gap <= 4) return OUTCOMES.ESSAY_ACCELERATOR;

  // 5. Early-stage signals
  if (a.attempts === 'first' && (a.timeline === 'later' || a.timeline === 'unsure')) return OUTCOMES.START_HERE;
  if (a.hours === 'sub5') return OUTCOMES.START_HERE;
  if (a.blocker === 'no-plan' && a.attempts === 'first') return OUTCOMES.START_HERE;

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
  const pct = Math.round((state.index / total) * 100);
  el.progressBar.style.setProperty('--progress', pct + '%');
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
  el.quizSection.hidden = true;
  el.result.hidden = false;
  el.resultName.textContent = outcome.name;
  el.resultTeaser.textContent = outcome.teaser;
  el.outcomeField.value = outcome.id;
  el.subjectField.value = `New quiz lead: ${outcome.name}`;
  el.resultPrimaryCta.textContent = outcome.primaryCta.label;
  el.resultPrimaryCta.href = outcome.primaryCta.url;
  el.resultSecondaryCta.textContent = outcome.secondaryCta.label;
  el.resultSecondaryCta.href = outcome.secondaryCta.url;
  el.resultPlan.innerHTML = outcome.planHtml;

  if (state.unlocked) unlockResult();

  el.result.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  renderQuestion();
  el.quizSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function retakeQuiz() {
  resetState();
  el.result.hidden = true;
  el.hero.style.display = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (el.start) el.start.addEventListener('click', startQuiz);
  if (el.back) el.back.addEventListener('click', goBack);
  if (el.retake) el.retake.addEventListener('click', retakeQuiz);

  // Resume in-progress quiz
  if (state.completed && state.outcomeId) {
    el.hero.style.display = 'none';
    showResult(OUTCOMES[state.outcomeId]);
  } else if (Object.keys(state.answers).length > 0) {
    startQuiz();
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
  const showError = (msg) => {
    if (errorText) errorText.textContent = msg;
    errorBox.style.display = 'flex';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn.disabled) return;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    submitBtn.disabled = true;
    errorBox.style.display = 'none';

    const data = new FormData(form);
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' },
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
      btnText.style.display = 'inline';
      btnLoading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
});
