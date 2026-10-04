import sql from "mssql/msnodesqlv8.js";

const connectionString =
  "Driver={ODBC Driver 17 for SQL Server};Server=DESKTOP-QEJK40H;Database=VanguardDB;Trusted_Connection=Yes;TrustServerCertificate=Yes;";

let pool;

export async function connectDb() {
  pool = await sql.connect({ connectionString });
  return pool;
}

export function getPool() {
  if (!pool) {
    throw new Error("Database is not connected");
  }
  return pool;
}
