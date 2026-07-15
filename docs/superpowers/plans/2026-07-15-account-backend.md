# Account Backend (Register/Login) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake `localStorage`-only register/login on `login.html` with real Vercel Serverless Functions backed by a free Neon Postgres database, storing name/email/password-hash.

**Architecture:** Two Vercel Node.js serverless functions (`api/register.js`, `api/login.js`) share a DB helper (`api/_db.js`, using the `pg` package against `POSTGRES_URL`) and a password-hashing helper (`api/_password.js`, using Node's built-in `crypto.scrypt` — no native-binding dependency). Handler business logic is factored into plain exported functions that accept an injectable `db` object (`{ query(sql, params) }`), so it can be unit-tested with an in-memory fake db with zero network/DB dependency; the default export wired to Vercel's `(req, res)` calls that same logic against the real `pg` pool.

**Tech Stack:** Node.js (Vercel Serverless Functions, CommonJS), `pg` (node-postgres), Node built-in `crypto`, Neon Postgres (via Vercel Storage), Vercel CLI for deployment.

## Global Constraints
- No sessions/cookies/JWT — endpoints only confirm success/failure; the frontend keeps marking "logged in" via `localStorage.setItem('mk2cult_user', name)` exactly as it does today.
- No email-sending in this plan — out of scope per the design doc (`docs/superpowers/specs/2026-07-15-account-backend-design.md`).
- Password minimum length stays 8 characters (already enforced client-side in `login.html`; enforce again server-side).
- All new Node code is CommonJS (`require`/`module.exports`), matching this being a plain (non-bundled) Vercel Node runtime project with no build step.
- Tests use plain `node <script>.js` + the built-in `assert` module (no test framework installed), matching the existing `scripts/verify-*.js` convention in this repo.

---

### Task 1: Password hashing module

**Files:**
- Create: `api/_password.js`
- Create: `scripts/test-password.js`

**Interfaces:**
- Produces (used by Tasks 2 and 3): `hashPassword(password: string): string` returns `"<saltHex>:<hashHex>"`. `verifyPassword(password: string, stored: string): boolean`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-password.js`:

```js
const assert = require('assert');
const { hashPassword, verifyPassword } = require('../api/_password');

const stored = hashPassword('correcthorsebattery');
assert.ok(stored.includes(':'), 'stored hash should be "salt:hash"');
assert.strictEqual(verifyPassword('correcthorsebattery', stored), true, 'correct password should verify');
assert.strictEqual(verifyPassword('wrongpassword', stored), false, 'wrong password should not verify');

const stored2 = hashPassword('correcthorsebattery');
assert.notStrictEqual(stored, stored2, 'same password hashed twice should produce different salts/output');

console.log('OK: password hashing tests passed');
```

- [ ] **Step 2: Run it and confirm it fails (red)**

Run: `node scripts/test-password.js`
Expected: `Error: Cannot find module '../api/_password'` (module doesn't exist yet), non-zero exit.

- [ ] **Step 3: Implement `api/_password.js`**

```js
const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(':');
  const hashBuffer = Buffer.from(hashHex, 'hex');
  const suppliedBuffer = crypto.scryptSync(password, salt, 64);
  return hashBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(hashBuffer, suppliedBuffer);
}

module.exports = { hashPassword, verifyPassword };
```

- [ ] **Step 4: Run it and confirm it passes (green)**

Run: `node scripts/test-password.js`
Expected: `OK: password hashing tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add api/_password.js scripts/test-password.js
git commit -m "feat: add scrypt-based password hashing module"
```

---

### Task 2: DB helper + `/api/register`

**Files:**
- Create: `api/_db.js`
- Create: `api/register.js`
- Create: `scripts/test-register-handler.js`
- Create: `db/schema.sql`
- Modify: `package.json` (add `pg` dependency)

**Interfaces:**
- Consumes: `hashPassword` from `api/_password.js` (Task 1).
- Produces (used by Task 4/5): `api/register.js` default-exports the Vercel `(req, res)` handler; also exports `registerUser(db, { name, email, password })` returning `{ status: number, body: object }`, and `isValidEmail(email)`, for direct testing and reuse.

- [ ] **Step 1: Add the `pg` dependency**

```bash
npm install pg
```

- [ ] **Step 2: Create the schema file**

Create `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: Create `api/_db.js`**

```js
const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

module.exports = { getPool };
```

