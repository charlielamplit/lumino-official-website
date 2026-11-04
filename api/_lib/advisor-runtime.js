import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { modelEnabled } from "./advisor-flags.js";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ADVISOR_FILES = [
  "packages/advisor/catalog.js",
  "packages/advisor/schema.js",
  "packages/advisor/router.js",
];

let advisor;

export function getAdvisor() {
  if (advisor) return advisor;
  // Load UMD packages through Node require so API and browser share one catalog.
  // On Vercel these paths must also be listed in vercel.json functions.includeFiles.
  for (const rel of ADVISOR_FILES) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      throw new Error(`advisor_package_missing:${rel}`);
    }
  }
  require(path.join(root, ADVISOR_FILES[0]));
  require(path.join(root, ADVISOR_FILES[1]));
  advisor = require(path.join(root, ADVISOR_FILES[2]));
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  if (!modelEnabled()) return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
