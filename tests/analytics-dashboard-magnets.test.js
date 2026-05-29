const test = require('node:test');
const assert = require('node:assert/strict');

const analyticsHandler = require('../api/analytics.js');

function report({ dimensions = [], metrics = [], rows = [], totals = [] } = {}) {
  return {
    dimensionHeaders: dimensions.map((name) => ({ name })),
    metricHeaders: metrics.map((name) => ({ name })),
    rows: rows.map((row) => ({
      dimensionValues: dimensions.map((name) => ({ value: String(row[name] || '') })),
      metricValues: metrics.map((name) => ({ value: String(row[name] || 0) })),
    })),
    totals: totals.length
      ? totals.map((row) => ({
          metricValues: metrics.map((name) => ({ value: String(row[name] || 0) })),
        }))
      : undefined,
  };
}

test('lead magnet views come from the dedicated magnet page report when the page is not in top pages', async () => {
  const batches = [
    [
      report({ dimensions: ['date', 'dateRange'], metrics: ['activeUsers'] }),
      report({ dimensions: ['eventName', 'dateRange'], metrics: ['eventCount'] }),
      report({ dimensions: ['sessionSourceMedium'], metrics: ['sessions', 'engagedSessions', 'keyEvents'] }),
      report({
        dimensions: ['pagePath', 'pageTitle'],
        metrics: ['screenPageViews', 'averageSessionDuration', 'keyEvents'],
        rows: [
          { pagePath: '/', pageTitle: 'Homepage', screenPageViews: 500, averageSessionDuration: 90, keyEvents: 4 },
        ],
      }),
    ],
    [
      report({ metrics: ['activeUsers', 'sessions', 'keyEvents'], totals: [{ activeUsers: 100, sessions: 120, keyEvents: 8 }] }),
      report({
        dimensions: ['pagePath', 'eventName'],
        metrics: ['eventCount'],
        rows: [
          { pagePath: '/section-1-tracker', eventName: 'generate_lead', eventCount: 22 },
        ],
      }),
      report({
        dimensions: ['pagePath', 'pageTitle'],
        metrics: ['screenPageViews'],
        rows: [
          { pagePath: '/section-1-tracker', pageTitle: 'Free GAMSAT Section 1 Tracker', screenPageViews: 44 },
        ],
      }),
      report({ dimensions: ['sessionSourceMedium', 'eventName'], metrics: ['eventCount'] }),
    ],
  ];
  let callIndex = 0;
  analyticsHandler.__setRunBatchReports(async () => batches[callIndex++]);

  const dashboard = await analyticsHandler.__buildDashboardForTests('123', 'token', 30);
  const tracker = dashboard.magnets.find((magnet) => magnet.name === 'S1 Question Tracker');

  assert.equal(tracker.views, 44);
  assert.equal(tracker.signups, 22);

  analyticsHandler.__resetForTests();
});

test('traffic source leads are counted from lead events, not generic key events', async () => {
  const batches = [
    [
      report({ dimensions: ['date', 'dateRange'], metrics: ['activeUsers'] }),
      report({ dimensions: ['eventName', 'dateRange'], metrics: ['eventCount'] }),
      report({
        dimensions: ['sessionSourceMedium'],
        metrics: ['sessions', 'engagedSessions', 'keyEvents'],
        rows: [
          { sessionSourceMedium: 'youtube.com / referral', sessions: 86, engagedSessions: 35, keyEvents: 0 },
        ],
      }),
      report({ dimensions: ['pagePath', 'pageTitle'], metrics: ['screenPageViews', 'averageSessionDuration', 'keyEvents'] }),
    ],
    [
      report({ metrics: ['activeUsers', 'sessions', 'keyEvents'], totals: [{ activeUsers: 100, sessions: 120, keyEvents: 0 }] }),
      report({ dimensions: ['pagePath', 'eventName'], metrics: ['eventCount'] }),
      report({ dimensions: ['pagePath', 'pageTitle'], metrics: ['screenPageViews'] }),
      report({
        dimensions: ['sessionSourceMedium', 'eventName'],
        metrics: ['eventCount'],
        rows: [
          { sessionSourceMedium: 'youtube.com / referral', eventName: 'generate_lead', eventCount: 3 },
        ],
      }),
    ],
  ];
  let callIndex = 0;
  analyticsHandler.__setRunBatchReports(async () => batches[callIndex++]);

  const dashboard = await analyticsHandler.__buildDashboardForTests('123', 'token', 30);

  assert.equal(dashboard.sources[0].name, 'youtube.com / referral');
  assert.equal(dashboard.sources[0].leads, 3);

  analyticsHandler.__resetForTests();
});
