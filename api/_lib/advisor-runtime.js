import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let advisor;

export function getAdvisor() {
  if (advisor) return advisor;
  // Load UMD packages through Node require so API and browser share one catalog.
  require(path.join(root, "packages/advisor/catalog.js"));
  require(path.join(root, "packages/advisor/schema.js"));
  advisor = require(path.join(root, "packages/advisor/router.js"));
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
