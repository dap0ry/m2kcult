const { getPool } = require('./_db');
const { getUserFromRequest } = require('./_session');

async function getAccountData(db, user) {
  const ordersResult = await db.query(
    'SELECT code, points, amount_paid, purchase_date, note, used_at FROM redemption_codes WHERE used_by_user_id = $1 ORDER BY purchase_date DESC NULLS LAST, used_at DESC',
    [user.id]
  );
  const claimsResult = await db.query(
    'SELECT claim_code, points_spent, discount_amount, status, created_at, fulfilled_at FROM discount_claims WHERE user_id = $1 ORDER BY created_at DESC',
    [user.id]
  );

  const orders = ordersResult.rows;
  const claims = claimsResult.rows;
  const earnedPoints = orders.reduce((sum, o) => sum + o.points, 0);
  const spentPoints = claims.reduce((sum, c) => sum + c.points_spent, 0);

  return {
    status: 200,
    body: {
      name: user.name,
      email: user.email,
      points: earnedPoints - spentPoints,
      orders,
      claims,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const db = getPool();
  const user = await getUserFromRequest(db, req);
  if (!user) {
    res.status(401).json({ error: 'No has iniciado sesión.' });
    return;
  }
  const result = await getAccountData(db, user);
  res.status(result.status).json(result.body);
};

module.exports.getAccountData = getAccountData;
