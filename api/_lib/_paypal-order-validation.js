const createPaymentIntentHandler = require('../create-checkout.js');

const PAYPAL_CURRENCY = 'AUD';
const PAYPAL_ORDER_ID_PATTERN = /^[A-Z0-9]{8,32}$/;

function formatPayPalAmount(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function getPayPalPurchaseCustomId(purchase) {
  if (!purchase || !purchase.baseSlug) return '';
  return purchase.upsellSlug ? `${purchase.baseSlug}+${purchase.upsellSlug}` : purchase.baseSlug;
}

const PAYPAL_UNAVAILABLE_MESSAGE = 'PayPal is only available when paying in full without a coupon. Please pay by card.';

// PayPal orders carry only base + one add-on in custom_id, are captured without
// coupon logic, and are fulfilled from that custom_id. Refuse anything else so
// the amount PayPal charges always matches what the order is fulfilled as.
function getPayPalIneligibilityReason(body, purchase) {
  const safeBody = body || {};
  const paymentMode = String(safeBody.paymentMode || 'full').trim().toLowerCase();
  if (paymentMode !== 'full') return 'payment_mode';
  if (String(safeBody.couponCode || '').trim()) return 'coupon';
  if (purchase && purchase.upsellSlug2) return 'second_add_on';
  if (purchase && Number(purchase.upsellQuantity) > 1) return 'add_on_quantity';
  return '';
}

function isValidPayPalOrderId(value) {
  return PAYPAL_ORDER_ID_PATTERN.test(String(value || '').trim());
}

function resolvePayPalPurchaseFromBody(body) {
  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase(body || {});
  if (purchase.error) return { error: purchase.error };

  const customer = createPaymentIntentHandler.normaliseCustomerDetails(body || {});
  if (customer.error) return { error: customer.error };

  return { purchase, customer };
}

function getPrimaryPurchaseUnit(orderData) {
  return orderData && Array.isArray(orderData.purchase_units)
    ? orderData.purchase_units[0]
    : null;
}

function getPrimaryCapture(orderData) {
  const purchaseUnit = getPrimaryPurchaseUnit(orderData);
  const captures = purchaseUnit?.payments?.captures;
  return Array.isArray(captures) ? captures[0] : null;
}

// PayPal's capture response (return=minimal) puts custom_id on the capture,
// not on the purchase unit; GET /v2/checkout/orders puts it on both.
function getPayPalOrderCustomId(orderData) {
  const purchaseUnit = getPrimaryPurchaseUnit(orderData);
  const capture = getPrimaryCapture(orderData);
  return String(purchaseUnit?.custom_id || capture?.custom_id || '').trim();
}

function parsePayPalCustomId(customId) {
  const safeCustomId = String(customId || '').trim();

  if (!safeCustomId) {
    return { error: 'Missing PayPal purchase details.' };
  }

  const [baseSlug, ...upsellParts] = safeCustomId.split('+');
  const upsellSlug = upsellParts.join('+');

  return {
    baseSlug: String(baseSlug || '').trim(),
    upsellSlug: String(upsellSlug || '').trim(),
  };
}

function resolvePayPalPurchaseFromOrder(orderData) {
  const customId = getPayPalOrderCustomId(orderData);
  const parsed = parsePayPalCustomId(customId);

  if (parsed.error) {
    return { error: parsed.error };
  }

  const purchase = createPaymentIntentHandler.resolveCheckoutPurchase({
    slug: parsed.baseSlug,
    upsellSlug: parsed.upsellSlug,
  });

  if (purchase.error) {
    return { error: purchase.error };
  }

  return {
    customId,
    purchase,
  };
}

function getPayPalCustomerFromOrder(orderData) {
  const payer = orderData?.payer || {};
  const payerName = payer.name || {};
  const purchaseUnit = getPrimaryPurchaseUnit(orderData) || {};
  const shippingName = purchaseUnit.shipping?.name || {};
  const email = String(payer.email_address || '').trim();
  const customerName = [
    String(payerName.given_name || '').trim(),
    String(payerName.surname || '').trim(),
  ]
    .filter(Boolean)
    .join(' ')
    .trim()
    || String(shippingName.full_name || '').trim();

  if (!email) {
    return { error: 'Missing PayPal payer email.' };
  }

  return {
    email,
    customerName,
  };
}

function validateCompletedPayPalOrder(orderData, purchase, expectedOrderId = '') {
  if (!orderData || typeof orderData !== 'object') {
    return { error: 'Missing PayPal order data.' };
  }

  const safeExpectedOrderId = String(expectedOrderId || '').trim();
  if (safeExpectedOrderId && orderData.id !== safeExpectedOrderId) {
    return { error: 'Captured PayPal order ID does not match checkout order.' };
  }

  if (orderData.status !== 'COMPLETED') {
    return { error: 'Payment was not completed.' };
  }

  const purchaseUnit = getPrimaryPurchaseUnit(orderData);
  const capture = getPrimaryCapture(orderData);
  if (!purchaseUnit || !capture) {
    return { error: 'Missing PayPal capture details.' };
  }

  if (capture.status !== 'COMPLETED') {
    return { error: 'PayPal capture was not completed.' };
  }

  const expectedAmount = formatPayPalAmount(purchase.amount);
  const capturedAmount = String(capture.amount?.value || '').trim();
  const capturedCurrency = String(capture.amount?.currency_code || '').trim().toUpperCase();
  const customId = getPayPalOrderCustomId(orderData);
  const expectedCustomId = getPayPalPurchaseCustomId(purchase);

  if (capturedCurrency !== PAYPAL_CURRENCY) {
    return { error: 'Captured PayPal currency does not match checkout currency.' };
  }

  if (capturedAmount !== expectedAmount) {
    return { error: 'Captured PayPal amount does not match checkout amount.' };
  }

  if (customId !== expectedCustomId) {
    return { error: 'Captured PayPal product does not match checkout product.' };
  }

  return {
    orderID: orderData.id,
    amount: capturedAmount,
    currency: capturedCurrency,
    customId,
  };
}

function resolveCompletedPayPalOrder(orderData, expectedOrderId = '') {
  const purchaseResult = resolvePayPalPurchaseFromOrder(orderData);
  if (purchaseResult.error) {
    return { error: purchaseResult.error };
  }

  const validation = validateCompletedPayPalOrder(orderData, purchaseResult.purchase, expectedOrderId);
  if (validation.error) {
    return { error: validation.error };
  }

  const customer = getPayPalCustomerFromOrder(orderData);
  if (customer.error) {
    return { error: customer.error };
  }

  return {
    ...validation,
    purchase: purchaseResult.purchase,
    customer,
  };
}

module.exports = {
  PAYPAL_CURRENCY,
  PAYPAL_UNAVAILABLE_MESSAGE,
  formatPayPalAmount,
  getPayPalIneligibilityReason,
  getPayPalOrderCustomId,
  getPayPalPurchaseCustomId,
  isValidPayPalOrderId,
  parsePayPalCustomId,
  resolvePayPalPurchaseFromOrder,
  getPayPalCustomerFromOrder,
  resolvePayPalPurchaseFromBody,
  validateCompletedPayPalOrder,
  resolveCompletedPayPalOrder,
};
