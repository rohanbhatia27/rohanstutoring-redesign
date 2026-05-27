const adminHandler = require('./admin.js');

function testDriveShareHandler(req, res) {
  req.query = {
    ...(req.query || {}),
    action: 'testDriveShare',
  };

  return adminHandler(req, res);
}

module.exports = testDriveShareHandler;
