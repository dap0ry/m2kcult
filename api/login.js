const { getPool } = require('./_db');
const { verifyPassword } = require('./_password');
const { generateSessionToken, hashToken, sessionCookieHeader } = require('./_session');

async function loginUser(db, { email, password } = {}) {
  if (!email || !password) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  const result = await db.query('SELECT id, name, password_hash FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  const user = result.rows[0];
  if (!verifyPassword(password, user.password_hash)) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  const sessionToken = generateSessionToken();
  await db.query('UPDATE users SET session_token_hash = $1 WHERE id = $2', [hashToken(sessionToken), user.id]);

  return { status: 200, body: { ok: true, name: user.name }, sessionToken };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await loginUser(getPool(), req.body);
  if (result.sessionToken) {
    res.setHeader('Set-Cookie', sessionCookieHeader(result.sessionToken));
  }
  res.status(result.status).json(result.body);
};

module.exports.loginUser = loginUser;
