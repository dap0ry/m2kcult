const assert = require('assert');
const { redeemCode } = require('../api/redeem-code');

function createFakeDb(initialCodes = []) {
  const codes = initialCodes.map((c) => ({ ...c }));
  return {
    codes,
    async query(sql, params) {
      if (sql.startsWith('UPDATE')) {
        const [userId, code] = params;
        const row = codes.find((c) => c.code === code && c.used_by_user_id == null);
        if (!row) return { rows: [] };
        row.used_by_user_id = userId;
        row.used_at = new Date();
        return { rows: [{ points: row.points, amount_paid: row.amount_paid, purchase_date: row.purchase_date, note: row.note }] };
      }
      if (sql.startsWith('SELECT')) {
        const [code] = params;
        const row = codes.find((c) => c.code === code);
        return { rows: row ? [{ id: row.id }] : [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const db = createFakeDb([
    { id: 1, code: 'VG24HJ8', points: 1634, amount_paid: 26.34, purchase_date: '2026-07-20', note: 'Gorra Blessed Enough', used_by_user_id: null },
  ]);

  const missingResult = await redeemCode(db, 7, { code: '' });
  assert.strictEqual(missingResult.status, 400, 'empty code should be rejected');

  const notFoundResult = await redeemCode(db, 7, { code: 'ZZZZZZZ' });
  assert.strictEqual(notFoundResult.status, 404, 'unknown code should be rejected');

  const okResult = await redeemCode(db, 7, { code: 'vg24hj8' }); // lowercase input should still normalize and match
  assert.strictEqual(okResult.status, 200, 'a valid, unused code should redeem successfully');
  assert.strictEqual(okResult.body.order.points, 1634);
  assert.strictEqual(okResult.body.order.note, 'Gorra Blessed Enough');

  const reuseResult = await redeemCode(db, 9, { code: 'VG24HJ8' });
  assert.strictEqual(reuseResult.status, 409, 'an already-used code should be rejected, even for a different account');

  console.log('OK: redeem-code handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
