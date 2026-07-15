const assert = require('assert');
const { sendWelcomeEmail, buildWelcomeEmailHtml } = require('../api/_email');

function createFakeBrevoClient() {
  return {
    calls: [],
    async send(payload) {
      this.calls.push(payload);
      return { messageId: 'fake-id' };
    },
  };
}

(async () => {
  const html = buildWelcomeEmailHtml('Ana');
  assert.ok(html.includes('Ana'), 'email HTML should greet the user by name');
  assert.ok(html.includes('logo-negro'), 'email should use the black M2KCULT logo, not the Blessed Enough cap logo');
  assert.ok(!html.includes('blessed-enough-gorra'), 'email should NOT use the Blessed Enough gorra logo');
  assert.ok(html.includes('whatsapp-184347-2'), 'email should include the first campaign photo');
  assert.ok(html.includes('a743133'), 'email should include the second campaign photo');
  assert.ok(html.includes('Gracias por apoyar la marca'), 'email should thank the user for supporting the brand');
  assert.ok(html.includes('antes de que sal'), 'email should mention being notified before drops launch');

  const client = createFakeBrevoClient();
  await sendWelcomeEmail(client, { toEmail: 'ana@example.com', toName: 'Ana' });
  assert.strictEqual(client.calls.length, 1, 'should call the email client exactly once');
  const call = client.calls[0];
  assert.strictEqual(call.to[0].email, 'ana@example.com');
  assert.strictEqual(call.to[0].name, 'Ana');
  assert.ok(call.subject.length > 0, 'should have a subject');
  assert.ok(call.htmlContent.includes('Ana'));

  console.log('OK: email module tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
