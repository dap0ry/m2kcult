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
