(function (root, factory) {
  "use strict";
  const intake = root?.LuminoIntakeModel || (typeof require === "function" ? require("./intake-model.js") : null);
  const api = factory(intake);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoEnergyInvoiceExtractor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (intake) {
  "use strict";
  const EXTRACTOR_VERSION = "extract-gas@1.1.0";
  const MODEL_EXTRACTOR_VERSION = "model-gateway@1.0.0";

  function extractEnergyInvoice(input) {
    const modelExtraction = input.modelExtraction || null;
    const text = modelExtraction ? "" : new TextDecoder("utf-8", { fatal: false }).decode(input.bytes || new Uint8Array());
    const match = modelExtraction ? null : text.match(/NATURAL_GAS_NM3\s*[,=]\s*(\d+(?:\.\d+)?)/i);
    if (!modelExtraction && !match) return { mode: "fixture", proposals: [], summary: "未从演示账单中识别天然气用量。", warnings: ["UNPARSEABLE_INVOICE"] };
    if (modelExtraction && (!/^\d+(?:\.\d+)?$/.test(String(modelExtraction.quantity)) || modelExtraction.unit !== "Nm3" || modelExtraction.facilityName !== input.facilityName)) throw new Error("模型提取结果与当前设施或用量格式不一致。");
    const extractorVersion = input.extractorVersion || (modelExtraction ? MODEL_EXTRACTOR_VERSION : EXTRACTOR_VERSION);
    const candidateId = intake.buildCandidateId({ evidenceId: input.evidenceMeta.evidenceId, extractorVersion });
    const value = modelExtraction ? String(modelExtraction.quantity) : match[1];
    const candidate = {
      id: candidateId,
      revision: 1,
      status: "READY_FOR_REVIEW",
      tenantId: input.evidenceMeta.tenantId,
      requestId: input.evidenceMeta.requestId,
      evidenceId: input.evidenceMeta.evidenceId,
      annualCaseId: input.evidenceMeta.annualCaseId,
      facilityAssetId: input.facilityAssetId,
      year: input.evidenceMeta.year,
      quarter: input.evidenceMeta.quarter,
      assetId: `REC-${candidateId}`,
      proposedPatch: { metricCode: "energy.natural_gas.purchased", originalValue: value, originalUnit: "Nm3", normalizedValue: value, normalizedUnit: "Nm3", dataOrigin: modelExtraction ? "model_gateway" : "invoice_fixture" },
      extractorVersion,
      extractionMode: modelExtraction ? "model_gateway" : "fixture",
      model: modelExtraction ? input.modelName || null : null,
      sourceQuote: modelExtraction?.quantityQuote || null,
      invoicePeriodStart: modelExtraction?.periodStart || null,
      invoicePeriodEnd: modelExtraction?.periodEnd || null,
      evidenceContentSha256: input.evidenceMeta.contentSha256,
      confidence: modelExtraction ? "model_source_validated" : "fixture_exact",
      locator: modelExtraction ? modelExtraction.quantityQuote : `text:line-${text.slice(0, match.index).split("\n").length}`,
      createdBy: input.actor?.actor || "Energy Invoice Extractor",
    };
    return {
      mode: modelExtraction ? "model_gateway" : "fixture",
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
      summary: `${modelExtraction ? "模型提取" : "演示规则提取"}识别天然气用量 ${value} Nm3，等待企业确认。`,
      warnings: modelExtraction ? [] : ["DEMO_FIXTURE_EXTRACTION"],
    };
  }

  return { EXTRACTOR_VERSION, MODEL_EXTRACTOR_VERSION, extractEnergyInvoice };
});
