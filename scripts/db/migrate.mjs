#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const platformDb = require(path.join(root, "packages/platform/db/index.js"));

const dryRun = process.argv.includes("--dry-run");

const result = await platformDb.migrate({ dryRun });
console.log(JSON.stringify(result, null, 2));
await platformDb.closePool();
