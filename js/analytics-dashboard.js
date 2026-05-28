/* ============================================
   Founder Dashboard — Rohan's GAMSAT
   Pure static dashboard with mock data.

   TODO (live GA4):
     Replace `getDashboardData(rangeDays)` with a fetch
     to a server endpoint (e.g. /api/analytics?range=30)
     that proxies GA4 Data API requests using credentials
     stored only in server env vars. See docs/analytics-dashboard.md.
   ============================================ */

(function () {
  'use strict';

  /* ---------- Mock data generators ---------- */

  function seededRand(seed) {
    let s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function buildTrend(days, base, variance, seed) {
    const rand = seededRand(seed);
    const out = [];
    for (let i = 0; i < days; i++) {
      const wave = Math.sin(i / 5) * variance * 0.4;
      const noise = (rand() - 0.5) * variance;
      const v = Math.max(0, Math.round(base + wave + noise + i * 0.6));
      out.push(v);
    }
    return out;
  }

  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

  function pctDelta(curr, prev) {
    if (!prev) return 0;
    return Math.round(((curr - prev) / prev) * 1000) / 10;
  }

  function fmt(n) {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
    return String(n);
  }

  /* ---------- Data source ---------- */
  // Tries the live GA4 proxy first, falls back to mock data on any failure.
  async function loadDashboardData(range) {
    try {
      const res = await fetch(`/api/analytics?range=${range}`, { credentials: 'same-origin' });
      if (res.ok) {
        return { data: await res.json(), source: 'live', error: null };
      }
      let payload = null;
      try { payload = await res.json(); } catch (_) {}
      return { data: getMockData(range), source: 'mock', error: payload || { status: res.status } };
    } catch (err) {
      return { data: getMockData(range), source: 'mock', error: { message: err.message } };
    }
  }

  /* ---------- Mock dataset (fallback) ---------- */
  function getMockData(range) {
    const trend = buildTrend(range, 110, 60, range * 7);
    const trendPrev = buildTrend(range, 95, 55, range * 11);

    const visitors = sum(trend);
    const visitorsPrev = sum(trendPrev);

    const leads      = Math.round(visitors * 0.058);
    const leadsPrev  = Math.round(visitorsPrev * 0.052);
    const downloads  = Math.round(visitors * 0.041);
    const downloadsP = Math.round(visitorsPrev * 0.038);
    const strategy   = Math.round(visitors * 0.018);
    const strategyP  = Math.round(visitorsPrev * 0.021);
    const checkout   = Math.round(visitors * 0.012);
    const checkoutP  = Math.round(visitorsPrev * 0.010);
    const purchases  = Math.round(visitors * 0.0028);
    const purchasesP = Math.round(visitorsPrev * 0.0024);

    return {
      range,
      trend, trendPrev,

      metrics: [
        { label: 'Visitors',           value: visitors,  prev: visitorsPrev,  spark: trend,
          note: 'Mostly organic + Instagram. Steady upward drift.' },
        { label: 'Leads generated',    value: leads,     prev: leadsPrev,     spark: trend.map(v => Math.round(v * 0.06)),
          note: 'Free resource opt-ins + strategy sessions combined.' },
        { label: 'Resource downloads', value: downloads, prev: downloadsP,    spark: trend.map(v => Math.round(v * 0.045)),
          note: 'S1 Mini Mock leading. Lead magnets are pulling weight.' },
        { label: 'Strategy sessions',  value: strategy,  prev: strategyP,     spark: trend.map(v => Math.round(v * 0.02)),
          note: 'Soft week. Consider an IG push around the next session.' },
        { label: 'Checkout clicks',    value: checkout,  prev: checkoutP,     spark: trend.map(v => Math.round(v * 0.013)),
          note: 'Course page intent is healthy.' },
        { label: 'Course purchases',   value: purchases, prev: purchasesP,    spark: trend.map(v => Math.round(v * 0.003)),
          note: 'Est. from checkout completion events.' },
      ],

      sources: [
        { name: 'Organic search', sessions: Math.round(visitors * 0.42), eng: 71, leads: Math.round(leads * 0.46), best: 'Blog → S1 Mini Mock' },
        { name: 'Instagram',      sessions: Math.round(visitors * 0.21), eng: 48, leads: Math.round(leads * 0.18), best: 'Bio link → /s2-slam-system' },
        { name: 'Direct',         sessions: Math.round(visitors * 0.14), eng: 64, leads: Math.round(leads * 0.16), best: 'Homepage → Course page' },
        { name: 'YouTube',        sessions: Math.round(visitors * 0.09), eng: 58, leads: Math.round(leads * 0.09), best: 'Video desc → S1 Mini Mock' },
        { name: 'Facebook groups',sessions: Math.round(visitors * 0.08), eng: 53, leads: Math.round(leads * 0.07), best: 'Group post → Strategy session' },
        { name: 'Referral',       sessions: Math.round(visitors * 0.06), eng: 62, leads: Math.round(leads * 0.04), best: 'Reddit thread → S1 Tracker' },
      ],

      pages: [
        { title: 'Homepage',                url: '/',                       views: Math.round(visitors * 0.34), time: '1:42', ctr: 14.1, conv: 4.8, status: 'good' },
        { title: 'Comprehensive Course',    url: '/courses/comprehensive',  views: Math.round(visitors * 0.12), time: '2:18', ctr: 9.2,  conv: 6.4, status: 'good' },
        { title: 'S1 Mini Mock',            url: '/s1-mock.html',           views: Math.round(visitors * 0.09), time: '3:01', ctr: 22.4, conv: 11.8, status: 'great' },
        { title: 'S2 Slam System',          url: '/s2-slam-system.html',    views: Math.round(visitors * 0.08), time: '2:34', ctr: 17.6, conv: 8.5, status: 'good' },
        { title: 'S1 Question Tracker',     url: '/section-1-tracker.html', views: Math.round(visitors * 0.07), time: '2:11', ctr: 12.9, conv: 5.2, status: 'okay' },
        { title: 'Free Resources Hub',      url: '/courses.html',           views: Math.round(visitors * 0.11), time: '1:08', ctr: 6.4,  conv: 2.1, status: 'attention' },
        { title: 'Strategy Session Landing', url: '/book',                  views: Math.round(visitors * 0.05), time: '1:54', ctr: 11.8, conv: 7.3, status: 'good' },
        { title: 'Checkout',                url: '/checkout/',              views: Math.round(visitors * 0.014),time: '0:58', ctr: 38.0, conv: 23.0, status: 'great' },
        { title: 'Blog — Top GAMSAT post',  url: '/blog/',                  views: Math.round(visitors * 0.06), time: '2:42', ctr: 3.1,  conv: 0.9, status: 'attention' },
      ],

      magnets: [
        { name: 'S1 Mini Mock',         views: Math.round(visitors * 0.09), signups: Math.round(visitors * 0.018), rec: 'Promote more. Best converter by a wide margin.' },
        { name: 'S2 Slam System',       views: Math.round(visitors * 0.08), signups: Math.round(visitors * 0.012), rec: 'Steady. Add it to the homepage hero rotation.' },
        { name: 'S1 Question Tracker',  views: Math.round(visitors * 0.07), signups: Math.round(visitors * 0.008), rec: 'Strong intent — tighten the form (3 fields max).' },
        { name: 'Quote Generator',      views: Math.round(visitors * 0.05), signups: Math.round(visitors * 0.003), rec: 'Low pull. Repurpose into a calculator with email gate.' },
      ],

      winners: [
        { label: 'S1 Mini Mock landing',          metric: '11.8% conv  9% traffic' },
        { label: 'Checkout page',                  metric: '23% conv  1.4% traffic' },
        { label: '/blog/ → "GAMSAT timing" post',  metric: '8.6% conv  1.1% traffic' },
      ],

      traps: [
        { label: 'Free Resources Hub',            metric: '11% traffic  2.1% conv' },
        { label: '/blog/ — top SEO post',          metric: '6% traffic  0.9% conv' },
        { label: 'About page',                     metric: '4% traffic  0.4% conv' },
      ],

      // Tracking events that should exist but aren't reliably firing yet.
      // TODO: confirm against the live GA4 event list and remove anything that's already wired.
      gaps: [
        { name: 'checkout_start',       why: 'Distinguish browsers from buyers. Currently only checkout_click is tracked.' },
        { name: 'free_resource_download', why: 'Right now we only see opt-in form submits, not actual PDF/file clicks.' },
        { name: 'strategy_call_click',  why: 'High-intent CTA but no event — we cannot attribute it to a source.' },
        { name: 'outbound_click',       why: 'YouTube and Instagram exits are invisible. Add for content attribution.' },
        { name: 'lead_form_submit',     why: 'Generic name across all forms makes funnel comparison messy.' },
      ],
    };
  }

  /* ---------- Renderers ---------- */

  const STRATEGY_SESSION_MANUAL = 50; // pre-tracking signups 15-16 May, before Calendly wiring

  function renderMetrics(data) {
    const root = document.getElementById('metricCards');
    root.innerHTML = data.metrics.map(m => {
      const isStrategySession = m.label === 'Strategy sessions';
      const displayValue = isStrategySession ? m.value + STRATEGY_SESSION_MANUAL : m.value;
      const delta = pctDelta(displayValue, m.prev);
      const deltaCls = delta > 1 ? 'metric__delta--up'
                      : delta < -1 ? 'metric__delta--down'
                      : 'metric__delta--flat';
      const arrow = delta > 1 ? '▲' : delta < -1 ? '▼' : '–';
      const strategySessionBadge = isStrategySession
        ? `<div class="metric__annotation">+${STRATEGY_SESSION_MANUAL} pre-tracking &middot; Resitter's Workshop  24 May  50/100 spots</div>`
        : '';
      return `
        <div class="metric">
          <div class="metric__label">${m.label}</div>
          <div class="metric__value">${fmt(displayValue)}</div>
          <div class="metric__row">
            <span class="metric__delta ${deltaCls}">${arrow} ${Math.abs(delta)}%</span>
            <span class="card__hint">vs previous ${data.range}d</span>
          </div>
          <div class="metric__note">${m.note}</div>
          ${strategySessionBadge}
          <div class="metric__spark">${sparkSvg(m.spark, delta >= 0)}</div>
        </div>`;
    }).join('');
  }

  function sparkSvg(values, positive) {
    const w = 200, h = 28;
    const max = Math.max(...values, 1);
    const step = w / (values.length - 1 || 1);
    const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ');
    const stroke = positive ? 'var(--d-blue)' : 'var(--d-orange)';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" points="${points}" />
    </svg>`;
  }

  function renderTrend(data) {
    const svg = document.getElementById('trendChart');
    const w = 600, h = 200, pad = 8;
    const all = data.trend.concat(data.trendPrev);
    const max = Math.max(...all, 1);
    const step = (w - pad * 2) / (data.trend.length - 1 || 1);
    const toPath = arr => arr.map((v, i) =>
      `${(pad + i * step).toFixed(1)},${(h - pad - (v / max) * (h - pad * 2)).toFixed(1)}`
    ).join(' ');

    const curr = toPath(data.trend);
    const prev = toPath(data.trendPrev);
    const area = `M ${pad},${h - pad} L ${curr} L ${w - pad},${h - pad} Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#6FB6F0" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#6FB6F0" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#trendFill)" />
      <polyline points="${prev}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-dasharray="4 4" stroke-width="1.5" />
      <polyline points="${curr}" fill="none" stroke="#6FB6F0" stroke-width="2.2" stroke-linejoin="round" />
    `;

    const total = sum(data.trend);
    const totalPrev = sum(data.trendPrev);
    const delta = pctDelta(total, totalPrev);
    document.getElementById('trendSummary').textContent =
      `${fmt(total)} visitors  ${delta >= 0 ? '+' : ''}${delta}% vs previous`;
    document.getElementById('trendNote').textContent = delta >= 5
      ? 'Trajectory looks healthy. Double down on the channel driving growth — see Traffic sources.'
      : delta <= -5
        ? 'Visitor count is softening. Check organic rankings and posting cadence.'
        : 'Mostly flat. Worth running one growth experiment this week.';
  }

  function renderSources(data) {
    const tbody = document.querySelector('#sourcesTable tbody');
    const totalSessions = sum(data.sources.map(s => s.sessions));
    tbody.innerHTML = data.sources.map(s => {
      const conv = totalSessions ? Math.round((s.leads / s.sessions) * 1000) / 10 : 0;
      const badge = conv >= 6 ? 'badge--good'
                   : conv >= 3 ? '' : 'badge--warn';
      const label = conv >= 6 ? 'Strong' : conv >= 3 ? 'Steady' : 'Low-converting';
      return `<tr>
        <td><strong>${s.name}</strong></td>
        <td class="num">${fmt(s.sessions)}</td>
        <td class="num">${s.eng}%</td>
        <td class="num">${fmt(s.leads)}</td>
        <td class="num">${conv}%</td>
        <td><span class="badge ${badge}">${label}</span> ${s.best}</td>
      </tr>`;
    }).join('');
  }

  function renderFunnel(data) {
    const visitors = sum(data.trend);
    const leads = data.metrics.find(m => m.label === 'Leads generated').value;
    const checkout = data.metrics.find(m => m.label === 'Checkout clicks').value;
    const purchases = data.metrics.find(m => m.label === 'Course purchases').value;

    const stages = [
      { label: 'Visitors',         value: visitors },
      { label: 'Lead / signup',    value: leads },
      { label: 'Checkout click',   value: checkout },
      { label: 'Purchase',         value: purchases },
    ];
    const max = stages[0].value || 1;

    const root = document.getElementById('funnel');
    root.innerHTML = stages.map((s, i) => {
      const w = Math.max(8, (s.value / max) * 100);
      const drop = i > 0
        ? `<div class="funnel__drop">↓ ${Math.round((1 - s.value / stages[i - 1].value) * 100)}% drop-off</div>`
        : '';
      return `${drop}
        <div class="funnel__row">
          <div class="funnel__label">${s.label}</div>
          <div class="funnel__bar" style="width:${w}%"></div>
          <div class="funnel__value">${fmt(s.value)}</div>
        </div>`;
    }).join('');

    const leadToCheckout = leads ? Math.round((checkout / leads) * 100) : 0;
    document.getElementById('funnelNote').textContent =
      `Biggest leak: lead → checkout click (${leadToCheckout}% pass-through). Add a follow-up sequence with a single clear CTA back to the course page.`;
  }

  function renderMagnets(data) {
    const tbody = document.querySelector('#magnetsTable tbody');
    tbody.innerHTML = data.magnets.map(m => {
      const conv = m.views ? Math.round((m.signups / m.views) * 1000) / 10 : 0;
      const badge = conv >= 18 ? 'badge--good'
                   : conv >= 10 ? '' : 'badge--warn';
      const label = conv >= 18 ? 'Best converter' : conv >= 10 ? 'Solid' : 'Underperforming';
      return `<tr>
        <td><strong>${m.name}</strong></td>
        <td class="num">${fmt(m.views)}</td>
        <td class="num">${fmt(m.signups)}</td>
        <td class="num">${conv}%</td>
        <td><span class="badge ${badge}">${label}</span> ${m.rec}</td>
      </tr>`;
    }).join('');
  }

  function renderPages(data) {
    const tbody = document.querySelector('#pagesTable tbody');
    const statusMap = {
      great:     { cls: 'badge--good', txt: 'Strong performer' },
      good:      { cls: 'badge--good', txt: 'Healthy' },
      okay:      { cls: '', txt: 'Steady' },
      attention: { cls: 'badge--warn', txt: 'Needs attention' },
      poor:      { cls: 'badge--bad',  txt: 'High traffic, low conv' },
    };
    tbody.innerHTML = data.pages.map(p => {
      const s = statusMap[p.status] || statusMap.okay;
      return `<tr>
        <td>
          <div class="tbl__page">
            <span class="tbl__page-title">${p.title}</span>
            <span class="tbl__page-url">${p.url}</span>
          </div>
        </td>
        <td class="num">${fmt(p.views)}</td>
        <td class="num">${p.time}</td>
        <td class="num">${p.ctr}%</td>
        <td class="num">${p.conv}%</td>
        <td><span class="badge ${s.cls}">${s.txt}</span></td>
      </tr>`;
    }).join('');
  }

  function renderSignals(data) {
    const win = document.getElementById('winnersList');
    const trap = document.getElementById('trapsList');
    win.innerHTML  = data.winners.map(w => `<li><strong>${w.label}</strong><span>${w.metric}</span></li>`).join('');
    trap.innerHTML = data.traps.map(t   => `<li><strong>${t.label}</strong><span>${t.metric}</span></li>`).join('');
  }

  function renderGaps(data) {
    document.getElementById('gapsList').innerHTML = data.gaps.map(g => `
      <li>
        <div class="gaps__head">
          <span class="gaps__name">${g.name}</span>
          <span class="badge badge--warn">Missing</span>
        </div>
        <div class="gaps__why">${g.why}</div>
      </li>`).join('');
  }

  function renderActions(data) {
    // Simple rules over the mock data, easy to replace with real-data logic later.
    const actions = [];

    const miniMock = data.magnets.find(m => m.name === 'S1 Mini Mock');
    if (miniMock) {
      const conv = (miniMock.signups / Math.max(1, miniMock.views)) * 100;
      actions.push({
        title: 'Promote the S1 Mini Mock harder',
        body: `It converts at ${conv.toFixed(1)}% — best of all lead magnets. Add it above the fold on the homepage and pin it on Instagram.`,
      });
    }

    const ig = data.sources.find(s => s.name === 'Instagram');
    if (ig && (ig.leads / ig.sessions) * 100 < 4) {
      actions.push({
        title: 'Fix the Instagram → lead drop',
        body: 'Instagram is driving traffic but converting below 4%. Send IG visitors to a dedicated landing page, not the homepage.',
      });
    }

    const resHub = data.pages.find(p => p.url === '/courses.html');
    if (resHub && resHub.conv < 4) {
      actions.push({
        title: 'Rework the Free Resources Hub CTAs',
        body: `${resHub.views.toLocaleString()} views but only ${resHub.conv}% convert. One primary CTA per card and clearer outcome copy.`,
      });
    }

    actions.push({
      title: 'Add the missing tracking events',
      body: 'Without checkout_start and strategy_call_click, half the funnel is invisible. See Tracking gaps below.',
    });

    actions.push({
      title: 'Repurpose the top blog post into a lead magnet',
      body: 'The top SEO post pulls traffic but only 0.9% convert. Wrap its checklist as a downloadable to flip that.',
    });

    document.getElementById('actionsList').innerHTML = actions.slice(0, 5).map((a, i) => `
      <li>
        <div class="actions__num">${i + 1}</div>
        <div class="actions__body">
          <strong>${a.title}</strong>
          <p>${a.body}</p>
        </div>
      </li>`).join('');
  }

  /* ---------- Wire up ---------- */

  async function renderAll(range) {
    const updated = document.getElementById('lastUpdated');
    updated.textContent = 'Loading…';

    const { data, source, error } = await loadDashboardData(range);
    renderActions(data);
    renderMetrics(data);
    renderTrend(data);
    renderSources(data);
    renderFunnel(data);
    renderMagnets(data);
    renderPages(data);
    renderSignals(data);
    renderGaps(data);
    renderConnectionStatus(source, error);

    const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    updated.textContent = `${source === 'live' ? 'Live GA4' : 'Mock data'}  ${today}`;
  }

  function renderConnectionStatus(source, error) {
    let banner = document.getElementById('connBanner');
    if (source === 'live') {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'connBanner';
      banner.className = 'conn-banner';
      const main = document.querySelector('.dash__main');
      main.insertBefore(banner, main.firstChild);
    }
    if (error) console.error('[dashboard] live GA4 unavailable:', error);
    const isAuth = error && (error.error === 'not_connected' || error.error === 'token_refresh_failed');
    const baseReason = isAuth
      ? (error.message || 'Google Analytics is not connected.')
      : (error && error.message) || 'Showing mock data — live GA4 unavailable.';
    const reason = !isAuth && error && error.detail
      ? `${baseReason} (${error.detail})`
      : baseReason;
    banner.innerHTML = `
      <div>
        <strong>${isAuth ? 'Connect Google Analytics' : 'Showing mock data'}</strong>
        <span>${reason}</span>
      </div>
      <a class="conn-banner__btn" href="/api/analytics?action=connect">
        ${isAuth ? 'Connect Google' : 'Reconnect'}
      </a>`;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const buttons = document.querySelectorAll('.seg__btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderAll(parseInt(btn.dataset.range, 10));
      });
    });

    renderAll(30);
  });
})();
