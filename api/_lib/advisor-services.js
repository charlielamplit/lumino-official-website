export const ADVISOR_SERVICE_IDS = Object.freeze([
  "cbam",
  "pcf",
  "inventory",
  "esg",
  "assets",
  "export",
]);

const ALLOWED = new Set(ADVISOR_SERVICE_IDS);

export function sanitizeServiceId(value) {
  const id = String(value || "").trim().toLowerCase();
  return ALLOWED.has(id) ? id : null;
}

export function sanitizeServiceMatches(matches, lang = "zh") {
  const out = [];
  const seen = new Set();
  for (const item of matches || []) {
    const id = sanitizeServiceId(item?.service_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      service_id: id,
      reason: item?.reason || (lang === "en" ? "Matched service." : "匹配服务。"),
      priority: out.length + 1,
    });
    if (out.length >= 2) break;
  }
  return out;
}
