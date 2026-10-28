(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPcfReportLock = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LOCK_VERSION = "0.1.0";

  function entry(kind, id, versionLabel, status, note) {
    return {
      kind: kind,
      id: id || null,
      versionLabel: versionLabel || null,
      status: status || null,
      note: note || null
    };
  }

  function buildLockInventory(input) {
    input = input || {};
    const declaration = input.declaration || {};
    const boundary = input.boundary || {};
    const template = input.template || {};
    const factors = input.factors || {};
    const calculation = input.calculation || {};
    const snapshot = input.snapshot || {};
    const run = input.run || {};
    const bindings = Array.isArray(input.bindings) ? input.bindings : [];
    const reportId = input.reportId || "PCF-RPT-2026-001-R1";
    const items = [
      entry("declaration", declaration.productId || "declaration", declaration.schemaVersion || "0.1.0", declaration.confirmed ? "CONFIRMED" : "DRAFT", declaration.functionalUnit || ""),
      entry("boundary", boundary.boundaryType || "boundary", boundary.schemaVersion || "0.1.0", boundary.status || (boundary.confirmed ? "CONFIRMED" : "PROPOSED"), (boundary.includedProcesses || []).slice(0, 3).join("、")),
      entry("template", template.packVersion || template.filename || "template", template.schemaVersion || "0.1.0", template.status || "NOT_UPLOADED", template.filename || ""),
      entry("factorSet", factors.setId || "CN-EF-2026.1", factors.schemaVersion || factors.setId || "0.1.0", factors.confirmed ? "CONFIRMED" : "PROPOSED", factors.setName || ""),
      entry("snapshot", snapshot.id || calculation.snapshotId || "SNAP-PCF-HRC-01", (snapshot.inputAssetVersionIds || []).join(", ") || "asset versions", snapshot.status || "CURRENT", snapshot.locked ? "已锁定" : "运行时锁定"),
      entry("calculationRun", run.id || calculation.runId || "ARUN-PCF-001", calculation.ruleVersion || factors.setId || "CN-EF-2026.1", run.status || calculation.status || "SUCCEEDED", String(calculation.total || "") + " " + (calculation.unit || ""))
    ];
    bindings.forEach(function (binding) {
      items.push(entry(
        "binding",
        binding.id,
        binding.assetVersionId || binding.assetId || "",
        binding.status || "",
        binding.usagePurpose || binding.serviceId || ""
      ));
    });
    return {
      schemaVersion: LOCK_VERSION,
      reportId: reportId,
      reportRevision: input.reportRevision || "Rev 1",
      status: "LOCKED",
      lockedAt: new Date().toISOString(),
      lockedBy: (input.actor && (input.actor.actor || input.actor.name)) || null,
      snapshotId: snapshot.id || calculation.snapshotId || null,
      runId: run.id || calculation.runId || null,
      total: calculation.total || null,
      unit: calculation.unit || "tCO2e/t",
      items: items,
      statement: "本报告锁定上表所列输入版本；后续更正将生成新修订版，不覆盖本版。"
    };
  }

  function normalize(lock) {
    lock = lock || {};
    return {
      schemaVersion: LOCK_VERSION,
      reportId: lock.reportId || null,
      reportRevision: lock.reportRevision || "Rev 1",
      status: lock.status || "DRAFT",
      lockedAt: lock.lockedAt || null,
      lockedBy: lock.lockedBy || null,
      snapshotId: lock.snapshotId || null,
      runId: lock.runId || null,
      total: lock.total || null,
      unit: lock.unit || "tCO2e/t",
      items: Array.isArray(lock.items) ? lock.items.slice() : [],
      statement: lock.statement || ""
    };
  }

  return { LOCK_VERSION: LOCK_VERSION, buildLockInventory: buildLockInventory, normalize: normalize };
});
