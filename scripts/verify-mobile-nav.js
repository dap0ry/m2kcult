const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  const url = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;
  await page.goto(url);

  assert.strictEqual(await page.locator('.nav-hamburger').isVisible(), true, 'hamburger should be visible on mobile');
  assert.strictEqual(await page.locator('.nav-links').isVisible(), false, 'desktop nav-links should be hidden on mobile');
  assert.strictEqual(await page.locator('.nav-account-link').isVisible(), false, 'Cuenta link should be hidden in header on mobile');
  assert.strictEqual(await page.locator('.nav-search-link').isVisible(), false, 'search icon should be hidden in header on mobile');
  assert.strictEqual(await page.locator('.cart-wrap').isVisible(), true, 'cart icon should stay visible on mobile');

  await page.click('#navHamburgerBtn');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    true,
    'overlay should open after hamburger click'
  );
  assert.strictEqual(await page.locator('.mobile-nav-links a').count(), 4, 'overlay should list 4 main nav links');

  await page.click('#mobileNavCloseBtn');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    false,
    'overlay should close after close button click'
  );

  await page.click('#navHamburgerBtn');
  await page.keyboard.press('Escape');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    false,
    'overlay should close on Escape key'
  );

  await page.click('#navHamburgerBtn');
  await page.mouse.click(5, 5);
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    false,
    'overlay should close on backdrop click'
  );

  await page.setViewportSize({ width: 1280, height: 800 });
  assert.strictEqual(await page.locator('.nav-hamburger').isVisible(), false, 'hamburger should be hidden on desktop');
  assert.strictEqual(await page.locator('.nav-links').isVisible(), true, 'desktop nav-links should be visible on desktop');

  await browser.close();
  console.log('OK: index.html mobile nav checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
