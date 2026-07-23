const { getPool } = require('./_db');
const { getUserFromRequest } = require('./_session');

function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

async function redeemCode(db, userId, { code } = {}) {
  const normalized = normalizeCode(code);
  if (!normalized) {
    return { status: 400, body: { error: 'Introduce un código.' } };
  }

  const updateResult = await db.query(
    'UPDATE redemption_codes SET used_by_user_id = $1, used_at = now() WHERE code = $2 AND used_by_user_id IS NULL RETURNING points, amount_paid, purchase_date, note',
    [userId, normalized]
  );

  if (updateResult.rows.length > 0) {
    return { status: 200, body: { ok: true, order: updateResult.rows[0] } };
  }

  const existing = await db.query('SELECT id FROM redemption_codes WHERE code = $1', [normalized]);
  if (existing.rows.length === 0) {
    return { status: 404, body: { error: 'Código no válido.' } };
  }
  return { status: 409, body: { error: 'Este código ya ha sido utilizado.' } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const db = getPool();
  const user = await getUserFromRequest(db, req);
  if (!user) {
    res.status(401).json({ error: 'No has iniciado sesión.' });
    return;
  }
  const result = await redeemCode(db, user.id, req.body);
  res.status(result.status).json(result.body);
};

module.exports.redeemCode = redeemCode;
