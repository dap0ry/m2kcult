const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

const PAGES = [
  'index.html',
  'colecciones.html',
  'contacto.html',
  'login.html',
  'restablecer-contrasena.html',
  'product.html',
  'product-black-snapback.html',
  'product-godmusicera-black-hoodie.html',
];

async function checkPage(browser, fileName) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  const url = pathToFileURL(path.resolve(__dirname, '..', fileName)).href;
  await page.goto(url);

  assert.strictEqual(await page.locator('.nav-hamburger').isVisible(), true, `${fileName}: hamburger should be visible on mobile`);
  assert.strictEqual(await page.locator('.nav-links').isVisible(), false, `${fileName}: desktop nav-links should be hidden on mobile`);

  const logoBox = await page.locator('.nav-logo').boundingBox();
  const logoCenter = logoBox.x + logoBox.width / 2;
  assert.ok(
    Math.abs(logoCenter - 195) < 10,
    `${fileName}: logo should stay horizontally centered on mobile (center at ${logoCenter}, expected ~195)`
  );

  await page.click('#navHamburgerBtn');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    true,
    `${fileName}: overlay should open after hamburger click`
  );
  assert.strictEqual(await page.locator('.mobile-nav-links a').count(), 3, `${fileName}: overlay should list 3 main nav links (Inicio, Tienda, Contacto)`);

  await page.click('#mobileNavCloseBtn');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    false,
    `${fileName}: overlay should close after close button click`
  );

  await page.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const fileName of PAGES) {
    await checkPage(browser, fileName);
    console.log(`OK: ${fileName} mobile nav checks passed`);
  }
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
