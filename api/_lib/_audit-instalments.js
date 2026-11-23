const { CATALOG } = require('./catalog.server.js');
function addMonths(timestamp, months) {
  const date = new Date(timestamp * 1000), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months);
  date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()));
  return Math.floor(date.getTime() / 1000);
}
async function auditInstalments({ stripeClient, alert, date = new Date().toISOString().slice(0, 10) }) {
  let checked = 0, unverified = 0;
  for await (const subscription of stripeClient.subscriptions.list({ status: 'all', limit: 100 })) {
    if (subscription.metadata?.payment_mode !== 'instalments' || !['active', 'past_due', 'unpaid', 'trialing'].includes(subscription.status)) continue;
    checked++;
    const slug = subscription.metadata.base_slug || subscription.metadata.product_slug;
    const count = CATALOG[slug]?.instalment?.plan?.count;
    const scheduleId = typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule?.id;
    const schedule = scheduleId ? await stripeClient.subscriptionSchedules.retrieve(scheduleId) : null;
    const phase = schedule?.phases?.[0], item = subscription.items?.data?.[0];
    const schedulePrice = typeof phase?.items?.[0]?.price === 'string' ? phase.items[0].price : phase?.items?.[0]?.price?.id;
    const verified = count && subscription.start_date && subscription.items?.data?.length === 1 && item?.price?.recurring?.interval === 'month' && (item.price.recurring.interval_count || 1) === 1 && schedule?.end_behavior === 'cancel' && schedule.phases?.length === 1 && phase.start_date === subscription.start_date && phase.end_date === addMonths(subscription.start_date, count) && phase.items?.length === 1 && schedulePrice === item.price.id && phase.items[0].quantity === (item.quantity || 1);
    if (!verified) {
      unverified++;
      const sent = await alert({ baseSlug: slug || 'unknown', customerEmail: subscription.metadata.customer_email || '', provider: 'stripe', paymentId: subscription.id, failedStep: `instalment_schedule_${date}`, errorMessage: 'Active instalment subscription has no verified four-period cancellation schedule.' });
      if (!sent) throw new Error(`Could not send instalment schedule alert for ${subscription.id}`);
    }
  }
  return { checked, unverified };
}
module.exports = auditInstalments;
