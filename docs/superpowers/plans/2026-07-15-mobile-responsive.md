# Mobile / iPhone Responsive Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working mobile navigation (full-screen hamburger overlay), fix the mobile hero height calculation, add iPhone safe-area support, and add a small-phone breakpoint across all 7 real pages of the M2KCULT static site.

**Architecture:** Pure HTML/CSS/vanilla JS, no build step, no framework, no new npm dependencies. One new shared `js/nav.js` file is included on every page and toggles a `.mobile-nav-overlay` (same pattern as the existing `.popup-overlay` in `js/main.js`). CSS changes live entirely inside `css/style.css`, mostly inside the existing `@media (max-width: 768px)` block plus one new `@media (max-width: 430px)` block. Verification uses the `playwright` package (already in `node_modules`, no `@playwright/test` installed) driven by small Node scripts under `scripts/` that use `assert` and exit non-zero on failure — this stands in for a test runner in a static site with none configured.

**Tech Stack:** HTML5, CSS3 (Grid/Flexbox, `env()`), vanilla JS (no modules), `playwright` (Chromium) for verification scripts run via `node`.

## Global Constraints
- No new npm dependencies — use the `playwright` package already installed (`node_modules/playwright`), driven with plain Node scripts (`assert` + `chromium.launch()`), not `@playwright/test`.
- `register.html` is a client-side redirect stub (`window.location.replace('login.html?form=register')`) with no header markup — it is **out of scope**, do not modify it.
- The 7 in-scope pages are: `index.html`, `colecciones.html`, `contacto.html`, `login.html`, `product.html`, `product-black-snapback.html`, `product-godmusicera-black-hoodie.html`.
- Desktop layout (≥769px) must be pixel-identical to today — all new rules for the hamburger/overlay/reordering live inside `@media (max-width: 768px)`, and the hamburger button itself defaults to `display: none` outside any media query.
- Every verification script must load pages via `file://` (no dev server needed) using `require('url').pathToFileURL(...)`, print `OK: <description>` on success, and `process.exit(1)` with the thrown error on failure.
- `js/nav.js` must not redeclare any identifier used by `js/main.js` (`overlay`, `closePopup`, `handleSubmit`) since `index.html` loads both scripts in the same global scope.

---

### Task 1: CSS foundation, `js/nav.js`, and reference implementation on `index.html`

**Files:**
- Create: `scripts/verify-mobile-nav.js`
- Modify: `css/style.css:124-125` (insert new block after `.cart-count`, before `.hero` at line 127)
- Modify: `css/style.css:951-1003` (existing `@media (max-width: 768px)` block)
- Create: `js/nav.js`
- Modify: `index.html:5` (viewport meta)
- Modify: `index.html:18-47` (header markup)
- Modify: `index.html:228` (script includes, before `</body>`)

**Interfaces:**
- Produces (used by Task 2 on the other 6 pages, verbatim): CSS classes `.nav-hamburger`, `.mobile-nav-overlay`, `.mobile-nav-overlay.open`, `.mobile-nav-close`, `.mobile-nav-links`, `.mobile-nav-divider`, `.mobile-nav-secondary`, `.nav-account-link`, `.nav-search-link`; element IDs `navHamburgerBtn`, `mobileNavOverlay`, `mobileNavCloseBtn`; script tag `<script src="js/nav.js"></script>`.
- Produces (used by Task 4): the `.hero` mobile height formula and `.site-header` safe-area padding, to be regression-checked at the end.

- [ ] **Step 1: Write the verification script first**

Create `scripts/verify-mobile-nav.js`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails (red)**

```bash
node scripts/verify-mobile-nav.js
```
Expected: the script throws on the first assertion — `.nav-hamburger` does not exist yet in `index.html`, so `isVisible()` returns `false` against the expected `true`, printing something like `AssertionError [ERR_ASSERTION]: hamburger should be visible on mobile` and exiting with code 1.

- [ ] **Step 3: Add the mobile-nav CSS (hamburger trigger + full-screen overlay)**

Insert after line 124 (`}` that closes `.cart-count`) and before the `/* ── Popup Overlay ──` comment / `.hero` rule at line 127, in `css/style.css`:

```css
/* ── Mobile Nav ── */
.nav-hamburger {
  display: none;
  background: none;
  border: none;
  padding: 6px;
  margin: 0;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

.mobile-nav-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-nav-overlay.open {
  opacity: 1;
  pointer-events: all;
}

.mobile-nav-close {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top, 0px));
  right: 20px;
  background: none;
  border: none;
  font-size: 30px;
  line-height: 1;
  color: #fff;
  cursor: pointer;
  transition: opacity 0.2s;
}

.mobile-nav-close:hover {
  opacity: 0.5;
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
}

.mobile-nav-links a {
  font-family: 'Cormorant Garamond', serif;
  font-size: 26px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #fff;
  text-decoration: none;
  transition: opacity 0.2s;
}

.mobile-nav-links a:hover {
  opacity: 0.5;
}

.mobile-nav-divider {
  width: 40px;
  height: 1px;
  background: rgba(255, 255, 255, 0.3);
  margin: 34px 0;
}

.mobile-nav-secondary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.mobile-nav-secondary a {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: opacity 0.2s;
}

.mobile-nav-secondary a:hover {
  opacity: 0.5;
}
```

