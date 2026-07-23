require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');
const { Pool } = require('pg');

const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // no I/O, easy to read out over chat
const ALNUM = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const DEFAULT_POINTS_PER_UNIT = 62;

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function generateCode() {
  let code = '';
  for (let i = 0; i < 2; i++) code += LETTERS[crypto.randomInt(LETTERS.length)];
  for (let i = 0; i < 5; i++) code += ALNUM[crypto.randomInt(ALNUM.length)];
  return code;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const amount = args.amount ? parseFloat(args.amount) : null;
  const points = args.points ? parseInt(args.points, 10) : amount ? Math.round(amount * DEFAULT_POINTS_PER_UNIT) : null;
  const date = args.date || null;
  const note = args.note || null;

  if (!points || points <= 0) {
    console.error('Uso: node scripts/create-code.js --amount=26.34 [--points=1634] [--date=2026-07-20] [--note="Gorra Blessed Enough"]');
    console.error('Hace falta --amount (para calcular puntos por defecto a 62 pts/unidad) o --points explícito.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

  let code = null;
  for (let attempt = 0; attempt < 8 && !code; attempt++) {
    const candidate = generateCode();
    try {
      await pool.query(
        'INSERT INTO redemption_codes (code, points, amount_paid, purchase_date, note) VALUES ($1, $2, $3, $4, $5)',
        [candidate, points, amount, date, note]
      );
      code = candidate;
    } catch (err) {
      if (err.code !== '23505') throw err; // anything but a code collision is a real failure
    }
  }

  if (!code) {
    console.error('No se pudo generar un código único, inténtalo de nuevo.');
    await pool.end();
    process.exit(1);
  }

  console.log('');
  console.log('Código creado:', code);
  console.log('Puntos:', points);
  if (amount != null) console.log('Importe:', amount);
  if (date) console.log('Fecha:', date);
  if (note) console.log('Nota:', note);
  console.log('');
  console.log(`Mensaje para el comprador: "Tu código M2KCULT es ${code} — canjéalo en m2kcult.com/cuenta"`);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
