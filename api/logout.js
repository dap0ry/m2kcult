const { getPool } = require('./_db');
const { getUserFromRequest, clearCookieHeader } = require('./_session');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const db = getPool();
  const user = await getUserFromRequest(db, req);
  if (user) {
    await db.query('UPDATE users SET session_token_hash = NULL WHERE id = $1', [user.id]);
  }
  res.setHeader('Set-Cookie', clearCookieHeader());
  res.status(200).json({ ok: true });
};
