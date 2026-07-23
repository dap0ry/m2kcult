const { getPool } = require('./_db');
const { sendPasswordResetEmail, createBrevoClient } = require('./_email');
const { generateSessionToken, hashToken } = require('./_session');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const GENERIC_BODY = {
  ok: true,
  message: 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer tu contraseña.',
};

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return `${proto}://${req.headers.host}`;
}

async function requestPasswordReset(db, emailClient, { email } = {}, baseUrl) {
  if (typeof email !== 'string' || !email) {
    return { status: 200, body: GENERIC_BODY };
  }

  const result = await db.query('SELECT id, name FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    // Same response as success so this endpoint can't be used to check which emails have accounts
    return { status: 200, body: GENERIC_BODY };
  }

  const user = result.rows[0];
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await db.query('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [
    user.id,
    hashToken(token),
    expiresAt,
  ]);

  const resetUrl = `${baseUrl}/restablecer-contrasena?token=${token}`;
  try {
    await sendPasswordResetEmail(emailClient, { toEmail: email, toName: user.name, resetUrl });
  } catch (err) {
    console.error('Password reset email failed to send:', err.message);
  }

  return { status: 200, body: GENERIC_BODY };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await requestPasswordReset(getPool(), createBrevoClient(), req.body, getBaseUrl(req));
  res.status(result.status).json(result.body);
};

module.exports.requestPasswordReset = requestPasswordReset;
