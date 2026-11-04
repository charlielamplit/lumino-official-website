import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { modelEnabled } from "./advisor-flags.js";

// Use a real nearby file as the require root. package.json may be absent in this repo;
// Vercel ESM ("type":"module") also cannot require bare .js UMD — mirrors are .cjs.
const require = createRequire(fileURLToPath(import.meta.url));

const UMD_CANDIDATES = [
  path.join(path.dirname(fileURLToPath(import.meta.url)), "advisor-umd"),
  path.join(process.cwd(), "api/_lib/advisor-umd"),
  path.join(process.cwd(), "_lib/advisor-umd"),
];

let advisor;

function resolveUmdDir() {
  for (const dir of UMD_CANDIDATES) {
    if (fs.existsSync(path.join(dir, "catalog.cjs"))
      && fs.existsSync(path.join(dir, "schema.cjs"))
      && fs.existsSync(path.join(dir, "router.cjs"))) {
      return dir;
    }
  }
  throw new Error(`advisor_umd_missing:cwd=${process.cwd()}`);
}

export function getAdvisor() {
  if (advisor) return advisor;
  const dir = resolveUmdDir();
  require(path.join(dir, "catalog.cjs"));
  require(path.join(dir, "schema.cjs"));
  advisor = require(path.join(dir, "router.cjs"));
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  if (!modelEnabled()) return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
