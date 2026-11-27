const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

const read = (file) => fs.readFileSync(file, "utf8");

test("Portal loads intake dependencies before runtime consumers", () => {
  const html = read("apps/portal/index.html");
  const intake = html.indexOf("domain/intake-model.js");
  const store = html.indexOf("domain/evidence-store.js");
  const extractor = html.indexOf("domain/energy-invoice-extractor.js");
  const core = html.indexOf("runtime/portal-core.js");
  assert.ok(intake > 0 && intake < store && store < extractor && extractor < core);
});

test("intake modules expose browser globals and Web Crypto produces the Node digest", async () => {
  const context = vm.createContext({ crypto: webcrypto, TextEncoder, TextDecoder, Uint8Array, Date, Map, Set, console });
  for (const file of ["packages/agent/domain/intake-model.js", "packages/agent/domain/evidence-store.js", "packages/agent/domain/energy-invoice-extractor.js"]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  assert.equal(typeof context.LuminoIntakeModel.assertConfirmAllowed, "function");
  assert.equal(typeof context.LuminoEnergyInvoiceExtractor.extractEnergyInvoice, "function");
  const digest = await context.LuminoEvidenceStore.sha256(new TextEncoder().encode("same bytes"));
  const nodeDigest = require("node:crypto").createHash("sha256").update("same bytes").digest("hex");
  assert.equal(digest, nodeDigest);
});

test("upload consumes file bytes and no longer hardcodes the extracted value", () => {
  const source = read("apps/portal/runtime/portal-events.js");
  const upload = source.slice(source.indexOf('if (id === "upload-evidence")'), source.indexOf('if (id === "new-product")'));
  assert.match(upload, /await file\.arrayBuffer\(\)/);
  assert.match(upload, /intakeEvidenceStore\.put/);
  assert.match(upload, /extractEnergyInvoice/);
  assert.doesNotMatch(upload, /originalValue:\s*"18420"/);
});

test("confirm consumes candidate lineage without role elevation", () => {
  const source = read("apps/portal/runtime/portal-events.js");
  const confirm = source.slice(source.indexOf('if (action === "confirm-fact")'), source.indexOf('if (action === "resolve-finding")'));
  assert.match(confirm, /assertConfirmAllowed/);
  assert.match(confirm, /candidate\.proposedPatch\.originalValue/);
  assert.doesNotMatch(confirm, /role:\s*"customer_owner"/);
  assert.doesNotMatch(confirm, /originalValue:\s*"18420"/);
});

test("Portal distinguishes model extraction from the optional rule fixture", () => {
  const core = read("apps/portal/runtime/portal-core.js");
  const events = read("apps/portal/runtime/portal-events.js");
  const localServer = read("scripts/local-site-server.mjs");
  assert.match(core, /模型提取 · aiberm\.com/);
  assert.match(core, /本地规则演示/);
  assert.match(core, /扫描件、图片和 XLSX 暂不支持/);
  assert.match(core, /原文：/);
  assert.match(events, /fetch\("\/api\/portal-intake-extract"/);
  assert.match(localServer, /"\/api\/portal-intake-extract"/);
});

test("annual flow copy allows collection before monitoring-plan lock", () => {
  const pages = read("apps/portal/pages/customer-pages.js");
  const readme = read("README.md");
  assert.doesNotMatch(pages, /锁定后生成每季度的材料请求|监测计划锁定后开启/);
  assert.match(pages, /年度项目启动后即可收资/);
  assert.match(readme, /统一企业工作门户（含 CBAM 服务频道原型）/);
});
