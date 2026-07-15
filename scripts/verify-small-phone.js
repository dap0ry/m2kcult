const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const collectionsUrl = pathToFileURL(path.resolve(__dirname, '..', 'colecciones.html')).href;
  await page.goto(collectionsUrl);

  await page.setViewportSize({ width: 500, height: 900 });
  const fontSizeAt500 = await page.locator('.products-collection').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.setViewportSize({ width: 375, height: 812 });
  const fontSizeAt375 = await page.locator('.products-collection').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  assert.ok(fontSizeAt375 < fontSizeAt500, `expected smaller .products-collection font-size at 375px (${fontSizeAt375}) than at 500px (${fontSizeAt500})`);

  const productUrl = pathToFileURL(path.resolve(__dirname, '..', 'product.html')).href;
  await page.goto(productUrl);

  await page.setViewportSize({ width: 500, height: 900 });
  const paddingAt500 = await page.locator('.product-info-sticky').evaluate((el) => getComputedStyle(el).padding);

  await page.setViewportSize({ width: 375, height: 812 });
  const paddingAt375 = await page.locator('.product-info-sticky').evaluate((el) => getComputedStyle(el).padding);

  assert.notStrictEqual(paddingAt375, paddingAt500, 'expected .product-info-sticky padding to change at 375px vs 500px');

  await browser.close();
  console.log('OK: small-phone breakpoint checks passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
