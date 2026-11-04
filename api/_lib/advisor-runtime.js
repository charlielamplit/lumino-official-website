import { modelEnabled } from "./advisor-flags.js";
// Static import so Vercel/@vercel/node file tracing always ships the CJS catalog.
// Browser continues to load /packages/advisor/*.js; this mirror is serverless-only.
import advisorRouter from "./advisor-umd/router.cjs";

let advisor;

export function getAdvisor() {
  if (!advisor) advisor = advisorRouter;
  return advisor;
}

export function routeDeterministic(input) {
  return getAdvisor().route(input || {});
}

export function modelConfigured() {
  if (!modelEnabled()) return false;
  return Boolean(process.env.OPENAI_API_KEY || process.env.ADVISOR_OPENAI_API_KEY);
}
