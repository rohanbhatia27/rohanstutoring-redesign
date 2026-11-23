const { CATALOG } = require('./catalog.server.js');

function addMonths(timestamp, months) {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return Math.floor(date.getTime() / 1000);
}

async function ensureInstalmentSchedule({ stripeClient, session }) {
  const slug = String(session.metadata?.base_slug || session.metadata?.product_slug || '').trim();
  const count = CATALOG[slug]?.instalment?.plan?.count;
  const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!id || !Number.isInteger(count) || count < 1) throw new Error('Missing instalment subscription or catalogue plan');
  const subscription = await stripeClient.subscriptions.retrieve(id);
  const items = subscription.items?.data || [];
  const item = items[0];
  const price = item?.price;
  if (items.length !== 1 || !price?.id || price.recurring?.interval !== 'month' || (price.recurring.interval_count || 1) !== 1 || !subscription.start_date) {
    throw new Error('Unexpected instalment subscription configuration');
  }
  let schedule;
  if (subscription.schedule) {
    const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id;
    schedule = await stripeClient.subscriptionSchedules.retrieve(scheduleId);
  } else {
    schedule = await stripeClient.subscriptionSchedules.create({ from_subscription: id }, { idempotencyKey: `instalment-schedule/${id}` });
  }
  const start = subscription.start_date;
  const end = addMonths(start, count);
  const existingPhase = schedule.phases?.[0];
  const existingPrice = typeof existingPhase?.items?.[0]?.price === 'string' ? existingPhase.items[0].price : existingPhase?.items?.[0]?.price?.id;
  if (schedule.end_behavior === 'cancel' && schedule.phases?.length === 1 && existingPhase.start_date === start && existingPhase.end_date === end && existingPhase.items?.length === 1 && existingPrice === price.id && existingPhase.items[0].quantity === (item.quantity || 1)) return schedule;
  if (schedule.current_phase?.start_date !== start) throw new Error('Cannot safely configure instalment schedule after original phase changed');
  const result = await stripeClient.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'cancel',
    proration_behavior: 'none',
    phases: [{ start_date: start, iterations: count, items: [{ price: price.id, quantity: item.quantity || 1 }] }],
  });
  const phase = result.phases?.[0];
  const phasePrice = typeof phase?.items?.[0]?.price === 'string' ? phase.items[0].price : phase?.items?.[0]?.price?.id;
  if (result.end_behavior !== 'cancel' || result.phases?.length !== 1 || phase.start_date !== start || phase.end_date !== end || phase.items?.length !== 1 || phasePrice !== price.id || phase.items[0].quantity !== (item.quantity || 1)) throw new Error('Instalment schedule end could not be verified');
  return result;
}

module.exports = ensureInstalmentSchedule;