- [ ] **Step 4: Write the failing test for the register handler logic**

Create `scripts/test-register-handler.js`:

```js
const assert = require('assert');
const { registerUser, isValidEmail } = require('../api/register');

function createFakeDb(initialUsers = []) {
  const users = [...initialUsers];
  return {
    users,
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        const rows = users.filter((u) => u.email === params[0]);
        return { rows };
      }
      if (sql.startsWith('INSERT')) {
        const [name, email, password_hash] = params;
        users.push({ id: users.length + 1, name, email, password_hash });
        return { rows: [] };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  assert.strictEqual(isValidEmail('a@b.com'), true);
  assert.strictEqual(isValidEmail('not-an-email'), false);

  const db = createFakeDb();

  const badResult = await registerUser(db, { name: '', email: 'a@b.com', password: 'longenough' });
  assert.strictEqual(badResult.status, 400, 'missing name should be rejected');

  const shortPwResult = await registerUser(db, { name: 'Ana', email: 'a@b.com', password: 'short' });
  assert.strictEqual(shortPwResult.status, 400, 'password under 8 chars should be rejected');

  const okResult = await registerUser(db, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'valid registration should succeed');
  assert.strictEqual(okResult.body.ok, true);
  assert.strictEqual(db.users.length, 1, 'user should be inserted into db');
  assert.notStrictEqual(db.users[0].password_hash, 'longenough', 'password must be hashed, not stored in plain text');

  const dupResult = await registerUser(db, { name: 'Ana', email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(dupResult.status, 409, 'duplicate email should be rejected');

  console.log('OK: register handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Run it and confirm it fails (red)**

Run: `node scripts/test-register-handler.js`
Expected: `Error: Cannot find module '../api/register'`, non-zero exit.

- [ ] **Step 6: Implement `api/register.js`**

```js
const { getPool } = require('./_db');
const { hashPassword } = require('./_password');

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function registerUser(db, { name, email, password } = {}) {
  if (!name || !isValidEmail(email) || !password || password.length < 8) {
    return { status: 400, body: { error: 'Datos inválidos.' } };
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return { status: 409, body: { error: 'Ya existe una cuenta con ese email.' } };
  }

  const passwordHash = hashPassword(password);
  await db.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [name, email, passwordHash]);

  return { status: 200, body: { ok: true, name } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await registerUser(getPool(), req.body);
  res.status(result.status).json(result.body);
};

module.exports.registerUser = registerUser;
module.exports.isValidEmail = isValidEmail;
```

- [ ] **Step 7: Run it and confirm it passes (green)**

Run: `node scripts/test-register-handler.js`
Expected: `OK: register handler tests passed`, exit code 0.

- [ ] **Step 8: Commit**

```bash
git add api/_db.js api/register.js scripts/test-register-handler.js db/schema.sql package.json package-lock.json
git commit -m "feat: add /api/register serverless function with tested handler logic"
```

---

### Task 3: `/api/login`

**Files:**
- Create: `api/login.js`
- Create: `scripts/test-login-handler.js`

**Interfaces:**
- Consumes: `verifyPassword` from `api/_password.js` (Task 1), same fake-db pattern as Task 2.
- Produces (used by Task 4): `api/login.js` default-exports the Vercel `(req, res)` handler; also exports `loginUser(db, { email, password })` returning `{ status, body }`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-login-handler.js`:

```js
const assert = require('assert');
const { loginUser } = require('../api/login');
const { hashPassword } = require('../api/_password');

function createFakeDb(initialUsers = []) {
  const users = [...initialUsers];
  return {
    users,
    async query(sql, params) {
      if (sql.startsWith('SELECT')) {
        const rows = users.filter((u) => u.email === params[0]);
        return { rows };
      }
      throw new Error('Unsupported query in fake db: ' + sql);
    },
  };
}

(async () => {
  const db = createFakeDb([
    { id: 1, name: 'Ana', email: 'ana@example.com', password_hash: hashPassword('longenough') },
  ]);

  const missingResult = await loginUser(db, { email: 'ghost@example.com', password: 'longenough' });
  assert.strictEqual(missingResult.status, 401, 'unknown email should be rejected');

  const wrongPwResult = await loginUser(db, { email: 'ana@example.com', password: 'wrongpassword' });
  assert.strictEqual(wrongPwResult.status, 401, 'wrong password should be rejected');

  const okResult = await loginUser(db, { email: 'ana@example.com', password: 'longenough' });
  assert.strictEqual(okResult.status, 200, 'correct credentials should succeed');
  assert.strictEqual(okResult.body.name, 'Ana');

  console.log('OK: login handler tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it and confirm it fails (red)**

Run: `node scripts/test-login-handler.js`
Expected: `Error: Cannot find module '../api/login'`, non-zero exit.

- [ ] **Step 3: Implement `api/login.js`**

```js
const { getPool } = require('./_db');
const { verifyPassword } = require('./_password');

