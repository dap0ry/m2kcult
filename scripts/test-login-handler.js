const assert = require('assert');
const { loginUser } = require('../api/login');
const { hashPassword } = require('../api/_password');

function createFakeDb(initialUsers = []) {
  const users = [...initialUsers];
  return {
    users,
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        const rows = users.filter((u) => u.email === params[0]);
        return { rows };
      }
      if (sql.startsWith('UPDATE')) {
        const [sessionTokenHash, id] = params;
        const user = users.find((u) => u.id === id);
        if (user) user.session_token_hash = sessionTokenHash;
        return { rows: [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const db = createFakeDb([
    { id: 1, name: 'Ana', email: 'ana@example.com', password_hash: hashPassword('longenough') },
  ]);

  const missingResult = await loginUser(db, { email: 'ghost@example.com', password: 'longenough' });
  assert.strictEqual(missingResult.status, 401, 'unknown email should be rejected');

  const wrongPwResult = await loginUser(db, { email: 'ana@example.com', password: 'wrongpassword' });
  assert.strictEqual(wrongPwResult.status, 401, 'wrong password should be rejected');

  const okResult = await loginUser(db, { email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'correct credentials should succeed');
  assert.strictEqual(okResult.body.name, 'Ana');
  assert.ok(okResult.sessionToken && okResult.sessionToken.length > 0, 'successful login should issue a session token');
  assert.strictEqual(db.users[0].session_token_hash.length, 64, 'session token should be stored hashed (sha256 hex)');

  console.log('OK: login handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
