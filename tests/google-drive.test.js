const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync } = require('node:crypto');

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

test('shareProductAccess maps Blueprint-family enrolments to the Blueprint Drive folder', async () => {
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  const permissionCreates = [];

  googleDrive.__setFetch(async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&sendNotificationEmail=true')) {
      permissionCreates.push(JSON.parse(options.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: `perm_${permissionCreates.length}`, role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  for (const baseSlug of ['blueprint', 'comprehensive', 'mastery']) {
    const result = await googleDrive.shareProductAccess({
      baseSlug,
      email: `${baseSlug}@example.com`,
    });

    assert.equal(result.skipped, false);
    assert.equal(result.folderEnvName, 'GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT');
    assert.equal(result.folderId, 'folder_blueprint');
    assert.equal(result.role, 'reader');
  }

  assert.deepEqual(permissionCreates.map((body) => body.emailAddress), [
    'blueprint@example.com',
    'comprehensive@example.com',
    'mastery@example.com',
  ]);
  assert.deepEqual(new Set(permissionCreates.map((body) => body.role)), new Set(['reader']));

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('shareProductAccess can use service account credentials instead of a user refresh token', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calls = [];
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'drive-bot@example.iam.gserviceaccount.com';
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' });
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  googleDrive.__setFetch(async (url, options) => {
    calls.push({ url, options });

    if (url === 'https://oauth2.googleapis.com/token') {
      const body = new URLSearchParams(options.body);
      assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
      assert.equal(body.get('assertion').split('.').length, 3);
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'service_account_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ permissions: [] }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint/permissions?supportsAllDrives=true&sendNotificationEmail=true')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'perm_service', role: 'reader', type: 'user' }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await googleDrive.shareProductAccess({
    baseSlug: 'comprehensive',
    email: 'jane@example.com',
  });

  assert.equal(result.skipped, false);
  assert.equal(result.permissionId, 'perm_service');
  assert.equal(calls[0].url, 'https://oauth2.googleapis.com/token');

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});

test('verifyProductDriveAccess checks the configured Blueprint folder', async () => {
  process.env.GOOGLE_CLIENT_ID = 'google_client_id';
  process.env.GOOGLE_CLIENT_SECRET = 'google_client_secret';
  process.env.GOOGLE_REFRESH_TOKEN = 'google_refresh_token';
  process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT = 'folder_blueprint';

  googleDrive.__setFetch(async (url) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'google_access_token' }),
      };
    }

    if (url.includes('/drive/v3/files/folder_blueprint?supportsAllDrives=true&fields=')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'folder_blueprint',
          name: 'Blueprint Library',
          mimeType: 'application/vnd.google-apps.folder',
          capabilities: { canShare: true },
        }),
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  const result = await googleDrive.verifyProductDriveAccess({ baseSlug: 'mastery' });
  assert.equal(result.ok, true);
  assert.equal(result.folderEnvName, 'GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT');
  assert.equal(result.folderName, 'Blueprint Library');
  assert.equal(result.canShare, true);

  googleDrive.__resetForTests();
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GOOGLE_REFRESH_TOKEN;
  delete process.env.GOOGLE_DRIVE_FOLDER_ID_BLUEPRINT;
});
