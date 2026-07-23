const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const candidates = urlPath === '/' ? ['index.html'] : [urlPath, `${urlPath}.html`];
    const tryNext = (i) => {
      if (i >= candidates.length) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      fs.readFile(path.join(rootDir, candidates[i]), (err, data) => {
        if (err) return tryNext(i + 1);
        res.writeHead(200);
        res.end(data);
      });
    };
    tryNext(0);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const server = await startStaticServer(path.resolve(__dirname, '..'));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // ── "¿Olvidaste tu contraseña?" from the login card ──
  await page.route('**/api/forgot-password', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, message: 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer tu contraseña.' }),
    });
  });

  await page.goto(`http://127.0.0.1:${port}/login.html`);
  await page.click('.auth-forgot');
  assert.ok(await page.locator('#forgot-card').isVisible(), 'forgot-password card should show after clicking the link');
  assert.ok(!(await page.locator('#login-card').isVisible()), 'login card should hide while the forgot-password card is shown');

  await page.fill('#forgot-email', 'ana@example.com');
  await page.click('#forgot-card button[type="submit"]');
  await page.waitForSelector('#forgot-card .auth-title:has-text("Revisa tu correo")');
  assert.ok(
    (await page.locator('#forgot-card .auth-subtitle').textContent()).includes('hemos enviado un enlace'),
    'confirmation message should tell the user to check their email'
  );

  // ── Following the emailed link to /restablecer-contrasena?token=... ──
  await page.route('**/api/reset-password', (route) => {
    const body = JSON.parse(route.request().postData());
    if (body.password.length < 8) {
      route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Datos inválidos.' }) });
      return;
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  // No token at all -> should show an invalid-link state, not a form
  await page.goto(`http://127.0.0.1:${port}/restablecer-contrasena`);
  await page.waitForSelector('#reset-card .auth-title:has-text("Enlace no válido")');

  // With a token -> shows the real form
  await page.goto(`http://127.0.0.1:${port}/restablecer-contrasena?token=FAKE-TOKEN-123`);
  assert.ok(await page.locator('#reset-pw').isVisible(), 'password field should be visible with a token present');

  // Mismatched passwords should be rejected client-side before hitting the API
  await page.fill('#reset-pw', 'longenough1');
  await page.fill('#reset-confirm', 'longenough2');
  await page.click('#reset-form button[type="submit"]');
  await page.waitForSelector('#reset-error.visible');
  assert.strictEqual(await page.locator('#reset-error').textContent(), 'Las contraseñas no coinciden.');

  // Matching, valid passwords should succeed and redirect to login
  await page.fill('#reset-pw', 'longenough1');
  await page.fill('#reset-confirm', 'longenough1');
  await Promise.all([
    page.waitForSelector('#reset-card .auth-title:has-text("actualizada")'),
    page.click('#reset-form button[type="submit"]'),
  ]);
  await page.waitForURL('**/login.html', { timeout: 8000, waitUntil: 'domcontentloaded' });

  await browser.close();
  server.close();
  console.log('OK: password reset flow test passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
