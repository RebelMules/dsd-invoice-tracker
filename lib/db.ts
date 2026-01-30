import { Pool } from 'pg';

// Create a singleton pool for database connections
const globalForPg = globalThis as unknown as { pool: Pool | undefined };

export const pool = globalForPg.pool ?? new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== 'production') {
  globalForPg.pool = pool;
}

// Helper for parameterized queries
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// Helper for single row queries
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}
