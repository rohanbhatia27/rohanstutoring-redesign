const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

let fetchImpl = (...args) => fetch(...args);

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

function getOptionalEnv(name) {
  return String(process.env[name] || '').trim();
}

function buildFolderEnvName(baseSlug) {
  const suffix = String(baseSlug || '')
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return suffix ? `GOOGLE_DRIVE_FOLDER_ID_${suffix}` : '';
}

async function getDriveAccessToken() {
  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: getRequiredEnv('GOOGLE_CLIENT_ID'),
      client_secret: getRequiredEnv('GOOGLE_CLIENT_SECRET'),
      refresh_token: getRequiredEnv('GOOGLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }).toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description || payload.error || 'Unknown token error';
    throw new Error(`Google OAuth token request failed (${response.status}): ${reason}`);
  }

  return payload.access_token;
}

async function driveRequest(path, { method = 'GET', accessToken, body } = {}) {
  const response = await fetchImpl(`${DRIVE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload?.error?.message || payload?.error_description || 'Unknown Drive error';
    throw new Error(`Google Drive request failed (${response.status}): ${reason}`);
  }

  return payload;
}

async function hasExistingPermission({ folderId, email, accessToken }) {
  const data = await driveRequest(
    `/files/${encodeURIComponent(folderId)}/permissions?supportsAllDrives=true&fields=permissions(id,emailAddress,role,type)`,
    { accessToken }
  );

  const permissions = Array.isArray(data.permissions) ? data.permissions : [];
  return permissions.find((permission) => (
    String(permission.emailAddress || '').trim().toLowerCase() === String(email).trim().toLowerCase()
    && String(permission.type || '').trim() === 'user'
  )) || null;
}

async function shareFolderWithUser({ folderId, email, accessToken }) {
  const existingPermission = await hasExistingPermission({ folderId, email, accessToken });
  if (existingPermission) {
    return {
      alreadyShared: true,
      permissionId: existingPermission.id || '',
      role: existingPermission.role || '',
    };
  }

  const data = await driveRequest(
    `/files/${encodeURIComponent(folderId)}/permissions?supportsAllDrives=true&sendNotificationEmail=true&fields=id,emailAddress,role,type`,
    {
      method: 'POST',
      accessToken,
      body: {
        type: 'user',
        role: 'reader',
        emailAddress: String(email).trim(),
      },
    }
  );

  return {
    alreadyShared: false,
    permissionId: data.id || '',
    role: data.role || '',
  };
}

async function shareProductAccess({ baseSlug, email }) {
  const folderEnvName = buildFolderEnvName(baseSlug);
  const folderId = getOptionalEnv(folderEnvName);

  if (!folderId) {
    return {
      skipped: true,
      reason: 'missing_folder_mapping',
      folderEnvName,
    };
  }

  const accessToken = await getDriveAccessToken();
  const result = await shareFolderWithUser({
    folderId,
    email,
    accessToken,
  });

  return {
    skipped: false,
    folderId,
    folderEnvName,
    ...result,
  };
}

module.exports = {
  buildFolderEnvName,
  getDriveAccessToken,
  shareFolderWithUser,
  shareProductAccess,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