async function loginUser(db, { email, password } = {}) {
  if (!email || !password) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  const result = await db.query('SELECT name, password_hash FROM users WHERE email = $1', [email]);
  if (result.rows.length === 0) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  const user = result.rows[0];
  if (!verifyPassword(password, user.password_hash)) {
    return { status: 401, body: { error: 'Email o contraseña incorrectos.' } };
  }

  return { status: 200, body: { ok: true, name: user.name } };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const result = await loginUser(getPool(), req.body);
  res.status(result.status).json(result.body);
};

module.exports.loginUser = loginUser;
```

- [ ] **Step 4: Run it and confirm it passes (green)**

Run: `node scripts/test-login-handler.js`
Expected: `OK: login handler tests passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add api/login.js scripts/test-login-handler.js
git commit -m "feat: add /api/login serverless function with tested handler logic"
```

---

### Task 4: Wire `login.html` to the real endpoints

**Files:**
- Modify: `login.html` (add Nombre field, rewrite `handleRegister`/`handleLogin`)
- Create: `scripts/test-login-page-integration.js`

**Interfaces:**
- Consumes: `POST /api/register` and `POST /api/login` contracts from Tasks 2-3 (request body `{name,email,password}` / `{email,password}`, response `{ok,name}` or `{error}`).

- [ ] **Step 1: Add the Nombre field to the register form**

In `login.html`, inside `<div class="auth-card auth-card--hidden" id="register-card">`, before the email field:

```html
          <div class="auth-field">
            <label class="auth-label" for="reg-name">Nombre</label>
            <input class="auth-input" type="text" id="reg-name" placeholder="Tu nombre" required>
          </div>
```

- [ ] **Step 2: Replace `handleLogin` and `handleRegister`**

Replace the existing `handleLogin` function:

```js
    function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pw    = document.getElementById('login-pw').value;
      if (email && pw.length >= 6) {
        localStorage.setItem('mk2cult_user', email);
        window.location.href = 'index.html';
      } else {
        const el = document.getElementById('login-error');
        el.textContent = 'Email o contraseña incorrectos.';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 3500);
      }
      return false;
    }
```

with:

```js
    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pw    = document.getElementById('login-pw').value;
      const el    = document.getElementById('login-error');

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pw }),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('mk2cult_user', data.name);
          window.location.href = 'index.html';
          return false;
        }
        el.textContent = data.error || 'Email o contraseña incorrectos.';
      } catch (err) {
        el.textContent = 'No se pudo conectar. Inténtalo de nuevo.';
      }
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 3500);
      return false;
    }
```

Replace the existing `handleRegister` function:

```js
    function handleRegister(e) {
      e.preventDefault();
      const email   = document.getElementById('reg-email').value;
      const pw      = document.getElementById('reg-pw').value;
      const confirm = document.getElementById('reg-confirm').value;
      const el      = document.getElementById('register-error');
      if (pw !== confirm) {
        el.textContent = 'Las contraseñas no coinciden.';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 3500);
        return false;
      }
      if (pw.length < 8) {
        el.textContent = 'La contraseña debe tener mínimo 8 caracteres.';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 3500);
        return false;
      }
      localStorage.setItem('mk2cult_user', email);
      window.location.href = 'index.html';
      return false;
    }
```

with:

```js
    async function handleRegister(e) {
      e.preventDefault();
      const name    = document.getElementById('reg-name').value;
      const email   = document.getElementById('reg-email').value;
      const pw      = document.getElementById('reg-pw').value;
      const confirm = document.getElementById('reg-confirm').value;
      const el      = document.getElementById('register-error');

      if (pw !== confirm) {
        el.textContent = 'Las contraseñas no coinciden.';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 3500);
        return false;
      }
      if (pw.length < 8) {
        el.textContent = 'La contraseña debe tener mínimo 8 caracteres.';
        el.classList.add('visible');
        setTimeout(() => el.classList.remove('visible'), 3500);
        return false;
      }

      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password: pw }),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('mk2cult_user', data.name);
          window.location.href = 'index.html';
          return false;
        }
        el.textContent = data.error || 'No se pudo crear la cuenta.';
      } catch (err) {
        el.textContent = 'No se pudo conectar. Inténtalo de nuevo.';
      }
      el.classList.add('visible');
      setTimeout(() => el.classList.remove('visible'), 3500);
      return false;
    }