- [ ] **Step 4: Wire the mobile layout, safe-area and hero fix into the existing `@media (max-width: 768px)` block**

In `css/style.css`, inside the block starting at line 951, replace the `.site-header` rule (currently lines 952-956):

```css
  .site-header {
    padding: 0 16px;
    height: 54px;
    grid-template-columns: 1fr 1fr;
  }
```

with:

```css
  .site-header {
    padding: env(safe-area-inset-top, 0px) 16px 0;
    height: calc(54px + env(safe-area-inset-top, 0px));
    grid-template-columns: auto 1fr auto;
    column-gap: 12px;
  }

  .nav-hamburger {
    display: flex;
  }

  .nav-logo {
    justify-self: center;
  }

  .nav-actions .nav-account-link,
  .nav-actions .nav-search-link {
    display: none;
  }
```

> **Note from execution:** the selector must be `.nav-actions .nav-account-link` (not bare `.nav-account-link`) — the pre-existing `.nav-actions a { display: flex; }` rule has specificity (0,1,1), which beats a bare single-class selector (0,1,0) and would otherwise keep these links visible.

Then, still inside the same media query, add the hero fix right after the `.nav-links { display: none; }` rule (currently lines 958-960):

```css
  .hero {
    height: calc(100vh - 42px - 54px - env(safe-area-inset-top, 0px) - 55px);
  }
```

- [ ] **Step 5: Create `js/nav.js`**

```js
const navHamburgerBtn = document.getElementById('navHamburgerBtn');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const mobileNavCloseBtn = document.getElementById('mobileNavCloseBtn');

function openMobileNav() {
  mobileNavOverlay.classList.add('open');
  navHamburgerBtn.setAttribute('aria-expanded', 'true');
}

function closeMobileNav() {
  mobileNavOverlay.classList.remove('open');
  navHamburgerBtn.setAttribute('aria-expanded', 'false');
}

navHamburgerBtn.addEventListener('click', openMobileNav);
mobileNavCloseBtn.addEventListener('click', closeMobileNav);

mobileNavOverlay.addEventListener('click', (e) => {
  if (e.target === mobileNavOverlay) closeMobileNav();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMobileNav();
});
```

- [ ] **Step 6: Update `index.html` — viewport meta, header markup, overlay markup, script include**

Line 5, change:
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
```
to:
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Lines 18-47 (the whole `<header class="site-header">...</header>` block), replace with:

```html
  <header class="site-header">
    <button class="nav-hamburger" id="navHamburgerBtn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileNavOverlay">
      <svg class="nav-icon" viewBox="0 0 24 24">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <a class="nav-logo" href="#">
      <img src="assets/logos/logoBlanco.png" alt="M2KCULT">
    </a>

    <ul class="nav-links">
      <li><a href="colecciones.html">Colecciones</a></li>
      <li><a href="#coleccion">Tienda</a></li>
      <li><a href="#">Archivo</a></li>
      <li><a href="contacto.html">Contacto</a></li>
    </ul>

    <div class="nav-actions">
      <a href="login.html" class="nav-account-link">Cuenta</a>
      <a href="#" class="nav-search-link">
        <svg class="nav-icon" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </a>
      <a href="#" class="cart-wrap">
        <svg class="nav-icon" viewBox="0 0 24 24">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span class="cart-count">0</span>
      </a>
    </div>
  </header>

  <div class="mobile-nav-overlay" id="mobileNavOverlay">
    <button class="mobile-nav-close" id="mobileNavCloseBtn" type="button" aria-label="Cerrar menú">&times;</button>
    <nav class="mobile-nav-links">
      <a href="colecciones.html">Colecciones</a>
      <a href="#coleccion">Tienda</a>
      <a href="#">Archivo</a>
      <a href="contacto.html">Contacto</a>
    </nav>
    <div class="mobile-nav-divider"></div>
    <div class="mobile-nav-secondary">
      <a href="login.html">Cuenta</a>
      <a href="#">Buscar</a>
    </div>
  </div>
```

Line 228, change:
```html
  <script src="js/main.js"></script>
```
to:
```html
  <script src="js/main.js"></script>
  <script src="js/nav.js"></script>
