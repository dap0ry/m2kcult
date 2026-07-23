const assert = require('assert');
const { requestPasswordReset } = require('../api/forgot-password');

function createFakeDb(initialUsers = []) {
  const users = [...initialUsers];
  const resets = [];
  return {
    users,
    resets,
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        const rows = users.filter((u) => u.email === params[0]).map((u) => ({ id: u.id, name: u.name }));
        return { rows };
      }
      if (sql.startsWith('INSERT')) {
        const [userId, tokenHash, expiresAt] = params;
        resets.push({ userId, tokenHash, expiresAt });
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
  const db = createFakeDb([{ id: 1, name: 'Ana', email: 'ana@example.com' }]);
  const emailClient = createFakeEmailClient();
  const baseUrl = 'https://m2kcult.com';

  const unknownResult = await requestPasswordReset(db, emailClient, { email: 'ghost@example.com' }, baseUrl);
  assert.strictEqual(unknownResult.status, 200, 'unknown email should still respond 200 (no account enumeration)');
  assert.strictEqual(emailClient.calls.length, 0, 'unknown email should not trigger an email');
  assert.strictEqual(db.resets.length, 0, 'unknown email should not create a reset token');

  const missingResult = await requestPasswordReset(db, emailClient, {}, baseUrl);
  assert.strictEqual(missingResult.status, 200, 'missing email should still respond 200 (no account enumeration)');
  assert.strictEqual(emailClient.calls.length, 0);

  const okResult = await requestPasswordReset(db, emailClient, { email: 'ana@example.com' }, baseUrl);
  assert.strictEqual(okResult.status, 200);
  assert.strictEqual(emailClient.calls.length, 1, 'a known email should trigger exactly one email');
  assert.strictEqual(db.resets.length, 1, 'a known email should create exactly one reset token');
  const sentHtml = emailClient.calls[0].htmlContent;
  assert.ok(sentHtml.includes(`${baseUrl}/restablecer-contrasena?token=`), 'email should include a reset link pointing back to the site');
  assert.strictEqual(unknownResult.body.message, okResult.body.message, 'the response should be identical whether or not the email exists');

  const brokenEmailClient = createFakeEmailClient({ shouldFail: true });
  const resilientResult = await requestPasswordReset(db, brokenEmailClient, { email: 'ana@example.com' }, baseUrl);
  assert.strictEqual(resilientResult.status, 200, 'the request should still succeed even if the email fails to send');

  console.log('OK: forgot-password handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
