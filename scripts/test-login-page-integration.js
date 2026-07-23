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
        if (err) {
          tryNext(i + 1);
          return;
        }
        res.writeHead(200);
        res.end(data);
      });
    };
    tryNext(0);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const FAKE_ACCOUNT = {
  name: 'Ana',
  email: 'ana@example.com',
  points: 1634,
  orders: [
    { code: 'VG24HJ8', points: 1634, amount_paid: 26.34, purchase_date: '2026-07-20', note: 'Gorra Blessed Enough', used_at: '2026-07-21T10:00:00Z' },
  ],
  claims: [],
};

(async () => {
  const server = await startStaticServer(path.resolve(__dirname, '..'));
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.route('**/api/register', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, name: 'Ana' }) });
  });
  await page.route('**/api/login', (route) => {
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Email o contraseña incorrectos.' }) });
  });
  await page.route('**/api/account', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_ACCOUNT) });
  });
  await page.route('**/api/logout', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/redeem-code', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, order: { points: 500, amount_paid: 8, purchase_date: '2026-07-22', note: 'Gorra nueva' } }),
    });
  });

  await page.goto(`http://127.0.0.1:${port}/login.html?form=register`);
  assert.ok(await page.locator('#reg-name').isVisible(), 'Nombre field should be visible on register form');

  await page.fill('#reg-name', 'Ana');
  await page.fill('#reg-email', 'ana@example.com');
  await page.fill('#reg-pw', 'longenough');
  await page.fill('#reg-confirm', 'longenough');
  await page.click('#register-card button[type="submit"]');

  await page.waitForSelector('#register-card .auth-title:has-text("correctamente")');
  await page.waitForURL('**/index.html', { timeout: 8000, waitUntil: 'domcontentloaded' });

  const loggedInFlag = await page.evaluate(() => localStorage.getItem('mk2cult_logged_in'));
  assert.strictEqual(loggedInFlag, '1', 'successful register should mark the browser as logged in');

  // "Cuenta" now navigates to the real /cuenta page instead of opening a modal in-place
  await Promise.all([
    page.waitForURL('**/cuenta', { timeout: 8000, waitUntil: 'domcontentloaded' }),
    page.click('.nav-account-link'),
  ]);
  await page.waitForSelector('#accountContent:not([hidden])');

  assert.strictEqual(await page.locator('#accountName').textContent(), 'Ana', 'account page should show the logged-in user name');
  assert.strictEqual(await page.locator('#accountEmail').textContent(), 'ana@example.com', 'account page should show the logged-in user email');
  const pointsDigits = (await page.locator('#accountPoints').textContent()).replace(/\D/g, '');
  assert.strictEqual(pointsDigits, '1634', 'account page should show the points balance from /api/account');
  assert.strictEqual(await page.locator('.account-order-card').count(), 1, 'account page should list the redeemed order');

  // Añadir código
  await page.fill('#accountCodeInput', 'AB12CD3');
  await page.click('.account-code-btn');
  await page.waitForSelector('#accountCodeMsg.visible.success');
  assert.ok((await page.locator('#accountCodeMsg').textContent()).includes('500'), 'success message should mention the points earned');

  // Cerrar sesión
  await Promise.all([
    page.waitForURL('**/', { timeout: 8000, waitUntil: 'domcontentloaded' }),
    page.click('#accountLogoutBtn'),
  ]);
  const loggedInAfterLogout = await page.evaluate(() => localStorage.getItem('mk2cult_logged_in'));
  assert.strictEqual(loggedInAfterLogout, null, 'logout should clear the logged-in flag from localStorage');

  await page.goto(`http://127.0.0.1:${port}/login.html`);
  await page.fill('#login-email', 'ana@example.com');
  await page.fill('#login-pw', 'wrongpassword');
  await page.click('#login-card button[type="submit"]');
  await page.waitForSelector('#login-error.visible');
  const errorText = await page.locator('#login-error').textContent();
  assert.strictEqual(errorText, 'Email o contraseña incorrectos.', 'failed login should show the server error message');

  await browser.close();
  server.close();
  console.log('OK: login.html / cuenta.html integration test passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
