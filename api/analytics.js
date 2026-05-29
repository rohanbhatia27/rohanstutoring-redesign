'use strict';

const {
  buildAuthUrl,
  exchangeCodeForTokens,
  setRefreshTokenCookie,
  readRefreshToken,
  refreshAccessToken,
  clearRefreshTokenCookie,
} = require('./_lib/_ga4-auth.js');

const { Resend } = require('resend');
const { generateWeeklyInsights, compactDashboard } = require('./_lib/_insights.js');

const GA_API = 'https://analyticsdata.googleapis.com/v1beta';

// Default event-name buckets. Override with env vars (comma-separated)
// to match whatever event names you actually fire from the site.
const EVENT_BUCKETS = {
  lead:      (process.env.GA4_LEAD_EVENTS      || 'generate_lead,lead_form_submit,email_signup,sign_up').split(','),
  download:  (process.env.GA4_DOWNLOAD_EVENTS  || 'free_resource_download,file_download').split(','),
  strategy:  (process.env.GA4_STRATEGY_SESSION_EVENTS || 'strategy_session_signup,strategy_call_click').split(','),
  checkout:  (process.env.GA4_CHECKOUT_EVENTS  || 'begin_checkout,checkout_click,checkout_start').split(','),
  purchase:  (process.env.GA4_PURCHASE_EVENTS  || 'purchase').split(','),
};

