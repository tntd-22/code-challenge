import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { config } from '../config/index.js';
import * as schema from './schema/index.js';

const pool = new pg.Pool({
  connectionString: config.db.url,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export const db = drizzle(pool, { schema });
export { pool };

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

export async function healthCheck(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}
