const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const JWT_BEARER_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';
const { SERVER_CATALOG } = require('./catalog.server.js');
const crypto = require('crypto');

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

function toBase64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function getServiceAccountPrivateKey() {
  const raw = getOptionalEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  return raw ? raw.replace(/\\n/g, '\n') : '';
}

function hasServiceAccountCredentials() {
  return Boolean(getOptionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL') && getServiceAccountPrivateKey());
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
  if (hasServiceAccountCredentials()) {
    return getServiceAccountAccessToken();
  }

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
    const scopeHint = /invalid_scope|insufficient|scope/i.test(reason)
      ? ` Re-authorise GOOGLE_REFRESH_TOKEN with the Drive scope: ${DRIVE_SCOPE}.`
      : '';
    throw new Error(`Google OAuth token request failed (${response.status}): ${reason}.${scopeHint}`);
  }

  return payload.access_token;
}

async function getServiceAccountAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const claim = {
    iss: getRequiredEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    scope: DRIVE_SCOPE,
    aud: OAUTH_TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsignedJwt = `${toBase64UrlJson(header)}.${toBase64UrlJson(claim)}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsignedJwt)
    .sign(getServiceAccountPrivateKey(), 'base64url');
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: JWT_BEARER_GRANT,
      assertion,
    }).toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description || payload.error || 'Unknown token error';
    throw new Error(`Google service account token request failed (${response.status}): ${reason}. Ensure the Blueprint folder is shared with GOOGLE_SERVICE_ACCOUNT_EMAIL and the private key is current.`);
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
    const scopeHint = response.status === 403 && /insufficient|scope|permission|access/i.test(reason)
      ? ` Ensure GOOGLE_REFRESH_TOKEN belongs to an account with access to the folder and includes ${DRIVE_SCOPE}.`
      : '';
    throw new Error(`Google Drive request failed (${response.status}): ${reason}.${scopeHint}`);
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
  const entry = SERVER_CATALOG[String(baseSlug || '').trim()];
  const resolvedSlug = entry && entry.driveFolderSlug ? entry.driveFolderSlug : null;
  const folderEnvName = resolvedSlug ? buildFolderEnvName(resolvedSlug) : '';
  const folderId = folderEnvName ? getOptionalEnv(folderEnvName) : '';

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

async function verifyProductDriveAccess({ baseSlug }) {
  const entry = SERVER_CATALOG[String(baseSlug || '').trim()];
  const resolvedSlug = entry && entry.driveFolderSlug ? entry.driveFolderSlug : null;
  const folderEnvName = resolvedSlug ? buildFolderEnvName(resolvedSlug) : '';
  const folderId = folderEnvName ? getOptionalEnv(folderEnvName) : '';

  if (!folderId) {
    return {
      ok: false,
      skipped: true,
      reason: 'missing_folder_mapping',
      folderEnvName,
    };
  }

  const accessToken = await getDriveAccessToken();
  const folder = await driveRequest(
    `/files/${encodeURIComponent(folderId)}?supportsAllDrives=true&fields=id,name,mimeType,capabilities/canShare`,
    { accessToken }
  );

  return {
    ok: true,
    folderId,
    folderEnvName,
    folderName: folder.name || '',
    mimeType: folder.mimeType || '',
    canShare: folder.capabilities ? folder.capabilities.canShare !== false : null,
  };
}

module.exports = {
  DRIVE_SCOPE,
  buildFolderEnvName,
  getDriveAccessToken,
  getServiceAccountAccessToken,
  hasServiceAccountCredentials,
  shareFolderWithUser,
  shareProductAccess,
  verifyProductDriveAccess,
  __setFetch: (value) => {
    fetchImpl = value;
  },
  __resetForTests: () => {
    fetchImpl = (...args) => fetch(...args);
  },
};
