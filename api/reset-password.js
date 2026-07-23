const { getPool } = require('./_db');
const { hashPassword } = require('./_password');
const { hashToken } = require('./_session');

async function resetPassword(db, { token, password } = {}) {
  if (!token || !password || password.length < 8) {
    return { status: 400, body: { error: 'Datos inválidos.' } };
  }

  const claimResult = await db.query(
    'UPDATE password_resets SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id',
    [hashToken(token)]
  );

  if (claimResult.rows.length === 0) {
    return { status: 400, body: { error: 'Este enlace no es válido o ha caducado. Solicita uno nuevo.' } };
  }

  const userId = claimResult.rows[0].user_id;
  const passwordHash = hashPassword(password);
  // Clearing session_token_hash logs the account out everywhere, in case the reset was needed because of a compromised session too
  await db.query('UPDATE users SET password_hash = $1, session_token_hash = NULL WHERE id = $2', [passwordHash, userId]);

  return { status: 200, body: { ok: true } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await resetPassword(getPool(), req.body);
  res.status(result.status).json(result.body);
};

module.exports.resetPassword = resetPassword;
