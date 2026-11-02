#!/usr/bin/env node
/**
 * Advisor regression eval (F08-05)
 * Deterministic + published retrieval grounded path (no live model required).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const AS_OF_DEFAULT = "2026-11-02";

const advisor = require(path.join(ROOT, "packages/advisor/router.js"));
const schema = require(path.join(ROOT, "packages/advisor/schema.js"));

const retrievalMod = await import(pathToFileURL(path.join(ROOT, "api/_lib/advisor-retrieval.js")).href);
const policyMod = await import(pathToFileURL(path.join(ROOT, "api/_lib/advisor-policy.js")).href);

function loadCases(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(raw.cases) || raw.cases.length < (raw.minCases || 120)) {
    throw new Error(`eval set must contain at least ${raw.minCases || 120} cases`);
  }
  return raw;
}

function serviceIds(result) {
  return (result.service_matches || []).map((item) => item.service_id).filter(Boolean);
}

function sourceCategoryOf(result) {
  if (result.answer_mode === "tool_route") return "tool";
  if (result.answer_mode === "fixed") return "fixed";
  if (result.answer_mode === "retrieval_model") return "knowledge";
  if (!result.sources || result.sources.length === 0) return "none";
  return "knowledge";
}

function resolveCase(input, lang, asOf) {
  const sanitized = policyMod.sanitizeRequest({
    text: input.text || "",
    topicId: input.topicId || "",
    replyId: input.replyId || "",
    lang,
    asOf,
  });

  if (!sanitized.ok) {
    return {
      intent: "invalid_request",
      answer_mode: "fallback",
      answer: "invalid",
      confidence: "low",
      service_matches: [],
      next_question: null,
      suggested_replies: [],
      sources: [],
      links: [],
      cta: null,
      handoff: "contact",
      runtime_source: "invalid",
    };
  }

  if (sanitized.sensitive) {
    return {
      intent: "privacy_guard",
      answer_mode: "fallback",
      answer: lang === "en"
        ? "The input may contain contact or identity details. It was not stored. Use the controlled contact page if you want Lumino to contact you."
        : "输入中可能包含联系方式或证件号码。内容未保存。如需联系，请使用受控联系页。",
      confidence: "low",
      service_matches: [],
      next_question: null,
      suggested_replies: [],
      sources: [],
      links: [{ type: "contact", label: "Contact Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=privacy" }],
      cta: { type: "contact", label: "Contact Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=privacy" },
      handoff: "contact",
      runtime_source: "privacy_guard",
    };
  }

  const req = { ...sanitized.request, asOf };
  let result = advisor.route(req);
  let runtimeSource = "deterministic";

  if (result.answer_mode === "fallback" && req.text) {
    const hits = retrievalMod.retrievePublishedKnowledge({
      text: req.text,
      lang: req.lang,
      asOf,
      limit: 3,
    });
    if (!hits.length) {
      result = retrievalMod.stopWithoutSources(req.lang);
      runtimeSource = "no_sources";
    } else {
      result = retrievalMod.buildGroundedFallback(hits, req.lang);
      runtimeSource = "retrieval_grounded";
    }
  }

  return { ...result, runtime_source: runtimeSource };
}

function evaluateCase(item, asOf) {
  const result = resolveCase(item.input || {}, item.lang || "zh", asOf);
  const expect = item.expect || {};
  const failures = [];
  const critical = expect.severity === "critical";

  const schemaCheck = schema.validateResponse(result);
  if (!schemaCheck.ok) failures.push(`schema:${schemaCheck.errors.join(",")}`);

  if (Array.isArray(expect.answer_modes) && expect.answer_modes.length) {
    if (!expect.answer_modes.includes(result.answer_mode)) {
      failures.push(`answer_mode=${result.answer_mode} not in ${expect.answer_modes.join("|")}`);
    }
  }

  if (expect.intent != null) {
    const allowed = Array.isArray(expect.intent) ? expect.intent : [expect.intent];
    if (!allowed.includes(result.intent)) {
      failures.push(`intent=${result.intent} not in ${allowed.join("|")}`);
    }
  }

  if (expect.handoff != null && result.handoff !== expect.handoff) {
    failures.push(`handoff=${result.handoff} expected ${expect.handoff}`);
  }

  const services = serviceIds(result);
  if (Array.isArray(expect.allowed_services) && expect.allowed_services.length) {
    const unexpected = services.filter((id) => !expect.allowed_services.includes(id));
    if (unexpected.length) failures.push(`unexpected_services=${unexpected.join(",")}`);
    if (services.length > 2) failures.push("more_than_two_services");
  } else if (services.length > 2) {
    failures.push("more_than_two_services");
  }

  const category = sourceCategoryOf(result);
  if (expect.source_category && expect.source_category !== "any" && category !== expect.source_category) {
    // fixed answers may also be acceptable when retrieval was expected but deterministic won
    if (!(expect.source_category === "knowledge" && category === "fixed")) {
      failures.push(`source_category=${category} expected ${expect.source_category}`);
    }
  }

  if (expect.must_have_sources === true && !(result.sources && result.sources.length)) {
    failures.push("missing_sources");
  }
  if (expect.must_have_sources === false && result.sources && result.sources.length) {
    failures.push("unexpected_sources");
  }

  const blob = [
    result.answer || "",
    result.next_question || "",
    ...(result.links || []).map((l) => l.label || ""),
    ...(result.sources || []).map((s) => s.title || ""),
  ].join("\n");

  for (const pattern of expect.forbidden_patterns || []) {
    if (!pattern) continue;
    if (blob.toLowerCase().includes(String(pattern).toLowerCase())) {
      failures.push(`forbidden:${pattern}`);
    }
  }

  return {
    id: item.id,
    ok: failures.length === 0,
    critical,
    failures,
    result: {
      intent: result.intent,
      answer_mode: result.answer_mode,
      handoff: result.handoff,
      services,
      source_category: category,
      runtime_source: result.runtime_source,
      sources: (result.sources || []).length,
    },
    tags: item.tags || [],
  };
}

function summarize(rows) {
  const total = rows.length;
  const passed = rows.filter((r) => r.ok).length;
  const failed = rows.filter((r) => !r.ok);
  const criticalFails = failed.filter((r) => r.critical);

  const byMode = {};
  const bySource = {};
  for (const row of rows) {
    byMode[row.result.answer_mode] = (byMode[row.result.answer_mode] || 0) + 1;
    bySource[row.result.runtime_source] = (bySource[row.result.runtime_source] || 0) + 1;
  }

  const noModelResolved = rows.filter((r) => ["deterministic", "privacy_guard"].includes(r.result.runtime_source)
    || r.result.answer_mode === "fixed"
    || r.result.answer_mode === "tool_route").length;
  const toolRouted = rows.filter((r) => r.result.answer_mode === "tool_route").length;
  const stopped = rows.filter((r) => r.result.runtime_source === "no_sources" || (r.result.answer_mode === "fallback" && r.result.sources === 0)).length;
  const serviceChecked = rows.filter((r) => (r.result.services || []).length >= 0);
  const serviceAccurate = rows.filter((r) => r.ok || !(r.failures || []).some((f) => f.startsWith("unexpected_services"))).length;

  return {
    total,
    passed,
    failed: failed.length,
    pass_rate: Number((passed / total).toFixed(4)),
    critical_failures: criticalFails.length,
    metrics: {
      no_model_resolution_rate: Number((noModelResolved / total).toFixed(4)),
      tool_route_rate: Number((toolRouted / total).toFixed(4)),
      stop_without_sources_rate: Number((stopped / total).toFixed(4)),
      service_recommendation_safe_rate: Number((serviceAccurate / serviceChecked.length).toFixed(4)),
    },
    answer_mode_counts: byMode,
    runtime_source_counts: bySource,
    failures: failed.map((r) => ({ id: r.id, critical: r.critical, failures: r.failures, result: r.result })),
  };
}

function printReport(summary) {
  console.log(`Advisor eval: ${summary.passed}/${summary.total} passed (${(summary.pass_rate * 100).toFixed(1)}%)`);
  console.log(`Critical failures: ${summary.critical_failures}`);
  console.log("Metrics:", JSON.stringify(summary.metrics, null, 2));
  console.log("Answer modes:", summary.answer_mode_counts);
  console.log("Runtime sources:", summary.runtime_source_counts);
  if (summary.failures.length) {
    console.log("Failures:");
    for (const item of summary.failures.slice(0, 30)) {
      console.log(`- ${item.id}: ${item.failures.join("; ")}`);
    }
    if (summary.failures.length > 30) console.log(`... ${summary.failures.length - 30} more`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const casesPath = args.find((a) => a.endsWith(".json"))
    || path.join(ROOT, "packages/advisor/evals/cases.json");
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
  const asOf = AS_OF_DEFAULT;

  retrievalMod.clearRetrievalCache();
  const suite = loadCases(casesPath);
  const rows = suite.cases.map((item) => evaluateCase(item, suite.asOf || asOf));
  const summary = summarize(rows);
  printReport(summary);

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2));
    console.log("Wrote", outPath);
  }

  if (summary.critical_failures > 0 || summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
