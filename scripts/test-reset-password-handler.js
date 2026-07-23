const assert = require('assert');
const { resetPassword } = require('../api/reset-password');
const { hashToken } = require('../api/_session');

function createFakeDb({ resets = [], users = [] } = {}) {
  const state = { resets: resets.map((r) => ({ ...r })), users: users.map((u) => ({ ...u })) };
  return {
    state,
    async query(sql, params) {
      if (sql.startsWith('UPDATE password_resets')) {
        const [tokenHash] = params;
        const now = new Date();
        const row = state.resets.find((r) => r.token_hash === tokenHash && !r.used_at && r.expires_at > now);
        if (!row) return { rows: [] };
        row.used_at = now;
        return { rows: [{ user_id: row.user_id }] };
      }
      if (sql.startsWith('UPDATE users')) {
        const [passwordHash, userId] = params;
        const user = state.users.find((u) => u.id === userId);
        if (user) {
          user.password_hash = passwordHash;
          user.session_token_hash = null;
        }
        return { rows: [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const token = 'validtoken123';
  const db = createFakeDb({
    resets: [{ user_id: 1, token_hash: hashToken(token), expires_at: new Date(Date.now() + 60 * 60 * 1000) }],
    users: [{ id: 1, password_hash: 'oldhash', session_token_hash: 'oldsession' }],
  });

  const shortPwResult = await resetPassword(db, { token, password: 'short' });
  assert.strictEqual(shortPwResult.status, 400, 'password under 8 chars should be rejected');

  const badTokenResult = await resetPassword(db, { token: 'nope', password: 'longenough' });
  assert.strictEqual(badTokenResult.status, 400, 'an unknown token should be rejected');

  const okResult = await resetPassword(db, { token, password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'a valid token should reset the password');
  assert.notStrictEqual(db.state.users[0].password_hash, 'oldhash', 'password hash should be updated');
  assert.strictEqual(db.state.users[0].session_token_hash, null, 'resetting the password should log the account out everywhere');

  const reuseResult = await resetPassword(db, { token, password: 'anotherlongpw' });
  assert.strictEqual(reuseResult.status, 400, 'a used token should be rejected on a second attempt');

  const expiredDb = createFakeDb({
    resets: [{ user_id: 2, token_hash: hashToken('expiredtoken'), expires_at: new Date(Date.now() - 1000) }],
    users: [{ id: 2, password_hash: 'oldhash2' }],
  });
  const expiredResult = await resetPassword(expiredDb, { token: 'expiredtoken', password: 'longenough' });
  assert.strictEqual(expiredResult.status, 400, 'an expired token should be rejected');

  console.log('OK: reset-password handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
