import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { modelEnabled } from "./advisor-flags.js";

// Resolve from process.cwd() (/var/task on Vercel). Relative require(import.meta.url)
// breaks once @vercel/node bundles this file into api/advisor.js.
const require = createRequire(path.join(process.cwd(), "package.json"));

const UMD_CANDIDATES = [
  "api/_lib/advisor-umd",
  "_lib/advisor-umd",
  "advisor-umd",
];

let advisor;

function resolveUmdDir() {
  for (const rel of UMD_CANDIDATES) {
    const dir = path.join(process.cwd(), rel);
    if (fs.existsSync(path.join(dir, "catalog.js"))
      && fs.existsSync(path.join(dir, "schema.js"))
      && fs.existsSync(path.join(dir, "router.js"))) {
      return dir;
    }
  }
  throw new Error(`advisor_umd_missing:cwd=${process.cwd()}`);
}

export function getAdvisor() {
  if (advisor) return advisor;
  const dir = resolveUmdDir();
  require(path.join(dir, "catalog.js"));
  require(path.join(dir, "schema.js"));
  advisor = require(path.join(dir, "router.js"));
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  if (!modelEnabled()) return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
