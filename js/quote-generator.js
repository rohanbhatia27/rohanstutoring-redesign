/* ============================================
   QUOTE GENERATOR — quote-generator.js
   Section 2 prompt generator logic
   ============================================ */

const PROMPTS = [
  { text: "Justice delayed is justice denied.", task: "A", theme: "Justice" },
  { text: "Justice is truth in action.", task: "A", theme: "Justice" },
  { text: "Where there is no justice, there is no peace.", task: "A", theme: "Justice" },
  { text: "Justice cannot be for one side alone, but must be for both.", task: "A", theme: "Justice" },
  { text: "Democracy is the worst form of government except all the others.", task: "A", theme: "Democracy" },
  { text: "The ballot is stronger than the bullet.", task: "A", theme: "Democracy" },
  { text: "Progress demands the friction of debate.", task: "A", theme: "Democracy" },
  { text: "Democracy dies in darkness.", task: "A", theme: "Democracy" },
  { text: "Freedom without responsibility is chaos.", task: "A", theme: "Freedom" },
  { text: "The price of freedom is eternal vigilance.", task: "A", theme: "Freedom" },
  { text: "Liberty means responsibility.", task: "A", theme: "Freedom" },
  { text: "Freedom is nothing else but a chance to be better.", task: "A", theme: "Freedom" },
  { text: "Power reveals more than it corrupts.", task: "A", theme: "Power" },
  { text: "Knowledge is power.", task: "A", theme: "Power" },
  { text: "Absolute power corrupts absolutely.", task: "A", theme: "Power" },
  { text: "Power tends to isolate those who hold it.", task: "A", theme: "Power" },
  { text: "Growth begins at the edge of comfort.", task: "B", theme: "Growth" },
  { text: "The biggest room in the world is the room for improvement.", task: "B", theme: "Growth" },
  { text: "Change is the end result of all true learning.", task: "B", theme: "Growth" },
  { text: "What we fear doing most is usually what we most need to do.", task: "B", theme: "Growth" },
  { text: "We become what we repeatedly do.", task: "B", theme: "Habits" },
  { text: "Motivation is what gets you started. Habit is what keeps you going.", task: "B", theme: "Habits" },
  { text: "Successful people are simply those with successful habits.", task: "B", theme: "Habits" },
  { text: "Chains of habit are too light to be felt until they are too heavy to be broken.", task: "B", theme: "Habits" },
  { text: "Failure is tuition, not a verdict.", task: "B", theme: "Resilience" },
  { text: "Fall seven times and stand up eight.", task: "B", theme: "Resilience" },
  { text: "Resilience is knowing that you are the only one that has the power and responsibility to pick yourself up.", task: "B", theme: "Resilience" },
  { text: "Do not judge me by my success, judge me by how many times I fell and got back up again.", task: "B", theme: "Resilience" },
  { text: "Comparison is the thief of joy.", task: "B", theme: "Contentment" },
  { text: "Contentment is not the fulfillment of what you want, but the realization of how much you already have.", task: "B", theme: "Contentment" },
  { text: "He who is contented is rich.", task: "B", theme: "Contentment" },
  { text: "A harvest of peace is produced from a seed of contentment.", task: "B", theme: "Contentment" },
  { text: "Equality is not sameness; it is fairness with teeth.", task: "A", theme: "Equality" },
  { text: "A society's values are revealed by who it protects and who it tolerates.", task: "A", theme: "Equality" },
  { text: "Rights mean little when access is optional.", task: "A", theme: "Equality" },
  { text: "If opportunity is inherited, inequality is engineered.", task: "A", theme: "Equality" },
  { text: "Education should widen horizons, not narrow choices.", task: "A", theme: "Education" },
  { text: "A test can measure knowledge, but it can't measure curiosity.", task: "A", theme: "Education" },
  { text: "When education becomes a commodity, ignorance becomes a tax.", task: "A", theme: "Education" },
  { text: "The purpose of learning is not certainty, but better questions.", task: "A", theme: "Education" },
  { text: "Technology amplifies intentions; it does not replace them.", task: "A", theme: "Technology" },
  { text: "Convenience is never free, it just hides the bill.", task: "A", theme: "Technology" },
  { text: "We built tools to save time, then used them to fill it.", task: "A", theme: "Technology" },
  { text: "A connected world can still be lonely by design.", task: "A", theme: "Technology" },
  { text: "We do not inherit the earth; we borrow it from those who cannot vote yet.", task: "A", theme: "Environment" },
  { text: "Sustainability is the art of living within limits without shrinking our humanity.", task: "A", theme: "Environment" },
  { text: "When the cost is delayed, the damage is guaranteed.", task: "A", theme: "Environment" },
  { text: "Nature keeps receipts.", task: "A", theme: "Environment" },
  { text: "What gets attention gets power.", task: "A", theme: "Media" },
  { text: "A headline can be a weapon disguised as information.", task: "A", theme: "Media" },
  { text: "When outrage becomes entertainment, truth becomes collateral.", task: "A", theme: "Media" },
  { text: "The loudest story is not always the most important.", task: "A", theme: "Media" },
  { text: "Growth is a metric, not a moral.", task: "A", theme: "Economy" },
  { text: "A strong economy means little if it leaves people behind.", task: "A", theme: "Economy" },
  { text: "Wealth is not proof of virtue; poverty is not proof of failure.", task: "A", theme: "Economy" },
  { text: "What we subsidise reveals what we worship.", task: "A", theme: "Economy" },
  { text: "War begins when empathy ends.", task: "A", theme: "War & Peace" },
  { text: "Peace is more than silence; it is safety.", task: "A", theme: "War & Peace" },
  { text: "The first casualty of conflict is complexity.", task: "A", theme: "War & Peace" },
  { text: "A nation's strength is tested by restraint, not rhetoric.", task: "A", theme: "War & Peace" },
  { text: "Public health is politics with consequences.", task: "A", theme: "Health" },
  { text: "Prevention is invisible success.", task: "A", theme: "Health" },
  { text: "A healthcare system is a mirror of collective compassion.", task: "A", theme: "Health" },
  { text: "When treatment depends on wealth, illness becomes a sentence.", task: "A", theme: "Health" },
  { text: "Identity is both chosen and assigned, and the tension matters.", task: "B", theme: "Identity" },
  { text: "To belong is powerful; to be yourself within it is braver.", task: "B", theme: "Identity" },
  { text: "We are shaped by stories we didn't write.", task: "B", theme: "Identity" },
  { text: "Becoming yourself is often unlearning.", task: "B", theme: "Identity" },
  { text: "Ambition is a tool; it can build or burn.", task: "B", theme: "Ambition" },
  { text: "The hunger to prove yourself can starve your peace.", task: "B", theme: "Ambition" },
  { text: "Chasing more is easy; choosing enough is harder.", task: "B", theme: "Ambition" },
  { text: "Success is loud, but fulfillment is quiet.", task: "B", theme: "Ambition" },
  { text: "Integrity is who you are when it costs you.", task: "B", theme: "Integrity" },
  { text: "Character is consistency under pressure.", task: "B", theme: "Integrity" },
  { text: "A clean conscience is a luxury you earn.", task: "B", theme: "Integrity" },
  { text: "Small compromises train big ones.", task: "B", theme: "Integrity" },
  { text: "Fear is a signal, not a sentence.", task: "B", theme: "Fear" },
  { text: "Courage is not confidence; it is action with trembling hands.", task: "B", theme: "Fear" },
  { text: "Avoidance feels safe until it becomes your identity.", task: "B", theme: "Fear" },
  { text: "The life you want sits on the other side of discomfort.", task: "B", theme: "Fear" },
  { text: "Love is not intensity; it is reliability.", task: "B", theme: "Love" },
  { text: "To be loved is to be seen without performance.", task: "B", theme: "Love" },
  { text: "Attachment is easy. Commitment is a craft.", task: "B", theme: "Love" },
  { text: "Love grows best where honesty is safe.", task: "B", theme: "Love" },
  { text: "Purpose is not found; it is built.", task: "B", theme: "Purpose" },
  { text: "Meaning is created in the mundane.", task: "B", theme: "Purpose" },
  { text: "A good life is often a series of small, aligned choices.", task: "B", theme: "Purpose" },
  { text: "Direction matters more than speed.", task: "B", theme: "Purpose" },
  { text: "Loneliness is not the absence of people, but the absence of understanding.", task: "B", theme: "Loneliness" },
  { text: "Sometimes solitude is medicine; sometimes it is a warning.", task: "B", theme: "Loneliness" },
  { text: "We can be surrounded and still feel unseen.", task: "B", theme: "Loneliness" },
  { text: "Connection is quality, not quantity.", task: "B", theme: "Loneliness" },
  { text: "Gratitude is not denial; it is perspective with humility.", task: "B", theme: "Gratitude" },
  { text: "You don't notice the ground until it's gone.", task: "B", theme: "Gratitude" },
  { text: "The ordinary is often the most precious.", task: "B", theme: "Gratitude" },
  { text: "Appreciation turns what we have into enough.", task: "B", theme: "Gratitude" },
  { text: "The saddest aspect of life right now is that science gathers knowledge faster than society gathers wisdom.", task: "A", theme: "Science & Progress" },
  { text: "Our scientific power has outrun our spiritual power. We have guided missiles and misguided men.", task: "A", theme: "Science & Progress" },
  { text: "The greatest obstacle to discovery is not ignorance, but the illusion of knowledge.", task: "A", theme: "Science & Progress" },
  { text: "Science is a way of thinking much more than it is a body of knowledge.", task: "A", theme: "Science & Progress" },
  { text: "Nearly all men can stand adversity, but if you want to test a man's character, give him power.", task: "A", theme: "Leadership" },
  { text: "The price of greatness is responsibility.", task: "A", theme: "Leadership" },
  { text: "A leader is best when people barely know he exists.", task: "A", theme: "Leadership" },
  { text: "The function of leadership is to produce more leaders, not more followers.", task: "A", theme: "Leadership" },
  { text: "Art is not what you see, but what you make others see.", task: "A", theme: "Art & Culture" },
  { text: "A people without the knowledge of their past history, origin and culture is like a tree without roots.", task: "A", theme: "Art & Culture" },
  { text: "Culture does not make people. People make culture.", task: "A", theme: "Art & Culture" },
  { text: "Art enables us to find ourselves and lose ourselves at the same time.", task: "A", theme: "Art & Culture" },
  { text: "Science without religion is lame, religion without science is blind.", task: "A", theme: "Religion & Belief" },
  { text: "Religion is the opium of the people.", task: "A", theme: "Religion & Belief" },
  { text: "I do not feel obliged to believe that the same God who has endowed us with sense, reason and intellect has intended us to forgo their use.", task: "A", theme: "Religion & Belief" },
  { text: "Doubt is not a pleasant condition, but certainty is absurd.", task: "A", theme: "Religion & Belief" },
  { text: "There is enough in the world for everyone's need, but not enough for everyone's greed.", task: "A", theme: "Poverty & Inequality" },
  { text: "Overcoming poverty is not a gesture of charity. It is an act of justice.", task: "A", theme: "Poverty & Inequality" },
  { text: "An imbalance between rich and poor is the oldest and most fatal ailment of all republics.", task: "A", theme: "Poverty & Inequality" },
  { text: "The test of our progress is not whether we add more to the abundance of those who have much; it is whether we provide enough for those who have too little.", task: "A", theme: "Poverty & Inequality" },
  { text: "How you spend your days is how you spend your life.", task: "B", theme: "Time" },
  { text: "Time is what we want most, but what we use worst.", task: "B", theme: "Time" },
  { text: "Lost time is never found again.", task: "B", theme: "Time" },
  { text: "The two most powerful warriors are patience and time.", task: "B", theme: "Time" },
  { text: "Imagination is more important than knowledge.", task: "B", theme: "Creativity" },
  { text: "You can't use up creativity. The more you use, the more you have.", task: "B", theme: "Creativity" },
  { text: "The worst enemy of creativity is self-doubt.", task: "B", theme: "Creativity" },
  { text: "Creativity is the power to connect the seemingly unconnected.", task: "B", theme: "Creativity" },
  { text: "Success is not final; failure is not fatal: it is the courage to continue that counts.", task: "B", theme: "Success" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", task: "B", theme: "Success" },
  { text: "Success usually comes to those who are too busy to be looking for it.", task: "B", theme: "Success" },
  { text: "Try not to become a man of success, but rather try to become a man of value.", task: "B", theme: "Success" },
  { text: "We do not stop playing because we grow old; we grow old because we stop playing.", task: "B", theme: "Aging" },
  { text: "The afternoon of human life must also have a significance of its own, and cannot be merely a pitiful appendage to life's morning.", task: "B", theme: "Aging" },
  { text: "Growing old is mandatory, but growing up is optional.", task: "B", theme: "Aging" },
  { text: "Age is an issue of mind over matter. If you don't mind, it doesn't matter.", task: "B", theme: "Aging" },
  { text: "The weak can never forgive. Forgiveness is the attribute of the strong.", task: "B", theme: "Forgiveness" },
  { text: "To forgive is to set a prisoner free and discover that the prisoner was you.", task: "B", theme: "Forgiveness" },
  { text: "Holding on to anger is like drinking poison and expecting the other person to die.", task: "B", theme: "Forgiveness" },
  { text: "Forgiveness is not an occasional act; it is a constant attitude.", task: "B", theme: "Forgiveness" },
];

document.addEventListener('DOMContentLoaded', () => {
  const $ = (sel) => document.querySelector(sel);
  const els = {
    task: $('#task'),
    theme: $('#theme'),
    gen: $('#genBtn'),
    copy: $('#copyBtn'),
    out: $('#output'),
    chips: $('#chips'),
  };

  if (!els.task || !els.theme || !els.gen || !els.copy || !els.out || !els.chips) return;

  const themesByTask = {
    A: Array.from(new Set(PROMPTS.filter((prompt) => prompt.task === 'A').map((prompt) => prompt.theme))).sort(),
    B: Array.from(new Set(PROMPTS.filter((prompt) => prompt.task === 'B').map((prompt) => prompt.theme))).sort(),
  };
  const allThemes = Array.from(new Set(PROMPTS.map((prompt) => prompt.theme))).sort();

  function setThemeOptions(taskSel) {
    els.theme.innerHTML = '';
    const randomOpt = document.createElement('option');
    randomOpt.value = 'random';
    randomOpt.textContent = 'Random';
    els.theme.appendChild(randomOpt);

    let themesToShow = allThemes;
    if (taskSel === 'A') themesToShow = themesByTask.A;
    if (taskSel === 'B') themesToShow = themesByTask.B;

    themesToShow.forEach((theme) => {
      const opt = document.createElement('option');
      opt.value = theme;
      opt.textContent = theme;
      els.theme.appendChild(opt);
    });

    els.theme.value = 'random';
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function fourForTheme(theme, taskSel) {
    let pool = PROMPTS.filter((prompt) => prompt.theme === theme);
    if (taskSel === 'A') pool = pool.filter((prompt) => prompt.task === 'A');
    if (taskSel === 'B') pool = pool.filter((prompt) => prompt.task === 'B');
    return pool.slice(0, 4);
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function render(prompts, { taskSel, themeSel, chosenTheme }) {
    if (!prompts.length) {
      els.out.innerHTML = '<p class="qg-placeholder">No prompts available for that selection.</p>';
      els.chips.innerHTML = '';
      return;
    }

    els.out.innerHTML = prompts.map((prompt, index) => `
      <div class="qg-quote">
        <span class="qg-quote__num">Prompt ${index + 1}</span>
        <p class="qg-quote__text">${escapeHtml(prompt.text)}</p>
        <div class="qg-quote__tags">
          <span class="qg-chip qg-chip--blue">Task ${prompt.task}</span>
          <span class="qg-chip">${escapeHtml(prompt.theme)}</span>
        </div>
      </div>
    `).join('');

    els.chips.innerHTML = '';
    const summary = [
      taskSel === 'any' ? 'Task A or Task B' : `Task ${taskSel}`,
      themeSel === 'random' ? `Random -> ${chosenTheme}` : chosenTheme,
      '4 prompts',
    ];

    summary.forEach((chip) => {
      const span = document.createElement('span');
      span.className = 'qg-chip';
      span.textContent = chip;
      els.chips.appendChild(span);
    });
  }

  function generate() {
    const taskSel = els.task.value;
    const themeSel = els.theme.value;
    let chosenTheme = themeSel;

    if (themeSel === 'random') {
      if (taskSel === 'A') chosenTheme = pickRandom(themesByTask.A);
      else if (taskSel === 'B') chosenTheme = pickRandom(themesByTask.B);
      else {
        const pickTask = Math.random() < 0.5 ? 'A' : 'B';
        chosenTheme = pickRandom(themesByTask[pickTask]);
      }
    }

    const prompts = fourForTheme(chosenTheme, taskSel);
    render(prompts, { taskSel, themeSel, chosenTheme });
    return prompts;
  }

  function copyOutput() {
    const quotes = els.out.querySelectorAll('.qg-quote__text');
    if (!quotes.length) return;

    const text = Array.from(quotes).map((quote, index) => `${index + 1}. ${quote.textContent}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      els.copy.classList.add('qg-btn--copied');
      els.copy.textContent = 'Copied!';
      setTimeout(() => {
        els.copy.classList.remove('qg-btn--copied');
        els.copy.textContent = 'Copy';
      }, 1500);
    });
  }

  els.gen.addEventListener('click', generate);
  els.copy.addEventListener('click', copyOutput);
  els.task.addEventListener('change', () => {
    setThemeOptions(els.task.value);
    generate();
  });

  setThemeOptions(els.task.value);
  generate();
});