```

- [ ] **Step 7: Run it and confirm it passes (green)**

```bash
node scripts/verify-mobile-nav.js
```
Expected: `OK: index.html mobile nav checks passed` and exit code 0.

- [ ] **Step 8: Commit**

```bash
git add css/style.css js/nav.js index.html scripts/verify-mobile-nav.js
git commit -m "feat: add mobile hamburger nav overlay to index.html"
```

---

### Task 2: Roll out the mobile nav to the remaining 6 pages

**Files:**
- Create: `scripts/verify-mobile-nav-all-pages.js` (supersedes `scripts/verify-mobile-nav.js`)
- Modify: `colecciones.html:5` (viewport), `colecciones.html:18-47` (header), before `</body>` (script include)
- Modify: `contacto.html:5` (viewport), `contacto.html:30-57` (header), after existing inline `<script>` block (script include)
- Modify: `login.html:5` (viewport), `login.html:30-57` (header), after existing inline `<script>` block (script include)
- Modify: `product.html:5` (viewport), `product.html:18-47` (header), before `</body>` (script include)
- Modify: `product-black-snapback.html:5` (viewport), `product-black-snapback.html:18-47` (header), before `</body>` (script include)
- Modify: `product-godmusicera-black-hoodie.html:5` (viewport), `product-godmusicera-black-hoodie.html:18-47` (header), after existing inline `<script>` block (script include)

**Interfaces:**
- Consumes: CSS classes/IDs and `js/nav.js` produced in Task 1 — no changes to `css/style.css` or `js/nav.js` in this task.
- Produces: identical mobile-nav markup present on all 7 in-scope pages, verified in a loop.

- [ ] **Step 1: Write the 7-page verification script first**

Create `scripts/verify-mobile-nav-all-pages.js`:

```js
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

