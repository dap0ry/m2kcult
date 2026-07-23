const crypto = require('crypto');
const { getPool } = require('./_db');
const { getUserFromRequest } = require('./_session');

const POINTS_PER_CLAIM = 10000;
const DISCOUNT_AMOUNT = 10.0;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L, easy to read out over chat

function generateClaimCode() {
  let code = 'DESC-';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

async function computePointsBalance(db, userId) {
  const ordersResult = await db.query('SELECT points FROM redemption_codes WHERE used_by_user_id = $1', [userId]);
  const claimsResult = await db.query('SELECT points_spent FROM discount_claims WHERE user_id = $1', [userId]);
  const earned = ordersResult.rows.reduce((sum, o) => sum + o.points, 0);
  const spent = claimsResult.rows.reduce((sum, c) => sum + c.points_spent, 0);
  return earned - spent;
}

async function claimDiscount(db, userId) {
  const balance = await computePointsBalance(db, userId);
  if (balance < POINTS_PER_CLAIM) {
    return { status: 400, body: { error: `Necesitas ${POINTS_PER_CLAIM} puntos para canjear un descuento.` } };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const claimCode = generateClaimCode();
    try {
      await db.query(
        'INSERT INTO discount_claims (user_id, claim_code, points_spent, discount_amount) VALUES ($1, $2, $3, $4)',
        [userId, claimCode, POINTS_PER_CLAIM, DISCOUNT_AMOUNT]
      );
      return {
        status: 200,
        body: { ok: true, claimCode, discountAmount: DISCOUNT_AMOUNT, points: balance - POINTS_PER_CLAIM },
      };
    } catch (err) {
      if (err && err.code === '23505') continue; // claim_code collision, try another
      throw err;
    }
  }
  return { status: 500, body: { error: 'No se pudo generar el código de descuento, inténtalo de nuevo.' } };
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
  const result = await claimDiscount(db, user.id);
  res.status(result.status).json(result.body);
};

module.exports.claimDiscount = claimDiscount;
module.exports.POINTS_PER_CLAIM = POINTS_PER_CLAIM;
