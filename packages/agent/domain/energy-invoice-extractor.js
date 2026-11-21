(function (root, factory) {
  "use strict";
  const intake = root?.LuminoIntakeModel || (typeof require === "function" ? require("./intake-model.js") : null);
  const api = factory(intake);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoEnergyInvoiceExtractor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (intake) {
  "use strict";
  const EXTRACTOR_VERSION = "extract-gas@1.1.0";

  function extractEnergyInvoice(input) {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(input.bytes || new Uint8Array());
    const match = text.match(/NATURAL_GAS_NM3\s*[,=]\s*(\d+(?:\.\d+)?)/i);
    if (!match) return { mode: "fixture", proposals: [], summary: "未从演示账单中识别天然气用量。", warnings: ["UNPARSEABLE_INVOICE"] };
    const candidateId = intake.buildCandidateId({ evidenceId: input.evidenceMeta.evidenceId, extractorVersion: input.extractorVersion || EXTRACTOR_VERSION });
    const value = match[1];
    const candidate = {
      id: candidateId,
      revision: 1,
      status: "READY_FOR_REVIEW",
      tenantId: input.evidenceMeta.tenantId,
      requestId: input.evidenceMeta.requestId,
      evidenceId: input.evidenceMeta.evidenceId,
      annualCaseId: input.evidenceMeta.annualCaseId,
      year: input.evidenceMeta.year,
      quarter: input.evidenceMeta.quarter,
      assetId: `REC-${candidateId}`,
      proposedPatch: { metricCode: "energy.natural_gas.purchased", originalValue: value, originalUnit: "Nm3", normalizedValue: value, normalizedUnit: "Nm3", dataOrigin: "invoice_fixture" },
      extractorVersion: input.extractorVersion || EXTRACTOR_VERSION,
      evidenceContentSha256: input.evidenceMeta.contentSha256,
      confidence: "fixture_exact",
      locator: `text:line-${text.slice(0, match.index).split("\n").length}`,
      createdBy: input.actor?.actor || "Energy Invoice Extractor",
    };
    return {
      mode: "fixture",
      candidate,
      proposals: [{
        proposalId: candidate.id,
        assetId: candidate.assetId,
        reviseIfExists: true,
        targetAssetType: "energyConsumption",
        tenantId: candidate.tenantId,
        ownerOrganizationId: "ORG-HX-001",
        name: `${input.facilityName || "设施"}购入天然气`,
        subjectRefs: { facilityId: input.facilityAssetId },
        temporal: input.temporal || null,
        sourceAssetIds: [candidate.evidenceId],
        proposedPatch: candidate.proposedPatch,
        quality: { completeness: "fixture", confidence: candidate.confidence, locator: candidate.locator },
        binding: { id: `BIND-${candidate.id}`, serviceId: "cbam", caseId: input.caseId, usagePurpose: "季度直接排放", scopeId: input.facilityAssetId },
      }],
      summary: `演示提取识别天然气用量 ${value} Nm3，等待企业确认。`,
      warnings: ["DEMO_FIXTURE_EXTRACTION"],
    };
  }

  return { EXTRACTOR_VERSION, extractEnergyInvoice };
});
