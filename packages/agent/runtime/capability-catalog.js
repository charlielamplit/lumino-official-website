(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAgentCapabilities = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATALOG_VERSION = "0.1.0";

  /**
   * Bravo-inspired businessType catalog, mapped onto Lumino stage-gates.
   * completionMode is always proposal_only: runtime must not confirm facts.
   */
  const capabilities = Object.freeze({
    CBAM_ENERGY_INVOICE_EXTRACT: Object.freeze({
      businessType: "CBAM_ENERGY_INVOICE_EXTRACT",
      title: "CBAM ??????",
      serviceId: "cbam",
      stageIds: Object.freeze(["data-prep"]),
      promptId: "cbam.extract_energy_invoice",
      ruleOrPromptVersion: "extract-gas@1.0.0",
      targetAssetType: "energyConsumption",
      evidenceAssetType: "evidence",
      completionMode: "proposal_only",
      retryableFailures: Object.freeze(["SUBMIT_UNKNOWN", "SYNC_FAILED"])
    }),
    PCF_DATA_PACK_VALIDATE: Object.freeze({
      businessType: "PCF_DATA_PACK_VALIDATE",
      title: "PCF ??????",
      serviceId: "pcf",
      stageIds: Object.freeze(["template", "inventory"]),
      promptId: "pcf.validate_data_pack",
      ruleOrPromptVersion: "pcf-template@0.4.0",
      targetAssetType: "energyConsumption",
      evidenceAssetType: "evidence",
      completionMode: "proposal_only",
      retryableFailures: Object.freeze(["SUBMIT_UNKNOWN", "SYNC_FAILED"])
    }),
    PCF_BOUNDARY_SUGGEST: Object.freeze({
      businessType: "PCF_BOUNDARY_SUGGEST",
      title: "PCF ??????",
      serviceId: "pcf",
      stageIds: Object.freeze(["boundary"]),
      promptId: "pcf.suggest_boundary",
      ruleOrPromptVersion: "pcf-boundary@0.2.0",
      targetAssetType: "referenceData",
      evidenceAssetType: null,
      completionMode: "proposal_only",
      retryableFailures: Object.freeze(["SUBMIT_UNKNOWN"])
    })
  });

  function listCapabilities() {
    return Object.values(capabilities).map((item) => ({ ...item }));
  }

  function getCapability(businessType) {
    const item = capabilities[businessType];
    if (!item) {
      const error = new Error(`?? Agent ?? ${businessType}`);
      error.code = "UNKNOWN_BUSINESS_TYPE";
      error.retryable = false;
      throw error;
    }
    return { ...item };
  }

  function capabilitiesForStage(serviceId, stageId) {
    return listCapabilities().filter((item) => item.serviceId === serviceId && item.stageIds.includes(stageId));
  }

  return { CATALOG_VERSION, capabilities, listCapabilities, getCapability, capabilitiesForStage };
});