function parseRange(raw) {
  const m = String(raw || '30d').match(/^(\d+)d?$/);
  const days = m ? Math.min(365, Math.max(1, parseInt(m[1], 10))) : 30;
  return days;
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function runBatchReports(propertyId, accessToken, requests) {
  const res = await fetch(`${GA_API}/properties/${propertyId}:batchRunReports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`GA4 API error (${res.status}): ${body}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return json.reports || [];
}

function rowsToObjects(report) {
  const dims = (report.dimensionHeaders || []).map((h) => h.name);
  const mets = (report.metricHeaders || []).map((h) => h.name);
  return (report.rows || []).map((r) => {
    const o = {};
    dims.forEach((n, i) => { o[n] = r.dimensionValues[i].value; });
    mets.forEach((n, i) => { o[n] = Number(r.metricValues[i].value); });
    return o;
  });
}

function totalsToObject(report) {
  const mets = (report.metricHeaders || []).map((h) => h.name);
  const t = (report.totals && report.totals[0]) || null;
  if (!t) return {};
  const o = {};
  mets.forEach((n, i) => { o[n] = Number(t.metricValues[i].value); });
  return o;
}

function sumEventCounts(rows, eventNames) {
  const set = new Set(eventNames.map((s) => s.trim()).filter(Boolean));
  return rows
    .filter((r) => set.has(r.eventName))
    .reduce((s, r) => s + (r.eventCount || 0), 0);
}

function deltaPct(curr, prev) {
  if (!prev) return 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function classifySource(conv) {
  if (conv >= 6) return { cls: 'good', label: 'Strong' };
  if (conv >= 3) return { cls: '', label: 'Steady' };
  return { cls: 'warn', label: 'Low-converting' };
}

async function buildDashboard(propertyId, accessToken, days) {
  const today = isoDaysAgo(0);
  const startCurr = isoDaysAgo(days);
  const startPrev = isoDaysAgo(days * 2);
  const endPrev = isoDaysAgo(days + 1);

  const dateRangeCurr = { startDate: startCurr, endDate: today };
  const dateRangePrev = { startDate: startPrev, endDate: endPrev };

  // Daily trend (current + previous). GA4 automatically adds a dateRange
  // dimension column to rows when multiple dateRanges are present.
  const reqTrend = {
    dateRanges: [dateRangeCurr, dateRangePrev],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  };

  // Event counts (current + previous) for funnel + headline metrics.
  const reqEvents = {
    dateRanges: [dateRangeCurr, dateRangePrev],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    limit: 200,
  };

  // Traffic sources (current period only).
  const reqSources = {
    dateRanges: [dateRangeCurr],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'keyEvents' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  };

  // Pages.
  const reqPages = {
    dateRanges: [dateRangeCurr],
    dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'keyEvents' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 12,
  };

  // Totals (visitors, sessions, key events) for current and previous.
  const reqTotals = {
    dateRanges: [dateRangeCurr, dateRangePrev],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' },
      { name: 'keyEvents' },
    ],
  };

  // Per-page lead/download event counts — used for magnets table.
  // Queries pagePath × eventName so we get actual event counts regardless of
  // whether those events are marked as key events in GA4 admin.
  const magnetEventNames = [
    ...EVENT_BUCKETS.lead,
    ...EVENT_BUCKETS.download,
  ].filter(Boolean);
  const reqMagnetEvents = {
    dateRanges: [dateRangeCurr],
    dimensions: [{ name: 'pagePath' }, { name: 'eventName' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        inListFilter: { values: magnetEventNames },
      },
    },
    limit: 200,
  };

  // GA4 caps batchRunReports at 5 reports per call, so split into two batches.
  const [batchA, batchB] = await Promise.all([
    runBatchReports(propertyId, accessToken, [reqTrend, reqEvents, reqSources, reqPages]),
    runBatchReports(propertyId, accessToken, [reqTotals, reqMagnetEvents]),
  ]);
  const reports = [...batchA, ...batchB];

  const [trendR, eventsR, sourcesR, pagesR, totalsR, magnetEventsR] = reports;

  // ---- Trend (split by dateRange dimension value) ----
  const trendRows = rowsToObjects(trendR);
  const trendCurr = trendRows.filter((r) => r.dateRange === 'date_range_0').map((r) => r.activeUsers);
  const trendPrev = trendRows.filter((r) => r.dateRange === 'date_range_1').map((r) => r.activeUsers);

  // ---- Event counts ----
  const eventRows = rowsToObjects(eventsR);
  const evRowsCurr = eventRows.filter((r) => r.dateRange === 'date_range_0');
  const evRowsPrev = eventRows.filter((r) => r.dateRange === 'date_range_1');

  const leads      = sumEventCounts(evRowsCurr, EVENT_BUCKETS.lead);
  const leadsPrev  = sumEventCounts(evRowsPrev, EVENT_BUCKETS.lead);
  const downloads  = sumEventCounts(evRowsCurr, EVENT_BUCKETS.download);
  const downloadsP = sumEventCounts(evRowsPrev, EVENT_BUCKETS.download);
  const strategy   = sumEventCounts(evRowsCurr, EVENT_BUCKETS.strategy);
  const strategyP  = sumEventCounts(evRowsPrev, EVENT_BUCKETS.strategy);
  const checkout   = sumEventCounts(evRowsCurr, EVENT_BUCKETS.checkout);
  const checkoutP  = sumEventCounts(evRowsPrev, EVENT_BUCKETS.checkout);
  const purchases  = sumEventCounts(evRowsCurr, EVENT_BUCKETS.purchase);
  const purchasesP = sumEventCounts(evRowsPrev, EVENT_BUCKETS.purchase);

  // ---- Totals (visitors) ----
  const totalsCurr = (totalsR.totals && totalsR.totals[0]) || null;
  const totalsPrev = (totalsR.totals && totalsR.totals[1]) || totalsCurr;
  const visitors     = totalsCurr ? Number(totalsCurr.metricValues[0].value) : trendCurr.reduce((a,b)=>a+b,0);
  const visitorsPrev = totalsPrev ? Number(totalsPrev.metricValues[0].value) : trendPrev.reduce((a,b)=>a+b,0);

  // ---- Sources ----
  const sourcesRows = rowsToObjects(sourcesR);
  const sources = sourcesRows.map((r) => {
    const name = r.sessionSourceMedium || '(direct)';
    const sessions = r.sessions || 0;
    const engRate = sessions ? Math.round((r.engagedSessions / sessions) * 100) : 0;
    const leadCount = r.keyEvents || 0;
    return {
      name,
      sessions,
      eng: engRate,
      leads: leadCount,
      best: '—',
    };
  });

  // ---- Pages ----
  const pagesRows = rowsToObjects(pagesR);
  const pages = pagesRows.map((r) => {
    const views = r.screenPageViews || 0;
    const avgSec = Math.round(r.averageSessionDuration || 0);
    const time = `${Math.floor(avgSec / 60)}:${String(avgSec % 60).padStart(2, '0')}`;
    const conv = views ? Math.round(((r.keyEvents || 0) / views) * 1000) / 10 : 0;
    let status = 'okay';
    if (conv >= 8) status = 'great';
    else if (conv >= 4) status = 'good';
    else if (views > 200 && conv < 2) status = 'attention';
    return {
      title: r.pageTitle || r.pagePath || '(unknown)',
      url: r.pagePath || '/',
      views,
      time,
      ctr: 0, // CTR to next step isn't directly available — leave 0; populate via custom events later.
      conv,
      status,
    };
  });

  // ---- Magnets (per-page lead/download event counts) ----
  // Uses actual eventCount for lead+download events per page, so this works
  // even if those events aren't marked as key events in GA4 admin.
  const magnetEventRows = rowsToObjects(magnetEventsR);
  const magnetHints = [
    { name: 'S1 Mini Mock',         match: /s1-mock/i },
    { name: 'S2 Slam System',       match: /s2-slam/i },
    { name: 'S1 Question Tracker',  match: /tracker/i },
    { name: 'Quote Generator',      match: /quote-generator/i },
  ];
  const magnets = magnetHints.map((h) => {
    const p = pagesRows.find((r) => h.match.test(r.pagePath || ''));
    const views = p ? p.screenPageViews || 0 : 0;
    const signups = magnetEventRows
      .filter((r) => h.match.test(r.pagePath || ''))
      .reduce((s, r) => s + (r.eventCount || 0), 0);
    return {
      name: h.name,
      views,
      signups,
      rec: signups
        ? 'Live data — review conversion rate vs others.'
        : 'No conversion events detected on this page yet.',
    };
  });

  // ---- Winners / Traps ----
  const enriched = pages.map((p) => ({ ...p, score: p.conv * Math.log10(Math.max(10, p.views)) }));
  const winners = enriched
    .filter((p) => p.conv >= 5 && p.views < 500)
    .slice(0, 4)
    .map((p) => ({ label: p.title, metric: `${p.conv}% conv  ${p.views} views` }));
  const traps = enriched
    .filter((p) => p.views > 300 && p.conv < 2)
    .slice(0, 4)
    .map((p) => ({ label: p.title, metric: `${p.views} views  ${p.conv}% conv` }));

  // ---- Tracking gaps (events that are missing from the period's data) ----
  const seen = new Set(evRowsCurr.map((r) => r.eventName));
  const expected = [
    { name: 'checkout_start',         why: 'Distinguish browsers from buyers.' },
    { name: 'free_resource_download', why: 'Confirms actual file/PDF clicks vs opt-ins.' },
    { name: 'strategy_call_click',    why: 'High-intent CTA — attribute it to a source.' },
    { name: 'outbound_click',         why: 'YouTube and Instagram exits are invisible without it.' },
    { name: 'lead_form_submit',       why: 'Unified name across forms for cleaner funnels.' },
  ];
  const gaps = expected.filter((e) => !seen.has(e.name));

  return {
    range: days,
    trend: trendCurr,
    trendPrev: trendPrev,
    metrics: [
      { label: 'Visitors',           value: visitors,  prev: visitorsPrev,  spark: trendCurr, note: 'GA4 active users for the period.' },
      { label: 'Leads generated',    value: leads,     prev: leadsPrev,     spark: trendCurr.map((v) => Math.round(v * 0.06)), note: 'Sum of configured lead events.' },
      { label: 'Resource downloads', value: downloads, prev: downloadsP,    spark: trendCurr.map((v) => Math.round(v * 0.045)), note: 'Sum of configured download events.' },
      { label: 'Strategy sessions',  value: strategy,  prev: strategyP,     spark: trendCurr.map((v) => Math.round(v * 0.02)), note: 'Configured strategy-session event total.' },
      { label: 'Checkout clicks',    value: checkout,  prev: checkoutP,     spark: trendCurr.map((v) => Math.round(v * 0.013)), note: 'checkout_click + begin_checkout.' },
      { label: 'Course purchases',   value: purchases, prev: purchasesP,    spark: trendCurr.map((v) => Math.round(v * 0.003)), note: 'purchase event total.' },
    ],
    sources,
    pages,
    magnets,
    winners,
    traps,
    gaps,
  };
}

function buildDigestEmail(data, weekLabel) {
  const fmtDelta = (v) => {
    if (!v || v === 0) return '<span style="color:#9ca3af">—</span>';
    const up = v > 0;
    return `<span style="color:${up ? '#34d399' : '#f87171'}">${up ? '▲' : '▼'} ${Math.abs(v)}%</span>`;
  };
  const fmtNum = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const rows = data.metrics.map((m) => {
    const delta = m.prev ? Math.round(((m.value - m.prev) / m.prev) * 1000) / 10 : 0;
    return `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px">${m.label}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1e293b;font-size:20px;font-weight:700;color:#f1f5f9;text-align:right">${fmtNum(m.value)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #1e293b;font-size:13px;text-align:right;padding-left:16px">${fmtDelta(delta)}</td>
      </tr>`;
  }).join('');

  const topPages = data.pages.slice(0, 5).map((p) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px">${p.title}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;font-size:12px;text-align:right;color:#f1f5f9">${p.views} views  ${p.conv}% conv</td>
    </tr>`
  ).join('');

  const topSources = data.sources.slice(0, 4).map((s) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:12px">${s.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;font-size:12px;text-align:right;color:#f1f5f9">${s.sessions} sessions  ${s.eng}% engaged</td>
    </tr>`
  ).join('');

  const gapWarning = data.gaps.length
    ? `<p style="margin:16px 0 0;padding:12px;background:#1e293b;border-left:3px solid #f59e0b;color:#fbbf24;font-size:12px">
        ${data.gaps.length} tracking gap${data.gaps.length > 1 ? 's' : ''} still unresolved: ${data.gaps.map((g) => g.name).join(', ')}
      </p>`
    : '';

  const action = data.actions && data.actions[0];
  const actionBlock = action
    ? `<div style="margin:24px 0;padding:16px;background:#0f172a;border:1px solid #1e293b;border-radius:8px">
        <p style="margin:0 0 4px;font-size:11px;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Top priority this week</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#f1f5f9">${action.title}</p>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">${action.body}</p>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9">
<div style="max-width:580px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 4px;font-size:11px;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Rohan's GAMSAT</p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#f1f5f9">Weekly Dashboard</h1>
  <p style="margin:0 0 32px;font-size:13px;color:#64748b">${weekLabel}</p>

  <h2 style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Metrics vs previous ${data.range}d</h2>
  <table style="width:100%;border-collapse:collapse">${rows}</table>

  ${actionBlock}

  <h2 style="margin:24px 0 4px;font-size:13px;font-weight:600;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Top pages</h2>
  <table style="width:100%;border-collapse:collapse">${topPages}</table>

  <h2 style="margin:24px 0 4px;font-size:13px;font-weight:600;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Traffic sources</h2>
  <table style="width:100%;border-collapse:collapse">${topSources}</table>

  ${gapWarning}

  <p style="margin:32px 0 0;font-size:11px;color:#334155;text-align:center">
    Rohan's GAMSAT Founder Dashboard &middot; Weekly digest &middot;
    <a href="https://rohanstutoring.com/analytics-dashboard" style="color:#6fb6f0">Open dashboard</a>
  </p>
</div>
</body>
</html>`;
}

function buildInsightsEmail(insights, weekLabel) {
  const prioColor = { high: '#f87171', medium: '#fbbf24', low: '#94a3b8' };
  const items = (insights.insights || []).map((it, i) => {
    const prio = String(it.priority || 'medium').toLowerCase();
    const color = prioColor[prio] || prioColor.medium;
    return `
      <div style="margin:0 0 20px;padding:16px;background:#0f172a;border:1px solid #1e293b;border-left:3px solid ${color};border-radius:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:15px;font-weight:700;color:#f1f5f9">${i + 1}. ${it.title}</span>
          <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:${color}">${prio}</span>
        </div>
        <p style="margin:8px 0 0;font-size:13px;color:#cbd5e1;line-height:1.5">${it.observation}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;line-height:1.5"><strong style="color:#6fb6f0">Business read:</strong> ${it.business_mapping}</p>
        <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;line-height:1.5"><strong style="color:#34d399">Do next:</strong> ${it.recommended_next_step}</p>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f1f5f9">
<div style="max-width:600px;margin:0 auto;padding:32px 24px">
  <p style="margin:0 0 4px;font-size:11px;color:#6fb6f0;text-transform:uppercase;letter-spacing:0.08em">Rohan's GAMSAT</p>
  <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#f1f5f9">Weekly Insights</h1>
  <p style="margin:0 0 24px;font-size:13px;color:#64748b">${weekLabel} &middot; analysed by DeepSeek</p>
  <p style="margin:0 0 24px;padding:14px 16px;background:#11203a;border-radius:8px;font-size:14px;color:#e2e8f0;line-height:1.5">${insights.headline || ''}</p>
  ${items}
  <p style="margin:24px 0 0;font-size:11px;color:#334155;text-align:center">
    Rohan's GAMSAT &middot; Weekly insight engine &middot;
    <a href="https://rohanstutoring.com/analytics-dashboard.html" style="color:#6fb6f0">Open dashboard</a>
  </p>
</div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const action = req.query && req.query.action;

  // ---- OAuth: start ----
  if (action === 'connect') {
    try {
      const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const url = buildAuthUrl(state);
      res.statusCode = 302;
      res.setHeader('Location', url);
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`OAuth start failed: ${err.message}`);
    }
    return;
  }

  // ---- Reveal refresh token (cookie-authenticated — copy to GA4_REFRESH_TOKEN env var) ----
  if (action === 'reveal-token') {
    const token = readRefreshToken(req);
    if (!token) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'not_connected', message: 'Connect GA4 first via /api/analytics?action=connect' }));
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      refresh_token: token,
      instructions: 'Set this as GA4_REFRESH_TOKEN in Vercel env vars (vercel env add GA4_REFRESH_TOKEN) to enable the email digest cron.',
    }));
    return;
  }

  // ---- Email digest (called by Vercel cron, requires GA4_REFRESH_TOKEN env var) ----
  if (action === 'digest') {
    const cronHeader = req.headers['x-vercel-cron'];
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers['authorization'];
    if (!cronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    const storedToken = process.env.GA4_REFRESH_TOKEN;
    if (!storedToken) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'GA4_REFRESH_TOKEN not set. Visit /api/analytics?action=reveal-token to get your token, then run: vercel env add GA4_REFRESH_TOKEN' }));
      return;
    }

    const resendKey = process.env.RESEND_API_KEY;
    const digestTo = process.env.DIGEST_EMAIL || 'rohanbhatia2709@gmail.com';
    const propId = process.env.GA4_PROPERTY_ID;

    if (!propId || !resendKey) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Missing GA4_PROPERTY_ID or RESEND_API_KEY' }));
      return;
    }

    try {
      const tokenRes = await refreshAccessToken(storedToken);
      const accessToken = tokenRes.access_token;
      const data = await buildDashboard(propId, accessToken, 7);

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setUTCDate(weekStart.getUTCDate() - 7);
      const fmt = (d) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
      const weekLabel = `${fmt(weekStart)} – ${fmt(now)}`;

      const html = buildDigestEmail(data, weekLabel);
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'hello@rohanstutoring.com',
        to: digestTo,
        subject: `GAMSAT Dashboard — week of ${weekLabel}`,
        html,
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ sent: true, to: digestTo, week: weekLabel }));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'digest_failed', detail: err.message }));
    }
    return;
  }

  // ---- Weekly DeepSeek insight email (Vercel cron, requires GA4_REFRESH_TOKEN + DEEPSEEK_API_KEY) ----
  if (action === 'weekly-insights') {
    const cronHeader = req.headers['x-vercel-cron'];
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers['authorization'];
    if (!cronHeader && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    const storedToken = process.env.GA4_REFRESH_TOKEN;
    const propId = process.env.GA4_PROPERTY_ID;
    const resendKey = process.env.RESEND_API_KEY;
    const digestTo = process.env.DIGEST_EMAIL || 'rohanbhatia2709@gmail.com';
    const missing = [];
    if (!storedToken) missing.push('GA4_REFRESH_TOKEN');
    if (!propId) missing.push('GA4_PROPERTY_ID');
    if (!process.env.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
    if (!resendKey) missing.push('RESEND_API_KEY');
    if (missing.length) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Missing env vars: ${missing.join(', ')}` }));
      return;
    }

    // ?dryRun=1 returns the insights JSON without emailing — handy for testing.
    const dryRun = req.query && (req.query.dryRun === '1' || req.query.dryRun === 'true');

    try {
      const tokenRes = await refreshAccessToken(storedToken);
      const days = parseRange((req.query && req.query.range) || '30');
      const data = await buildDashboard(propId, tokenRes.access_token, days);
      const insights = await generateWeeklyInsights({ data });

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setUTCDate(weekStart.getUTCDate() - days);
      const fmt = (d) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
      const weekLabel = `${fmt(weekStart)} – ${fmt(now)}`;

      if (dryRun) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ dryRun: true, week: weekLabel, data: compactDashboard(data), insights }, null, 2));
        return;
      }

      const html = buildInsightsEmail(insights, weekLabel);
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: 'hello@rohanstutoring.com',
        to: digestTo,
        subject: `GAMSAT Weekly Insights — ${weekLabel}`,
        html,
      });

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ sent: true, to: digestTo, week: weekLabel, count: insights.insights.length }));
    } catch (err) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'weekly_insights_failed', detail: err.message }));
    }
    return;
  }

  // ---- OAuth: callback ----
  if (action === 'callback') {
    const code = req.query.code;
    const error = req.query.error;

    if (error) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Google OAuth error: ${error}`);
      return;
    }
    if (!code) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Missing authorization code.');
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(
          `<pre>Google did not return a refresh_token. ` +
            `Revoke access at https://myaccount.google.com/permissions and reconnect.</pre>`
        );
        return;
      }
      setRefreshTokenCookie(res, tokens.refresh_token);
      res.statusCode = 302;
      res.setHeader('Location', '/analytics-dashboard.html?connected=1');
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`Token exchange failed: ${err.message}`);
    }
    return;
  }

  // ---- Default: fetch GA4 data ----
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'GA4_PROPERTY_ID is not configured.' }));
    return;
  }

  const refreshToken = readRefreshToken(req);
  if (!refreshToken) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'not_connected',
      message: 'Google Analytics is not connected yet. Visit /api/analytics?action=connect to authorize.',
      authUrl: '/api/analytics?action=connect',
    }));
    return;
  }

  let accessToken;
  try {
    const tokenRes = await refreshAccessToken(refreshToken);
    accessToken = tokenRes.access_token;
  } catch (err) {
    // Refresh token rejected — clear the cookie and ask the user to reconnect.
    clearRefreshTokenCookie(res);
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'token_refresh_failed',
      message: 'Google rejected the saved credentials. Reconnect at /api/analytics?action=connect.',
      authUrl: '/api/analytics?action=connect',
      detail: err.message,
    }));
    return;
  }

  try {
    const days = parseRange(req.query && req.query.range);
    const data = await buildDashboard(propertyId, accessToken, days);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
  } catch (err) {
    res.statusCode = err.status === 403 ? 403 : 502;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'ga4_request_failed',
      message: err.status === 403
        ? 'The authorized Google account does not have access to this GA4 property. Grant Viewer access in Admin → Property → Property access management.'
        : 'GA4 Data API request failed.',
      detail: err.message,
    }));
  }
};
