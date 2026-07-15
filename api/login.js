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
