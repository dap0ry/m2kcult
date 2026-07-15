const assert = require('assert');
const { registerUser, isValidEmail } = require('../api/register');

function createFakeDb(initialUsers = []) {
  const users = [...initialUsers];
  return {
    users,
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        const rows = users.filter((u) => u.email === params[0]);
        return { rows };
      }
      if (sql.startsWith('INSERT')) {
        const [name, email, password_hash] = params;
        users.push({ id: users.length + 1, name, email, password_hash });
        return { rows: [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  assert.strictEqual(isValidEmail('a@b.com'), true);
  assert.strictEqual(isValidEmail('not-an-email'), false);

  const db = createFakeDb();

  const badResult = await registerUser(db, { name: '', email: 'a@b.com', password: 'longenough' });
  assert.strictEqual(badResult.status, 400, 'missing name should be rejected');

  const shortPwResult = await registerUser(db, { name: 'Ana', email: 'a@b.com', password: 'short' });
  assert.strictEqual(shortPwResult.status, 400, 'password under 8 chars should be rejected');

  const okResult = await registerUser(db, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'valid registration should succeed');
  assert.strictEqual(okResult.body.ok, true);
  assert.strictEqual(db.users.length, 1, 'user should be inserted into db');
  assert.notStrictEqual(db.users[0].password_hash, 'longenough', 'password must be hashed, not stored in plain text');

  const dupResult = await registerUser(db, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(dupResult.status, 409, 'duplicate email should be rejected');

  console.log('OK: register handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
