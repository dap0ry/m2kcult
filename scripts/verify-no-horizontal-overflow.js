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

const VIEWPORTS = [
  { width: 375, height: 812, name: 'iPhone SE' },
  { width: 390, height: 844, name: 'iPhone 14' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const fileName of PAGES) {
      const url = pathToFileURL(path.resolve(__dirname, '..', fileName)).href;
      await page.goto(url);

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      assert.ok(
        scrollWidth <= clientWidth + 1,
        `${fileName} at ${viewport.name} (${viewport.width}px): horizontal overflow detected (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`
      );
      console.log(`OK: ${fileName} @ ${viewport.name} has no horizontal overflow`);
    }
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
