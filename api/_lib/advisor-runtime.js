import { modelEnabled } from "./advisor-flags.js";
// Pure ESM mirrors — statically imported so Vercel esbuild inlines the fixed catalog.
import advisorRouter from "./advisor-data/router.js";

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
