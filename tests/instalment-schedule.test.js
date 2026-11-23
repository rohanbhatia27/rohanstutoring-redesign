const test = require('node:test');
const assert = require('node:assert/strict');
const ensureSchedule = require('../api/_lib/_instalment-schedule.js');

test('creates and verifies four-period schedule using actual price', async () => {
  let updated;
  const sub = { id: 'sub_1', start_date: 1767225600, schedule: null, items: { data: [{ price: { id: 'price_discount', recurring: { interval: 'month', interval_count: 1 } }, quantity: 1 }] } };
  const stripe = { subscriptions: { retrieve: async () => sub }, subscriptionSchedules: {
    create: async () => ({ id: 'sched_1', current_phase: { start_date: sub.start_date } }),
    update: async (id, params) => { updated = params; return { id, end_behavior: 'cancel', phases: [{ start_date: sub.start_date, end_date: 1777593600, items: [{ price: 'price_discount', quantity: 1 }] }] }; },
  } };
  await ensureSchedule({ stripeClient: stripe, session: { subscription: 'sub_1', metadata: { base_slug: 'comprehensive' } } });
  assert.equal(updated.end_behavior, 'cancel');
  assert.deepEqual(updated.phases[0].items, [{ price: 'price_discount', quantity: 1 }]);
  assert.equal(updated.phases[0].iterations, 4);
});

test('resumes configuration after schedule creation', async () => {
  let creates = 0, updates = 0;
  const start = 1767225600;
  const stripe = { subscriptions: { retrieve: async () => ({ id: 'sub_1', start_date: start, schedule: 'sched_1', items: { data: [{ price: { id: 'price_1', recurring: { interval: 'month', interval_count: 1 } }, quantity: 1 }] } }) }, subscriptionSchedules: {
    create: async () => { creates++; },
    retrieve: async () => ({ id: 'sched_1', current_phase: { start_date: start } }),
    update: async () => { updates++; return { end_behavior: 'cancel', phases: [{ start_date: start, end_date: 1777593600, items: [{ price: 'price_1', quantity: 1 }] }] }; },
  } };
  await ensureSchedule({ stripeClient: stripe, session: { subscription: 'sub_1', metadata: { base_slug: 'mastery' } } });
  assert.equal(creates, 0); assert.equal(updates, 1);
});

test('rejects a schedule with a mismatched recurring price even if end date matches', async () => {
  const start = 1767225600;
  const stripe = { subscriptions: { retrieve: async () => ({ start_date: start, schedule: 'sched_1', items: { data: [{ price: { id: 'price_1', recurring: { interval: 'month' } }, quantity: 1 }] } }) }, subscriptionSchedules: {
    retrieve: async () => ({ id: 'sched_1', end_behavior: 'cancel', current_phase: { start_date: 0 }, phases: [{ start_date: start, end_date: 1777593600, items: [{ price: 'price_other', quantity: 1 }] }] }),
  } };
  await assert.rejects(() => ensureSchedule({ stripeClient: stripe, session: { subscription: 'sub_1', metadata: { base_slug: 'mastery' } } }), /safely configure/);
});
