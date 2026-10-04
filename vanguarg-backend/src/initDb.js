import { getPool } from "./db.js";

export async function initDb() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255),
      email VARCHAR(255),
      role VARCHAR(50) NOT NULL DEFAULT 'client',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Database tables initialized");
}