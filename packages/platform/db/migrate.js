"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { getPool } = require("./pool");

function migrationsDir() {
  return path.resolve(__dirname, "../../../db/migrations");
}

function listMigrationFiles() {
  const dir = migrationsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d+_.*\.sql$/i.test(name))
    .sort()
    .map((name) => {
      const fullPath = path.join(dir, name);
      const sql = fs.readFileSync(fullPath, "utf8");
      return {
        id: name.replace(/\.sql$/i, ""),
        fileName: name,
        fullPath,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    });
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now(),
      checksum text
    )
  `);
}

async function appliedMigrations(client) {
  const { rows } = await client.query("SELECT id, checksum FROM schema_migrations ORDER BY id");
  return rows;
}

// Stable advisory-lock key so concurrent migrate()/test before() hooks serialize safely.
const MIGRATION_LOCK_KEY = 872_145_903;

async function migrate(options = {}) {
  const pool = getPool(options);
  const client = await pool.connect();
  const dryRun = Boolean(options.dryRun);
  let locked = false;
  try {
    // Lock before CREATE TABLE to avoid pg_type duplicate-key races on empty DBs.
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    locked = true;

    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const appliedMap = new Map(applied.map((row) => [row.id, row.checksum]));
    const files = listMigrationFiles();
    const plan = [];

    for (const file of files) {
      if (!appliedMap.has(file.id)) {
        plan.push({ action: "apply", ...file });
        continue;
      }
      const previous = appliedMap.get(file.id);
      if (previous && previous !== file.checksum) {
        const error = new Error(`Migration checksum mismatch for ${file.id}`);
        error.code = "MIGRATION_CHECKSUM_MISMATCH";
        throw error;
      }
      plan.push({ action: "skip", ...file });
    }

    if (dryRun) {
      return {
        dryRun: true,
        plan: plan.map((item) => ({ id: item.id, action: item.action, checksum: item.checksum })),
      };
    }

    for (const item of plan) {
      if (item.action !== "apply") continue;
      await client.query("BEGIN");
      try {
        await client.query(item.sql);
        await client.query(
          "INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
          [item.id, item.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return {
      dryRun: false,
      plan: plan.map((item) => ({ id: item.id, action: item.action, checksum: item.checksum })),
    };
  } finally {
    if (locked) {
      try {
        await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
      } catch (_) {
        // Connection release will drop session-level locks as a fallback.
      }
    }
    client.release();
  }
}

module.exports = {
  migrate,
  listMigrationFiles,
  migrationsDir,
};
