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

export function getPublicFlags() {
  return {
    public_beta: publicBetaEnabled(),
    model_enabled: modelEnabled(),
    store: false,
    lead_capture: false,
    beta_label: {
      zh: "公开试用",
      en: "Public beta",
    },
    boundary: {
      zh: "初步判断，不替代正式合规结论；不收集联系方式或客户文件。",
      en: "Preliminary guidance only — not a formal compliance conclusion. No contact details or client files are collected.",
    },
  };
}
