// Checkout applies coupons by lowering the charge itself and never attaches
// the promotion code to the Stripe payment, so Stripe's times_redeemed stays
// at 0 and max_redemptions never fires. After a paid checkout, count the use
// in the promotion code's metadata and deactivate the code once it reaches
// its limit. Codes without max_redemptions are left alone.

const METADATA_VALUE_LIMIT = 500;

function parseIds(value) {
  return String(value || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

// Keep the newest ids that fit in one Stripe metadata value. Older ids only
// guard against webhook retries, which arrive within days, so dropping them
// is safe.
function joinIdsWithinLimit(ids) {
  const kept = [];
  let length = 0;
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const added = ids[i].length + (kept.length ? 1 : 0);
    if (length + added > METADATA_VALUE_LIMIT) break;
    kept.unshift(ids[i]);
    length += added;
  }
  return kept.join(',');
}

async function recordPromoRedemption({ stripeClient, code, transactionId }) {
  const normalisedCode = String(code || '').trim().toUpperCase();
  const id = String(transactionId || '').trim();
  if (!normalisedCode || !id) {
    return { skipped: true };
  }

  const result = await stripeClient.promotionCodes.list({ code: normalisedCode, limit: 1 });
  const promoCode = result && result.data ? result.data[0] : null;
  if (!promoCode) {
    throw new Error(`Promotion code ${normalisedCode} not found`);
  }

  const maxRedemptions = Number(promoCode.max_redemptions) || 0;
  if (maxRedemptions <= 0) {
    return { skipped: true };
  }

  const metadata = promoCode.metadata || {};
  const redeemedIds = parseIds(metadata.site_redemption_ids);
  if (redeemedIds.includes(id)) {
    return { alreadyRecorded: true };
  }

  const siteRedemptions = (parseInt(metadata.site_redemptions, 10) || 0) + 1;
  const totalRedemptions = siteRedemptions + (Number(promoCode.times_redeemed) || 0);
  const deactivate = totalRedemptions >= maxRedemptions;

  const update = {
    metadata: {
      site_redemptions: String(siteRedemptions),
      site_redemption_ids: joinIdsWithinLimit([...redeemedIds, id]),
    },
  };
  if (deactivate) {
    update.active = false;
  }

  await stripeClient.promotionCodes.update(promoCode.id, update);

  return { deactivated: deactivate, siteRedemptions };
}

module.exports = { recordPromoRedemption };
