import {
  normalizeApiBaseUrl,
  resolveApiMode,
  resolveStoragePolicy,
  shouldSendStoreFalse,
} from "./advisor-gateway.js";

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return defaultValue;
}

/** Public Ask Lumino entry. Default on so Preview/dev keep working; set ADVISOR_PUBLIC_BETA=0 to hide. */
export function publicBetaEnabled() {
  return envFlag("ADVISOR_PUBLIC_BETA", true);
}

/** Model kill-switch. Default on when a key exists; set ADVISOR_MODEL_ENABLED=0 to force fixed/tool/retrieval-only. */
export function modelEnabled() {
  return envFlag("ADVISOR_MODEL_ENABLED", true);
}

function currentStoragePolicy() {
  const baseUrl = normalizeApiBaseUrl(
    process.env.ADVISOR_OPENAI_BASE_URL
      || process.env.OPENAI_BASE_URL
      || "https://api.openai.com/v1",
  );
  const apiMode = resolveApiMode({
    forced: process.env.ADVISOR_OPENAI_API_MODE,
    baseUrl,
  });
  return resolveStoragePolicy({
    baseUrl,
    apiMode,
    override: process.env.ADVISOR_STORAGE_POLICY,
  });
}

export function getPublicFlags() {
  const storage_policy = currentStoragePolicy();
  return {
    public_beta: publicBetaEnabled(),
    model_enabled: modelEnabled(),
    // Lumino app does not persist chat transcripts or leads in phase 1.
    lumino_conversation_store: false,
    lead_capture: false,
    // Provider retention/training claims must follow capability, not wishful store:false.
    storage_policy,
    store_requested: shouldSendStoreFalse(storage_policy),
    beta_label: {
      zh: "公开试用",
      en: "Public beta",
    },
    boundary: {
      zh: "初步判断，不替代正式合规结论；不收集联系方式或客户文件。第三方模型网关的日志与训练策略以 Provider 合同为准，公开 Beta 前须书面确认。",
      en: "Preliminary guidance only — not a formal compliance conclusion. No contact details or client files are collected by Lumino. Third-party gateway logging/training is governed by the Provider contract and must be confirmed before public Beta.",
    },
  };
}
