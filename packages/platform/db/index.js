"use strict";

const pool = require("./pool");
const migrate = require("./migrate");
const identity = require("./identity-repository");
const portal = require("./portal-repository");
const leads = require("./leads-repository");
const outboxNotify = require("./outbox-notify");
const leadsJsonImport = require("./leads-json-import");

function isPostgresMode() {
  const store = String(process.env.LEADS_STORE || "").trim().toLowerCase();
  if (store === "postgres") return true;
  if (store === "file") return false;
  return Boolean(String(process.env.DATABASE_URL || "").trim());
}

function assertPostgresMode() {
  if (!isPostgresMode()) {
    const error = new Error("PostgreSQL mode is not enabled. Set DATABASE_URL and/or LEADS_STORE=postgres.");
    error.code = "DB_MODE_DISABLED";
    error.httpStatus = 503;
    throw error;
  }
  pool.requireDatabaseUrl();
}

module.exports = {
  ...pool,
  ...migrate,
  ...identity,
  ...portal,
  ...leads,
  ...outboxNotify,
  ...leadsJsonImport,
  isPostgresMode,
  assertPostgresMode,
};
