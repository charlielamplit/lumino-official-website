#!/usr/bin/env node

const base = String(process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/check-advisor-model.mjs <base-url>");
  process.exit(2);
}

const expectedSources = new Set(["general_model", "retrieval_model"]);
let lastFailure = "no response";

for (let attempt = 1; attempt <= 2; attempt += 1) {
  try {
    const response = await fetch(`${base}/api/advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        text: "请给出一个不含客户数据的 CBAM 启动资料清单，并明确需要人工确认的假设。",
        lang: "zh",
        asOf: new Date().toISOString().slice(0, 10),
        surface: "portal",
        context: { serviceId: "cbam", workstream: "current_work", pageId: "agent-smoke" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json();
    const source = payload.runtime?.source;
    if (response.ok && payload.answer && expectedSources.has(source)) {
      console.log(`Advisor model smoke passed on attempt ${attempt}: ${source}`);
      process.exit(0);
    }
    lastFailure = `HTTP ${response.status}, source=${source || "missing"}, degradation=${payload.runtime?.degradation_reason || "none"}`;
  } catch (error) {
    lastFailure = error?.message || String(error);
  }
}

console.error(`Advisor model smoke failed after 2 attempts: ${lastFailure}`);
process.exit(1);
