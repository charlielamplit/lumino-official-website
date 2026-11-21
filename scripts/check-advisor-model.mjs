#!/usr/bin/env node

const base = String(process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Usage: node scripts/check-advisor-model.mjs <base-url>");
  process.exit(2);
}

const expectedSources = new Set(["general_model"]);
const maxAttempts = 4;
let lastFailure = "no response";

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const response = await fetch(`${base}/api/advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        text: "如何组织跨部门合规项目启动会？",
        lang: "zh",
        asOf: new Date().toISOString().slice(0, 10),
        surface: "public",
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
  if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 2000));
}

console.error(`Advisor model smoke failed after ${maxAttempts} attempts: ${lastFailure}`);
process.exit(1);
