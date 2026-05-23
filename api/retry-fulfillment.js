const adminHandler = require('./admin.js');

module.exports = function retryFulfillmentCompatibilityHandler(req, res) {
  req.body = req.body && typeof req.body === 'object' ? req.body : {};
  req.body.action = req.body.action || 'retryFulfillment';
  return adminHandler(req, res);
};
