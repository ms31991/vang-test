import pg from 'pg';

// NUMERIC (1700) kthehet si numër, siç ishte me SQL Server
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

let pool;

export async function connectDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing env var: DATABASE_URL');
  }
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await pool.query('SELECT 1');
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database is not connected');
  }
  return pool;
}