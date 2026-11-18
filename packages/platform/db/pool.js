"use strict";

const { Pool } = require("pg");

let sharedPool = null;

function requireDatabaseUrl() {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) {
    const error = new Error("DATABASE_URL is required for PostgreSQL mode");
    error.code = "DB_UNAVAILABLE";
    throw error;
  }
  return url;
}

function getPool(options = {}) {
  if (options.pool) return options.pool;
  if (sharedPool) return sharedPool;
  sharedPool = new Pool({
    connectionString: requireDatabaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS || 5_000),
  });
  sharedPool.on("error", (error) => {
    console.error("[lumino-db] pool error", error && error.code ? error.code : "unknown");
  });
  return sharedPool;
}

async function withClient(fn, options = {}) {
  const pool = getPool(options);
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function withTransaction(fn, options = {}) {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {
        /* ignore rollback errors */
      }
      throw error;
    }
  }, options);
}

async function closePool() {
  if (!sharedPool) return;
  const pool = sharedPool;
  sharedPool = null;
  await pool.end();
}

module.exports = {
  getPool,
  withClient,
  withTransaction,
  closePool,
  requireDatabaseUrl,
};
