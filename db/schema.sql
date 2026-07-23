CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

CREATE TABLE IF NOT EXISTS redemption_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  points INTEGER NOT NULL,
  amount_paid NUMERIC(10, 2),
  purchase_date DATE,
  note TEXT,
  used_by_user_id INTEGER REFERENCES users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discount_claims (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  claim_code TEXT NOT NULL UNIQUE,
  points_spent INTEGER NOT NULL DEFAULT 10000,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at TIMESTAMPTZ
);
