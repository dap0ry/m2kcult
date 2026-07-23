require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const result = await pool.query(
    `SELECT dc.claim_code, dc.discount_amount, dc.created_at, u.name, u.email
     FROM discount_claims dc
     JOIN users u ON u.id = dc.user_id
     WHERE dc.status = 'pending'
     ORDER BY dc.created_at ASC`
  );

  if (result.rows.length === 0) {
    console.log('No hay descuentos pendientes de aplicar.');
  } else {
    console.log(`${result.rows.length} descuento(s) pendiente(s):`);
    for (const row of result.rows) {
      console.log(`- ${row.claim_code} · ${row.name} <${row.email}> · ${row.discount_amount}$ · pedido el ${row.created_at.toISOString().slice(0, 10)}`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
