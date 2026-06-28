import { Pool } from "pg";

let pool: Pool | undefined;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 6_000,
    idleTimeoutMillis: 10_000,
    max: 5,
  });

  return pool;
}
