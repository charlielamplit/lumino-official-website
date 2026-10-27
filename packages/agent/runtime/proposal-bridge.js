(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoProposalBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BRIDGE_VERSION = "0.1.1";

  function assert(condition, message, code) {
    if (condition) return;
    const error = new Error(message);
    error.code = code || "PROPOSAL_BRIDGE_ERROR";
    error.retryable = false;
    throw error;
  }

  function applyTaskResult(assetRegistry, task, options) {
    options = options || {};
    assert(assetRegistry && typeof assetRegistry.register === "function", "AssetRegistry is required", "MISSING_REGISTRY");
    assert(task && task.id, "Task is required", "MISSING_TASK");
    assert(["READY", "READY_PARTIAL"].indexOf(task.status) !== -1, "Task status cannot apply proposals: " + task.status, "TASK_NOT_READY");
    assert(task.result && Array.isArray(task.result.proposals), "Task result missing proposals", "MISSING_PROPOSALS");

    const actor = options.actor || "Asset Agent";
    const command = {
      actor: actor,
      role: "agent",
      reason: options.reason || ("Agent task " + task.id + " produced proposal-only result"),
      basis: options.basis || task.ruleOrPromptVersion || task.promptId
    };

    const applied = [];
    task.result.proposals.forEach(function (proposal) {
      assert(proposal.targetAssetType, "proposal missing targetAssetType", "INVALID_PROPOSAL");
      assert(proposal.assetId, "proposal missing assetId", "INVALID_PROPOSAL");

      const existing = assetRegistry.get(proposal.assetId);
      let asset;
      if (!existing) {
        asset = assetRegistry.register({
          id: proposal.assetId,
          type: proposal.targetAssetType,
          status: proposal.status === "NEEDS_CONFIRMATION" ? "NEEDS_CONFIRMATION" : "PROPOSED",
          tenantId: proposal.tenantId || task.tenantId || options.tenantId,
          ownerOrganizationId: proposal.ownerOrganizationId || options.ownerOrganizationId,
          name: proposal.name || proposal.assetId,
          subjectRefs: proposal.subjectRefs || {},
          temporal: proposal.temporal || null,
          payload: proposal.proposedPatch || proposal.payload || {},
          provenance: {
            sourceType: "agent-extraction",
            sourceAssetIds: proposal.sourceAssetIds || [],
            extractionRuleVersion: task.ruleOrPromptVersion,
            agentTaskId: task.id,
            agentSerialNo: task.serialNo,
            proposalId: proposal.proposalId || (task.id + ":" + proposal.assetId)
          },
          access: proposal.access || { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
          quality: proposal.quality || (task.status === "READY_PARTIAL"
            ? { completeness: "partial", issues: [{ code: "PARTIAL_EXTRACT", severity: "warning", message: "Partial extraction" }] }
            : undefined)
        }, command);
      } else if (["DRAFT", "PROPOSED", "NEEDS_CONFIRMATION"].indexOf(existing.status) !== -1 && proposal.reviseIfExists) {
        asset = assetRegistry.revise(proposal.assetId, {
          status: "NEEDS_CONFIRMATION",
          payload: Object.assign({}, existing.payload || {}, proposal.proposedPatch || {}),
          provenance: Object.assign({}, existing.provenance || {}, {
            agentTaskId: task.id,
            agentSerialNo: task.serialNo,
            extractionRuleVersion: task.ruleOrPromptVersion
          })
        }, command);
      } else {
        asset = existing;
      }

      let binding = null;
      if (proposal.binding) {
        const bindingId = proposal.binding.id;
        assert(bindingId, "binding missing id", "INVALID_BINDING");
        const found = assetRegistry.bindings({ id: bindingId })[0];
        if (!found) {
          binding = assetRegistry.bind({
            id: bindingId,
            serviceId: proposal.binding.serviceId || task.serviceId,
            caseId: proposal.binding.caseId || task.caseId,
            assetId: proposal.assetId,
            usagePurpose: proposal.binding.usagePurpose || "agent_proposal",
            scopeId: proposal.binding.scopeId || null,
            status: "PROPOSED"
          }, command);
        } else {
          binding = found;
        }
      }

      applied.push({
        assetId: asset.id,
        assetVersionId: asset.versionId,
        assetStatus: asset.status,
        bindingId: binding ? binding.id : null,
        bindingStatus: binding ? binding.status : null,
        proposalId: proposal.proposalId || null
      });
    });

    return {
      taskId: task.id,
      serialNo: task.serialNo,
      businessType: task.businessType,
      appliedAs: "proposal_only",
      partial: task.status === "READY_PARTIAL",
      applied: applied
    };
  }

  return { BRIDGE_VERSION: BRIDGE_VERSION, applyTaskResult: applyTaskResult };
});
