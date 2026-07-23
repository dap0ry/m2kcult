const assert = require('assert');
const { getAccountData } = require('../api/account');

function createFakeDb({ orders = [], claims = [] } = {}) {
  return {
    async query(sql, params) {
      const [userId] = params;
      if (sql.includes('FROM redemption_codes')) {
        return { rows: orders.filter((o) => o.used_by_user_id === userId) };
      }
      if (sql.includes('FROM discount_claims')) {
        return { rows: claims.filter((c) => c.user_id === userId) };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const db = createFakeDb({
    orders: [
      { used_by_user_id: 1, code: 'AAA1111', points: 1000, amount_paid: 16.0, purchase_date: '2026-07-01', note: 'Gorra' },
      { used_by_user_id: 1, code: 'BBB2222', points: 2000, amount_paid: 32.0, purchase_date: '2026-07-10', note: 'Sudadera' },
      { used_by_user_id: 2, code: 'CCC3333', points: 9999, amount_paid: 99.0, purchase_date: '2026-07-15', note: 'Otro usuario' },
    ],
    claims: [{ user_id: 1, claim_code: 'DESC-AAAAAA', points_spent: 500, discount_amount: 10, status: 'pending' }],
  });

  const result = await getAccountData(db, { id: 1, name: 'Ana', email: 'ana@example.com' });
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.body.name, 'Ana');
  assert.strictEqual(result.body.email, 'ana@example.com');
  assert.strictEqual(result.body.points, 2500, 'points should be earned points minus spent points');
  assert.strictEqual(result.body.orders.length, 2, "only this user's orders should be returned");
  assert.strictEqual(result.body.claims.length, 1, "only this user's claims should be returned");

  console.log('OK: account handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
