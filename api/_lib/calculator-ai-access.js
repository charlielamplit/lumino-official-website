import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 24 * 60 * 60 * 1000;

function secret() {
  return process.env.CALCULATOR_AI_ACCESS_SECRET || process.env.LEADS_STAFF_KEY || "";
}

export function calculatorAiAccessConfigured() {
  return Boolean(secret());
}

function signature(payload) {
  const key = secret();
  if (!key) throw new Error("AI 推算访问密钥未配置");
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function issueCalculatorAiAccess(leadId, cnCode) {
  if (!leadId || !/^\d{8}$/.test(String(cnCode))) throw new Error("AI 推算授权信息无效");
  const payload = Buffer.from(JSON.stringify({ leadId, cnCode, expiresAt: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyCalculatorAiAccess(token, cnCode) {
  if (typeof token !== "string" || token.length > 1024) return false;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra) return false;
  try {
    const expected = Buffer.from(signature(payload));
    const received = Buffer.from(mac);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false;
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return grant.cnCode === String(cnCode) && /^LM-/.test(String(grant.leadId || ""))
      && Number.isFinite(grant.expiresAt) && grant.expiresAt > Date.now();
  } catch {
    return false;
  }
}
