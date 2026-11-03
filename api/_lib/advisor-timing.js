/** Aligned client/server budgets to avoid orphan model spend after client fallback. */
export const ADVISOR_CLIENT_TIMEOUT_MS = Number(process.env.ADVISOR_CLIENT_TIMEOUT_MS || 12000);
export const ADVISOR_MODEL_TIMEOUT_MS = Number(process.env.ADVISOR_MODEL_TIMEOUT_MS || 10000);
export const ADVISOR_SSE_CHUNK_CHARS = 16;

export function modelTimeoutMs() {
  // Model must finish before the client gives up.
  return Math.max(1000, Math.min(ADVISOR_MODEL_TIMEOUT_MS, ADVISOR_CLIENT_TIMEOUT_MS - 1500));
}

export function clientTimeoutMs() {
  return Math.max(modelTimeoutMs() + 1500, ADVISOR_CLIENT_TIMEOUT_MS);
}
