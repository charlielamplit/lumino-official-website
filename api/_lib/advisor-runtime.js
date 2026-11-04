import { createRequire } from "node:module";
import { modelEnabled } from "./advisor-flags.js";

// Literal relative requires so Vercel NFT / the function bundle always ships the UMD catalog.
// Source of truth for the browser remains packages/advisor/; api/_lib/advisor-umd is the serverless mirror.
const require = createRequire(import.meta.url);

let advisor;

export function getAdvisor() {
  if (advisor) return advisor;
  require("./advisor-umd/catalog.js");
  require("./advisor-umd/schema.js");
  advisor = require("./advisor-umd/router.js");
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  if (!modelEnabled()) return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
