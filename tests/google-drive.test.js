const test = require('node:test');
const assert = require('node:assert/strict');

const googleDrive = require('../api/_lib/_google-drive.js');

test('shareProductAccess refreshes an access token and grants folder access', async () => {
  const calls = [];
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK = 'folder_123';

  googleDrive.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_123/permissions?supportsAllDrives=true&sendNotificationEmail=true')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_123', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await googleDrive.shareProductAccess({
    baseSlug: 'starter-pack',
    email: 'jane@example.com',
  });

  assert.equal(result.skipped, false);
  assert.equal(result.alreadyShared, false);
  assert.equal(result.folderId, 'folder_123');
  assert.equal(result.permissionId, 'perm_123');
  assert.equal(result.folderEnvName, 'GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK');
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.match(calls[1].url, /\/files\/folder_123\/permissions\?supportsAllDrives=true&fields=/);
  assert.match(calls[2].url, /sendNotificationEmail=true/);

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_STARTER_PACK;
});
