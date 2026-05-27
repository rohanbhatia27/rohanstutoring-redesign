const createCheckoutHandler = require('./create-checkout.js');

function validateCouponHandler(req, res) {
  req.query = {
    ...(req.query || {}),
    action: 'validateCoupon',
  };

  return createCheckoutHandler(req, res);
}

validateCouponHandler.__setStripeFactory = createCheckoutHandler.__setStripeFactory;
validateCouponHandler.__resetForTests = createCheckoutHandler.__resetForTests;

module.exports = validateCouponHandler;
