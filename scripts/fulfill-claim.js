require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const code = args.code ? args.code.trim().toUpperCase() : null;
  if (!code) {
    console.error('Uso: node scripts/fulfill-claim.js --code=DESC-XXXXXX');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const result = await pool.query(
    "UPDATE discount_claims SET status = 'fulfilled', fulfilled_at = now() WHERE claim_code = $1 AND status = 'pending' RETURNING user_id, discount_amount",
    [code]
  );

  if (result.rows.length === 0) {
    console.error(`No se encontró un descuento pendiente con el código ${code}.`);
    await pool.end();
    process.exit(1);
  }

  console.log(`OK: descuento ${code} marcado como aplicado.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
