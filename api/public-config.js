const createCheckoutHandler = require('./create-checkout.js');

function publicConfigHandler(req, res) {
  req.query = {
    ...(req.query || {}),
    action: 'publicConfig',
  };

  return createCheckoutHandler(req, res);
}

publicConfigHandler.isAllowedOrigin = createCheckoutHandler.isAllowedOrigin;

module.exports = publicConfigHandler;
