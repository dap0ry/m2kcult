const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const filePath = path.join(rootDir, decodeURIComponent(req.url.split('?')[0]));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200);
      res.end(data);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

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

  await page.goto(`http://127.0.0.1:${port}/login.html?form=register`);
  assert.ok(await page.locator('#reg-name').isVisible(), 'Nombre field should be visible on register form');

  await page.fill('#reg-name', 'Ana');
  await page.fill('#reg-email', 'ana@example.com');
  await page.fill('#reg-pw', 'longenough');
  await page.fill('#reg-confirm', 'longenough');
  await page.click('#register-card button[type="submit"]');
  await page.waitForURL('**/index.html');
  const storedUser = await page.evaluate(() => localStorage.getItem('mk2cult_user'));
  assert.strictEqual(storedUser, 'Ana', 'successful register should store the returned name in localStorage');

  await page.evaluate(() => localStorage.clear());
  await page.goto(`http://127.0.0.1:${port}/login.html`);
  await page.fill('#login-email', 'ana@example.com');
  await page.fill('#login-pw', 'wrongpassword');
  await page.click('#login-card button[type="submit"]');
  await page.waitForSelector('#login-error.visible');
  const errorText = await page.locator('#login-error').textContent();
  assert.strictEqual(errorText, 'Email o contraseña incorrectos.', 'failed login should show the server error message');

  await browser.close();
  server.close();
  console.log('OK: login.html integration test passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
