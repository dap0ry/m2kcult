const crypto = require('crypto');

const COOKIE_NAME = 'm2k_session';
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // 180 days

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}`;
}

function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseSessionToken(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === COOKIE_NAME) return rest.join('=');
  }
  return null;
}

async function getUserFromRequest(db, req) {
  const token = parseSessionToken(req);
  if (!token) return null;
  const result = await db.query('SELECT id, name, email FROM users WHERE session_token_hash = $1', [hashToken(token)]);
  return result.rows[0] || null;
}

module.exports = {
  generateSessionToken,
  hashToken,
  sessionCookieHeader,
  clearCookieHeader,
  parseSessionToken,
  getUserFromRequest,
};
