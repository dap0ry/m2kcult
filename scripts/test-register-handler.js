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

function createFakeEmailClient({ shouldFail = false } = {}) {
  return {
    calls: [],
    async send(payload) {
      if (shouldFail) throw new Error('simulated Brevo outage');
      this.calls.push(payload);
      return { messageId: 'fake-id' };
    },
  };
}

(async () => {
  assert.strictEqual(isValidEmail('a@b.com'), true);
  assert.strictEqual(isValidEmail('not-an-email'), false);

  const db = createFakeDb();
  const emailClient = createFakeEmailClient();

  const badResult = await registerUser(db, emailClient, { name: '', email: 'a@b.com', password: 'longenough' });
  assert.strictEqual(badResult.status, 400, 'missing name should be rejected');
  assert.strictEqual(emailClient.calls.length, 0, 'invalid registration should not send an email');

  const shortPwResult = await registerUser(db, emailClient, { name: 'Ana', email: 'a@b.com', password: 'short' });
  assert.strictEqual(shortPwResult.status, 400, 'password under 8 chars should be rejected');

  const okResult = await registerUser(db, emailClient, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'valid registration should succeed');
  assert.strictEqual(okResult.body.ok, true);
  assert.strictEqual(db.users.length, 1, 'user should be inserted into db');
  assert.notStrictEqual(db.users[0].password_hash, 'longenough', 'password must be hashed, not stored in plain text');
  assert.strictEqual(emailClient.calls.length, 1, 'successful registration should send exactly one welcome email');
  assert.strictEqual(emailClient.calls[0].to[0].email, 'ana@example.com');

  const dupResult = await registerUser(db, emailClient, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(dupResult.status, 409, 'duplicate email should be rejected');
  assert.strictEqual(emailClient.calls.length, 1, 'duplicate registration should not send another email');

  const brokenEmailClient = createFakeEmailClient({ shouldFail: true });
  const resilientResult = await registerUser(db, brokenEmailClient, { name: 'Bea', email: 'bea@example.com', password: 'longenough' });
  assert.strictEqual(resilientResult.status, 200, 'registration should still succeed even if the welcome email fails to send');

  console.log('OK: register handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
