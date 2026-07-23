const { getPool } = require('./_db');
const { hashPassword } = require('./_password');
const { sendWelcomeEmail, createBrevoClient } = require('./_email');
const { generateSessionToken, hashToken, sessionCookieHeader } = require('./_session');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function registerUser(db, emailClient, { name, email, password } = {}) {
  if (!name || !isValidEmail(email) || !password || password.length < 8) {
    return { status: 400, body: { error: 'Datos inválidos.' } };
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return { status: 409, body: { error: 'Ya existe una cuenta con ese email.' } };
  }

  const passwordHash = hashPassword(password);
  const sessionToken = generateSessionToken();
  await db.query(
    'INSERT INTO users (name, email, password_hash, session_token_hash) VALUES ($1, $2, $3, $4)',
    [name, email, passwordHash, hashToken(sessionToken)]
  );

  try {
    await sendWelcomeEmail(emailClient, { toEmail: email, toName: name });
  } catch (err) {
    console.error('Welcome email failed to send:', err.message);
  }

  return { status: 200, body: { ok: true, name }, sessionToken };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await registerUser(getPool(), createBrevoClient(), req.body);
  if (result.sessionToken) {
    res.setHeader('Set-Cookie', sessionCookieHeader(result.sessionToken));
  }
  res.status(result.status).json(result.body);
};

module.exports.registerUser = registerUser;
module.exports.isValidEmail = isValidEmail;