```

- [ ] **Step 3: Write an integration test that serves the page over HTTP and mocks the API**

`fetch('/api/...')` needs a real HTTP origin (not `file://`) to resolve correctly, so this test spins up a tiny static file server on `127.0.0.1` and uses Playwright's `page.route` to mock the API responses — no live database needed.

Create `scripts/test-login-page-integration.js`:

```js
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
```

- [ ] **Step 4: Run it and confirm it fails (red)**

Run: `node scripts/test-login-page-integration.js`
Expected: fails on the `#reg-name` visibility assertion (field doesn't exist yet) if run before Step 1, or on the `mk2cult_user` assertion (old code stores the raw email, not `data.name`) if run before Step 2. Confirm it fails for one of these reasons before implementing.

- [ ] **Step 5: Apply Steps 1-2, then run it and confirm it passes (green)**

Run: `node scripts/test-login-page-integration.js`
Expected: `OK: login.html integration test passed`, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add login.html scripts/test-login-page-integration.js
git commit -m "feat: wire login.html register/login forms to real /api endpoints"
```

---

### Task 5: Provision Neon Postgres and deploy to Vercel

**Files:**
- Create: `.vercel/` (generated by `vercel link`, gitignored by Vercel CLI automatically)
- Modify: `.gitignore` (ensure `.vercel` and `.env.local` are excluded)
- Modify: `package.json` / `package-lock.json` (add `dotenv` dev dependency for Step 5)

**Interfaces:**
- Consumes: `db/schema.sql` (Task 2), all `/api` functions (Tasks 2-3), `login.html` (Task 4).
- Produces: a live deployment with a working `POSTGRES_URL` environment variable.

This task is infrastructure/ops, not code — steps alternate between commands run in this session and steps that need the account owner's browser/login.

- [ ] **Step 1: Log in to Vercel (user action)**

Run in this session (will print a verification URL/code — the user must complete it in their browser):
```bash
npx vercel login
```

- [ ] **Step 2: Link this project to a Vercel project**

```bash
npx vercel link
```
If prompted, choose "Link to existing project" if `m2kcult` already exists from the earlier import (the user said "lo subí a Vercel"), otherwise create a new one named `m2kcult`.

- [ ] **Step 3: Provision Neon Postgres (user action, Vercel dashboard)**

In the Vercel dashboard for this project: **Storage → Create Database → Postgres (Neon)**. This automatically adds `POSTGRES_URL` (and related) environment variables to the project for all environments (Production/Preview/Development).

- [ ] **Step 4: Pull the new environment variables locally**

```bash
npx vercel env pull .env.local
```
Expected: creates `.env.local` containing `POSTGRES_URL=...`. Add `.env.local` to `.gitignore` if not already covered (secrets must never be committed).

- [ ] **Step 5: Run the schema migration against Neon**

```bash
node -e "
require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
pool.query(fs.readFileSync('db/schema.sql', 'utf8')).then(() => {
  console.log('OK: schema applied');
  pool.end();
}).catch((err) => { console.error(err); process.exit(1); });
"
```
This requires the `dotenv` package; if not installed, run `npm install --save-dev dotenv` first.

- [ ] **Step 6: Deploy to production**

```bash
npx vercel --prod
```
Expected: prints a production URL.

- [ ] **Step 7: Smoke-test the live endpoints**

```bash
curl -s -X POST "https://<production-url>/api/register" -H "Content-Type: application/json" -d '{"name":"Test User","email":"test-smoke@example.com","password":"longenough"}'
```
Expected: `{"ok":true,"name":"Test User"}`. Then confirm a duplicate attempt returns the 409 error, and `POST /api/login` with the same credentials returns `{"ok":true,"name":"Test User"}`.

- [ ] **Step 8: Commit any config changes**

```bash
git add .gitignore package.json package-lock.json
git commit -m "chore: add dotenv for local env var loading during migrations"
```
