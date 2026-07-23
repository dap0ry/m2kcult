const assert = require('assert');
const { claimDiscount, POINTS_PER_CLAIM } = require('../api/claim-discount');

function createFakeDb({ orders = [], claims = [] } = {}) {
  const state = { orders: [...orders], claims: [...claims] };
  let insertAttempts = 0;
  return {
    state,
    forceCollisionOnce: false,
    async query(sql, params) {
      if (sql.startsWith('SELECT points FROM redemption_codes')) {
        const [userId] = params;
        return { rows: state.orders.filter((o) => o.used_by_user_id === userId).map((o) => ({ points: o.points })) };
      }
      if (sql.startsWith('SELECT points_spent FROM discount_claims')) {
        const [userId] = params;
        return { rows: state.claims.filter((c) => c.user_id === userId).map((c) => ({ points_spent: c.points_spent })) };
      }
      if (sql.startsWith('INSERT INTO discount_claims')) {
        insertAttempts++;
        const [userId, claimCode, pointsSpent, discountAmount] = params;
        const collision = (this.forceCollisionOnce && insertAttempts === 1) || state.claims.some((c) => c.claim_code === claimCode);
        if (collision) {
          const err = new Error('duplicate key value violates unique constraint');
          err.code = '23505';
          throw err;
        }
        state.claims.push({ user_id: userId, claim_code: claimCode, points_spent: pointsSpent, discount_amount: discountAmount, status: 'pending' });
        return { rows: [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const dbLow = createFakeDb({ orders: [{ used_by_user_id: 1, points: 5000 }] });
  const lowResult = await claimDiscount(dbLow, 1);
  assert.strictEqual(lowResult.status, 400, 'fewer than 10000 points should be rejected');

  const dbOk = createFakeDb({ orders: [{ used_by_user_id: 1, points: 12000 }] });
  const okResult = await claimDiscount(dbOk, 1);
  assert.strictEqual(okResult.status, 200, 'at least 10000 points should allow a claim');
  assert.ok(okResult.body.claimCode.startsWith('DESC-'), 'claim code should use the DESC- prefix');
  assert.strictEqual(okResult.body.points, 2000, 'remaining balance should reflect the points spent');
  assert.strictEqual(dbOk.state.claims.length, 1, 'a discount claim row should be inserted');

  const dbSpent = createFakeDb({
    orders: [{ used_by_user_id: 1, points: 15000 }],
    claims: [{ user_id: 1, claim_code: 'DESC-AAAAAA', points_spent: POINTS_PER_CLAIM }],
  });
  const afterClaimResult = await claimDiscount(dbSpent, 1);
  assert.strictEqual(afterClaimResult.status, 400, 'points already spent on a previous claim should not be claimable again');

  const dbCollision = createFakeDb({ orders: [{ used_by_user_id: 1, points: 20000 }] });
  dbCollision.forceCollisionOnce = true;
  const retryResult = await claimDiscount(dbCollision, 1);
  assert.strictEqual(retryResult.status, 200, 'a claim_code collision should be retried transparently');
  assert.strictEqual(dbCollision.state.claims.length, 1, 'exactly one claim should be inserted after retrying');

  console.log('OK: claim-discount handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
