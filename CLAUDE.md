# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

M2KCULT — a static e-commerce marketing site (Spanish-language streetwear brand) deployed on Vercel. No frontend framework and no build step: pages are hand-written HTML/CSS/vanilla JS served as-is. A small set of Vercel Serverless Functions under `api/` provide real account registration/login backed by Postgres.

## Commands

There is no configured test runner (`npm test` is a stub that always fails). Tests are plain Node scripts invoked directly:

```sh
# Unit tests (pure Node + assert, no deps beyond what's in the repo)
node scripts/test-password.js
node scripts/test-email.js
node scripts/test-login-handler.js
node scripts/test-register-handler.js
node scripts/test-redeem-code-handler.js
node scripts/test-claim-discount-handler.js
node scripts/test-account-handler.js

# Browser-driven checks (require `npx playwright install` once, then Playwright launches Chromium)
node scripts/test-login-page-integration.js   # spins up a local static server + mocks /api routes, covers login -> /cuenta -> logout
node scripts/verify-mobile-nav-all-pages.js   # opens every HTML page at 390x844 and checks the mobile nav
node scripts/verify-no-horizontal-overflow.js
node scripts/verify-small-phone.js
```

Admin-only scripts (run locally against the real Neon DB via `.env.local`, never exposed over HTTP):

```sh
node scripts/create-code.js --amount=26.34 --date=2026-07-20 --note="Gorra Blessed Enough" [--points=1634]
node scripts/list-pending-claims.js
node scripts/fulfill-claim.js --code=DESC-XXXXXX
```

Run the relevant script(s) after touching `api/*.js` (unit tests) or shared header/nav markup or CSS (Playwright verify scripts across all pages). There's no lint/format tooling configured.

No local dev server is defined — pages are opened as static files or served via `vercel dev`. Playwright integration tests spin up their own throwaway `http` static server (see `test-login-page-integration.js`).

## Architecture

**Multi-page static site, no templating.** Every top-level page (`index.html`, `colecciones.html`, `contacto.html`, `login.html`, `cuenta.html`, `product*.html`) is a standalone HTML file that duplicates the same header/announcement-bar/mobile-nav/footer markup block. When changing shared chrome (nav, footer), grep across all page files and update each copy — there is no shared partial/include mechanism.

**`js/nav.js`** is a shared, non-module script loaded via `<script src="js/nav.js">` on every page, relying on global DOM ids: it only drives the mobile hamburger nav (open/close overlay). `.account-trigger` links are plain anchors to `/cuenta` — there is no client-side interception; `cuenta.html` itself decides whether to show the account or bounce to `/login`. `js/main.js` is the homepage-only newsletter popup (shown after a 5s timeout).

**Styling** is one global `css/style.css` (organized in `/* ── Section ── */` banner-delimited blocks: Header/Navbar, Mobile Nav, Hero, Products, Footer, Product Page, then Responsive breakpoints at the bottom), plus page-scoped stylesheets loaded only where needed: `css/auth.css` (login/register) and `css/account.css` (`cuenta.html`).

**Auth flow (`login.html`):** a single page hosts both the login and register `<form>`s as sibling `.auth-card` blocks toggled via class + `history.pushState` (so `/login` and `/register` are really the same document). Form submit handlers (`handleLogin`, `handleRegister`) `fetch()` `/api/login` / `/api/register`; on success the server sets an `m2k_session` httpOnly cookie and the client just stashes a non-sensitive `mk2cult_logged_in` flag in `localStorage` (a fast UI hint only — real auth state lives server-side in the cookie, never trust `localStorage` for anything sensitive). See `docs/superpowers/specs/2026-07-15-account-backend-design.md` for the original (pre-session) design rationale — sessions were added later, that doc predates them.

