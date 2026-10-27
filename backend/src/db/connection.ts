import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 20,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
});

// Pre-warm the pool to eliminate cold-start TLS handshake latency and ensure schema migrations
export async function runAutoMigrations(): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE addresses 
      ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Home',
      ADD COLUMN IF NOT EXISTS recipient_name TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT;
    `);
  } catch (err: any) {
    console.warn("[DB Auto-Migration] addresses column migration notice:", err.message);
  }
}

pool.query("SELECT 1")
  .then(() => runAutoMigrations())
  .catch(() => {});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client:", err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (config.NODE_ENV === "development" && duration > 200) {
    console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
  }
  return res;
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}
