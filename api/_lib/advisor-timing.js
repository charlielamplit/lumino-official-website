/** Aligned client/server budgets to avoid orphan model spend after client fallback. */
export const ADVISOR_CLIENT_TIMEOUT_MS = Number(process.env.ADVISOR_CLIENT_TIMEOUT_MS || 15000);
export const ADVISOR_MODEL_TIMEOUT_MS = Number(process.env.ADVISOR_MODEL_TIMEOUT_MS || 12000);
/** Optional tighter Luna budget; Sol uses the full model budget then may fall back to Luna. */
export const ADVISOR_LUNA_TIMEOUT_MS = Number(process.env.ADVISOR_LUNA_TIMEOUT_MS || ADVISOR_MODEL_TIMEOUT_MS);
export const ADVISOR_SOL_TIMEOUT_MS = Number(process.env.ADVISOR_SOL_TIMEOUT_MS || ADVISOR_MODEL_TIMEOUT_MS);
export const ADVISOR_SSE_CHUNK_CHARS = 16;

function clampToClientBudget(ms) {
  return Math.max(1000, Math.min(Number(ms) || ADVISOR_MODEL_TIMEOUT_MS, ADVISOR_CLIENT_TIMEOUT_MS - 1500));
}

export function modelTimeoutMs(tier = "luna") {
  if (String(tier).toLowerCase() === "sol") return clampToClientBudget(ADVISOR_SOL_TIMEOUT_MS);
  return clampToClientBudget(ADVISOR_LUNA_TIMEOUT_MS);
}

export function clientTimeoutMs() {
  return Math.max(modelTimeoutMs("sol") + 1500, ADVISOR_CLIENT_TIMEOUT_MS);
}
