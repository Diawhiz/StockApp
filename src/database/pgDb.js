/**
 * PostgreSQL client for Vercel serverless functions
 * Connects to Aiven PostgreSQL using the DATABASE_URL environment variable
 * Uses postgres (postgres.js) driver optimized for serverless
 * 
 * CRITICAL: DATABASE_URL must be set as a Vercel environment variable
 * Never commit DATABASE_URL to source code - it must be set in the Vercel dashboard
 * Format: postgres://user:password@host:port/database?sslmode=require
 */

import postgres from 'postgres';

// Get DATABASE_URL from environment - set this in Vercel dashboard, not in code
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('⚠️ DATABASE_URL environment variable not set!');
  console.error('   Set it in Vercel: Project → Settings → Environment Variables');
  console.error('   Format: postgres://avnadmin:YOUR_PASSWORD@pg-931e9a0-sage-logistics.b.aivencloud.com:27041/defaultdb?sslmode=require');
}

// Create a singleton client that survives hot reloads in development
const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.sql ??
  postgres(databaseUrl, {
    // Critical for serverless: max 1 connection per instance
    // Since we use Aiven direct connection (not PgBouncer), we cap at 1
    max: 1,
    // Reasonable timeouts for serverless cold starts
    idle_timeout: 20,
    connect_timeout: 10,
    // prepare: false is required when using transaction-mode poolers like PgBouncer
    // Since we're using direct connection, we keep it false for safety
    prepare: false,
    // Statement timeout to prevent runaway queries in serverless
    statement_timeout: 30000,
  });

// Hot reload support: persist the client across serverless invocations in dev
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

/**
 * Helper: Run a raw SQL query with automatic error handling
 * @param {string} sql - The SQL query (can include postgres.js formatting)
 * @param {any[]} params - Parameter values (optional)
 * @returns {Promise<any>} Query result
 */
export async function query(sql, params = []) {
  try {
    const result = await sql(sql, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error.message);
    throw new Error(`Database error: ${error.message}`);
  }
}

/**
 * Helper: Begin a transaction block
 * @param {Function} fn - Async function that uses `sql` with multiple queries
 * @returns {Promise<any>} Result of the async function
 */
export async function transaction(fn) {
  try {
    // Use postgres.js built-in transaction support
    const result = await sql.begin(`BEGIN;`).concat(await fn()).concat(await sql.end(`COMMIT;`));
    return result;
  } catch (error) {
    console.error('Database transaction error:', error.message);
    throw new Error(`Transaction failed: ${error.message}`);
  }
}

export default { sql, query, transaction };