const PAGES = [
  'index.html',
  'colecciones.html',
  'contacto.html',
  'login.html',
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
  assert.strictEqual(await page.locator('.cart-wrap').isVisible(), true, `${fileName}: cart icon should stay visible on mobile`);

  await page.click('#navHamburgerBtn');
  assert.strictEqual(
    await page.locator('#mobileNavOverlay').evaluate((el) => el.classList.contains('open')),
    true,
    `${fileName}: overlay should open after hamburger click`
  );
  assert.strictEqual(await page.locator('.mobile-nav-links a').count(), 4, `${fileName}: overlay should list 4 main nav links`);

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
```

- [ ] **Step 2: Run it and confirm it fails (red)**

```bash
node scripts/verify-mobile-nav-all-pages.js
```
Expected: `OK: index.html mobile nav checks passed` (Task 1 already made this one pass), then an `AssertionError` on `colecciones.html` (`hamburger should be visible on mobile`) with a non-zero exit — the other 6 pages don't have the markup yet.

- [ ] **Step 3: Roll out the markup to `colecciones.html`, `product.html`, `product-black-snapback.html`**

These 3 files have no `<script>` tag before `</body>` and use `href="index.html"` on the logo / `href="index.html#coleccion"` on Tienda (same as their existing `.nav-links`).

In each file's line 5, same change as Task 1 Step 6:
```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Replace the `<header class="site-header">...</header>` block (lines 18-47 in each) with:

```html
  <header class="site-header">
    <button class="nav-hamburger" id="navHamburgerBtn" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileNavOverlay">
      <svg class="nav-icon" viewBox="0 0 24 24">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>

    <a class="nav-logo" href="index.html">
      <img src="assets/logos/logoBlanco.png" alt="M2KCULT">
    </a>

    <ul class="nav-links">
      <li><a href="colecciones.html">Colecciones</a></li>
      <li><a href="index.html#coleccion">Tienda</a></li>
      <li><a href="#">Archivo</a></li>
      <li><a href="contacto.html">Contacto</a></li>
    </ul>

    <div class="nav-actions">
      <a href="login.html" class="nav-account-link">Cuenta</a>
      <a href="#" class="nav-search-link">
        <svg class="nav-icon" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </a>
      <a href="#" class="cart-wrap">
        <svg class="nav-icon" viewBox="0 0 24 24">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span class="cart-count">0</span>
      </a>
    </div>
  </header>

  <div class="mobile-nav-overlay" id="mobileNavOverlay">
    <button class="mobile-nav-close" id="mobileNavCloseBtn" type="button" aria-label="Cerrar menú">&times;</button>
    <nav class="mobile-nav-links">
      <a href="colecciones.html">Colecciones</a>
      <a href="index.html#coleccion">Tienda</a>
      <a href="#">Archivo</a>
      <a href="contacto.html">Contacto</a>
    </nav>
    <div class="mobile-nav-divider"></div>
    <div class="mobile-nav-secondary">
      <a href="login.html">Cuenta</a>
      <a href="#">Buscar</a>
    </div>
  </div>
```

Add immediately before the closing `</body>` tag (these 3 files currently have no `<script>` before `</body>`):
```html
  <script src="js/nav.js"></script>
```

- [ ] **Step 4: Roll out the markup to `contacto.html`, `login.html`, `product-godmusicera-black-hoodie.html`**

These 3 files use the same `href="index.html"` / `href="index.html#coleccion"` links and get the identical viewport-meta and header/overlay changes from Step 3, applied at `contacto.html:5`/`30-57`, `login.html:5`/`30-57`, `product-godmusicera-black-hoodie.html:5`/`18-47` — but each already has its own inline `<script>...</script>` block before `</body>`, so the include goes after it instead of standing alone:

For `contacto.html`, after the existing `</script>` that closes the `handleContact` block (currently ending at line 104, right before `</body>`):
```html
  <script src="js/nav.js"></script>
```

For `login.html`, after the existing `</script>` that closes the large auth-logic block (currently ending at line 221, right before `</body>`):
```html
  <script src="js/nav.js"></script>
```

For `product-godmusicera-black-hoodie.html`, after the existing `</script>` that closes the size-selector block (currently ending at line 128, right before `</body>`):
```html
  <script src="js/nav.js"></script>
```

- [ ] **Step 5: Run it and confirm all 7 pages pass (green)**

```bash
node scripts/verify-mobile-nav-all-pages.js
```
Expected: 7 lines of `OK: <file>.html mobile nav checks passed`, exit code 0.

- [ ] **Step 6: Delete the now-superseded single-page script and commit**

```bash
git rm scripts/verify-mobile-nav.js
git add colecciones.html contacto.html login.html product.html product-black-snapback.html product-godmusicera-black-hoodie.html scripts/verify-mobile-nav-all-pages.js
git commit -m "feat: roll out mobile hamburger nav to all remaining pages"
```

---

### Task 3: Small-phone breakpoint (≤430px) refinements

**Files:**
- Create: `scripts/verify-small-phone.js`
- Modify: `css/style.css` (append new block after the `@media (max-width: 768px)` block, i.e. after line 1003 as it stood before Task 1 — re-check current line number after Tasks 1-2 edits before inserting)

**Interfaces:**
- Consumes: `.products-collection` (defined at `css/style.css:459`), `.product-info-sticky` (defined at `css/style.css:999` pre-Task-1, class used in `product.html`/`product-black-snapback.html`/`product-godmusicera-black-hoodie.html`).
- Produces: nothing consumed by later tasks — this is a leaf CSS tweak.

- [ ] **Step 1: Write the verification script first**

Create `scripts/verify-small-phone.js`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails (red)**

```bash
node scripts/verify-small-phone.js
```
Expected: `AssertionError` — at 430px/768px there is not yet a distinct small-phone breakpoint, so `.products-collection` font-size and `.product-info-sticky` padding are identical at 375px and 500px.

- [ ] **Step 3: Add the `@media (max-width: 430px)` block**

Append at the end of `css/style.css`:

```css

/* ── Small phones (iPhone SE and similar) ── */
@media (max-width: 430px) {
  .products-collection {
    font-size: 26px;
  }

  .product-info-sticky {
    padding: 32px 18px;
  }
}
```

- [ ] **Step 4: Run it and confirm it passes (green)**

```bash
node scripts/verify-small-phone.js
```
Expected: `OK: small-phone breakpoint checks passed` and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add css/style.css scripts/verify-small-phone.js
git commit -m "feat: add small-phone breakpoint for iPhone SE-width screens"
```

---

### Task 4: Full-site smoke test (no horizontal overflow, final regression)

**Files:**
- Create: `scripts/verify-no-horizontal-overflow.js`

**Interfaces:**
- Consumes: final state of all 7 pages and `css/style.css` from Tasks 1-3.
- Produces: nothing — this is the final regression gate for this plan.

- [ ] **Step 1: Write the smoke-test script**

Create `scripts/verify-no-horizontal-overflow.js`:

```js
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
const assert = require('assert');

const PAGES = [
  'index.html',
  'colecciones.html',
  'contacto.html',
  'login.html',
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
```

- [ ] **Step 2: Run it**

```bash
node scripts/verify-no-horizontal-overflow.js
```
Expected: 14 `OK:` lines (7 pages × 2 viewports), exit code 0. If any page fails, inspect that page's CSS for a fixed-width element wider than the viewport (common culprits: an image without `max-width: 100%`, or a flex/grid child without `min-width: 0`) and fix it in `css/style.css` before re-running.

- [ ] **Step 3: Run the full verification suite together as the final gate**

```bash
node scripts/verify-mobile-nav-all-pages.js && node scripts/verify-small-phone.js && node scripts/verify-no-horizontal-overflow.js
```
Expected: all three scripts print their `OK:` lines with no errors, combined exit code 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-no-horizontal-overflow.js
git commit -m "test: add full-site mobile horizontal-overflow smoke test"
```
