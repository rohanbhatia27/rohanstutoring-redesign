const { shareProductAccess } = require('./_google-drive.js');
const { syncPurchaseTag } = require('./_kit.js');
const fulfillPaymentIntent = require('./_fulfill-payment-intent.js');
const sendFulfillmentAlert = require('./_fulfillment-alerts.js');
const logPurchaseEvent = require('./_purchase-log.js');

const { sendConfirmationEmail } = fulfillPaymentIntent;

let alertFn = sendFulfillmentAlert;

async function safeAlert(args) {
  try {
    await alertFn(args);
  } catch (err) {
    console.error('[paypal-fulfillment] Alert send failed:', err.message);
  }
}

async function fulfillPayPalOrder({
  purchase,
  customer,
  orderID = '',
  source = 'paypal-webhook',
} = {}) {
  if (!purchase || !purchase.baseSlug) {
    throw new Error('Missing PayPal purchase to fulfill.');
  }

  if (!customer || !String(customer.email || '').trim()) {
    throw new Error('Missing PayPal customer email.');
  }

  const customerEmail = String(customer.email || '').trim();
  const customerName = String(customer.customerName || '').trim();
  const baseSlug = String(purchase.baseSlug || '').trim();
  const upsellSlug = String(purchase.upsellSlug || '').trim();

  const logBase = {
    provider: 'paypal',
    paymentId: orderID,
    productSlug: baseSlug,
    upsellSlug,
    customerEmail,
    customerName,
  };

  try {
    const driveResult = await shareProductAccess({
      baseSlug,
      email: customerEmail,
    });

    if (driveResult && !driveResult.skipped) {
      console.log(
        `[${source}] Google Drive access ${driveResult.alreadyShared ? 'already existed' : 'shared'} for ${customerEmail} (${baseSlug})`
      );
      await logPurchaseEvent({ ...logBase, eventType: 'drive_share.success', outcome: 'success' });
    } else if (driveResult && driveResult.reason === 'missing_folder_mapping') {
      console.warn(`[${source}] No Google Drive folder configured for ${baseSlug} (${driveResult.folderEnvName})`);
      await logPurchaseEvent({ ...logBase, eventType: 'drive_share.success', outcome: 'skipped', meta: { reason: driveResult.reason } });
    }
  } catch (driveErr) {
    console.error(`[${source}] Google Drive sharing failed:`, driveErr.message);
    await logPurchaseEvent({ ...logBase, eventType: 'drive_share.failed', outcome: 'failure', errorMessage: driveErr.message });
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'paypal',
      paymentId: orderID,
      failedStep: 'drive',
      errorMessage: driveErr.message,
    });
  }

  try {
    await sendConfirmationEmail({
      customerName,
      customerEmail,
      baseSlug,
      upsellSlug,
    });
    console.log(`[${source}] Confirmation email processed for ${customerEmail} (${orderID || baseSlug})`);
    await logPurchaseEvent({ ...logBase, eventType: 'email.sent', outcome: 'success' });
  } catch (emailErr) {
    console.error(`[${source}] Confirmation email failed:`, emailErr.message);
    await logPurchaseEvent({ ...logBase, eventType: 'email.failed', outcome: 'failure', errorMessage: emailErr.message });
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'paypal',
      paymentId: orderID,
      failedStep: 'email',
      errorMessage: emailErr.message,
    });
  }

  try {
    const kitResult = await syncPurchaseTag({
      baseSlug,
      email: customerEmail,
      customerName,
    });

    if (kitResult && !kitResult.skipped) {
      console.log(`[${source}] Kit purchase tag synced for ${customerEmail}`);
      await logPurchaseEvent({ ...logBase, eventType: 'kit_tag.success', outcome: 'success' });
    } else if (kitResult && kitResult.skipped) {
      await logPurchaseEvent({ ...logBase, eventType: 'kit_tag.success', outcome: 'skipped' });
    }
  } catch (kitErr) {
    console.error(`[${source}] Kit purchase sync failed:`, kitErr.message);
    await logPurchaseEvent({ ...logBase, eventType: 'kit_tag.failed', outcome: 'failure', errorMessage: kitErr.message });
    await safeAlert({
      baseSlug,
      upsellSlug,
      customerEmail,
      provider: 'paypal',
      paymentId: orderID,
      failedStep: 'kit',
      errorMessage: kitErr.message,
    });
  }

  await logPurchaseEvent({ ...logBase, eventType: 'paypal.fulfilled', outcome: 'success' });

  return { fulfilled: true };
}

fulfillPayPalOrder.__setAlertFn = (fn) => { alertFn = fn; };
fulfillPayPalOrder.__resetForTests = () => { alertFn = sendFulfillmentAlert; };

module.exports = fulfillPayPalOrder;