**Backend (`api/`)** — Vercel Serverless Functions, each a `module.exports = async function handler(req, res)` plus a separately exported pure function for testability (injected `db`, so `scripts/test-*-handler.js` can pass fake in-memory implementations instead of hitting Postgres):
- `api/_db.js` — lazily-created singleton `pg.Pool` using `POSTGRES_URL` (Vercel/Neon integration injects this env var; SSL with `rejectUnauthorized: false`).
- `api/_password.js` — `crypto.scryptSync`-based password hashing (`salt:hash` hex format), no external hashing dep on purpose (avoids native-compile deps in serverless).
- `api/_session.js` — session cookie helpers: `generateSessionToken`/`hashToken` (random 256-bit token, only the SHA-256 hash is stored in `users.session_token_hash`), `sessionCookieHeader`/`clearCookieHeader`, `getUserFromRequest(db, req)` (parses the `m2k_session` cookie and looks up the user).
- `api/_email.js` — builds a welcome-email HTML template and sends it via the Brevo REST API (`BREVO_API_KEY`, `BREVO_SENDER_EMAIL` env vars). Welcome email failure is caught and logged, never fails the registration request.
- `api/register.js` / `api/login.js` — on success, issue a session (`Set-Cookie`) in addition to the existing `{ok, name}` body.
- `api/logout.js` — clears the session server-side and the cookie.
- `api/account.js` — `GET`, requires a session. Returns `{name, email, points, orders, claims}`. Points are **never stored** as a mutable balance — always computed as `SUM(redemption_codes.points) - SUM(discount_claims.points_spent)` for that user (a ledger, so it can't drift out of sync).
- `api/redeem-code.js` — `POST {code}`, requires a session. Atomically claims a `redemption_codes` row (`UPDATE ... WHERE code=$1 AND used_by_user_id IS NULL`), so double-redemption is race-safe without an explicit transaction.
- `api/claim-discount.js` — `POST`, requires a session. Recomputes the points balance server-side (never trusts the client), and if `>= 10000` inserts a `discount_claims` row with a freshly generated `DESC-XXXXXX` code (retries on the rare `claim_code` collision).
- DB schema lives in `db/schema.sql`, kept idempotent (`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`) since there's no migration runner — it's re-applied by hand against Neon via the `node -e` one-liner documented in `docs/superpowers/plans/2026-07-15-account-backend.md`.

## Points / loyalty system

Real purchases happen on Vinted, not on this site, so there's no automated checkout — it's a semi-manual ledger. When someone buys on Vinted, the store owner runs `scripts/create-code.js` locally to mint a single-use code (e.g. `VG24HJ8`) tied to points/amount/date/note, and sends it to the buyer by chat. The buyer redeems it under "Añadir código" on `/cuenta`, which links that `redemption_codes` row to their account — that row **is** the order shown in their "Pedidos" list. At 10,000+ points, a "Canjear 10$ de descuento" button on `/cuenta` calls `/api/claim-discount`, which deducts points and produces a `DESC-XXXXXX` claim code; the owner applies that discount manually on the buyer's next Vinted purchase and marks it fulfilled with `scripts/fulfill-claim.js` (`scripts/list-pending-claims.js` lists what's outstanding). The default 62-points-per-currency-unit conversion in `create-code.js` is just a starting suggestion — `--points` always overrides it, nothing enforces the ratio.

**Deployment:** `vercel.json` sets `cleanUrls: true` (so `.html` extensions are stripped — internal links use extensionless paths like `/contacto`, `/cuenta`) and `trailingSlash: false`.

**Media:** product/campaign images and the login background video are served from Cloudinary (hardcoded `res.cloudinary.com/dydqye3n1/...` URLs in HTML/`_email.js`), not from `assets/` — local files under `assets/` are largely legacy/unused source originals. Avoid re-introducing local asset paths for anything user-facing.

**`docs/superpowers/`** contains dated design-spec and implementation-plan markdown for past features (account backend, mobile responsive, product page) — useful background on *why* something was built a certain way, but not necessarily in sync with the current code.
