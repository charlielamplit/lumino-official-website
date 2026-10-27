(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoProposalBridge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BRIDGE_VERSION = "0.1.0";

  function assert(condition, message, code = "PROPOSAL_BRIDGE_ERROR") {
    if (condition) return;
    const error = new Error(message);
    error.code = code;
    error.retryable = false;
    throw error;
  }

  /**
   * Apply a READY / READY_PARTIAL agent task onto AssetRegistry as PROPOSED facts only.
   * Never confirms assets or bindings.
   */
  function applyTaskResult(assetRegistry, task, options = {}) {
    assert(assetRegistry && typeof assetRegistry.register === "function", "?? AssetRegistry", "MISSING_REGISTRY");
    assert(task && task.id, "??????", "MISSING_TASK");
    assert(["READY", "READY_PARTIAL"].includes(task.status), `???? ${task.status} ?????`, "TASK_NOT_READY");
    assert(task.result && Array.isArray(task.result.proposals), "?????? proposals", "MISSING_PROPOSALS");

    const actor = options.actor || "Asset Agent";
    const command = {
      actor,
      role: "agent",
      reason: options.reason || `Agent ?? ${task.id} ???????`,
      basis: options.basis || task.ruleOrPromptVersion || task.promptId
    };

    const applied = [];
    for (const proposal of task.result.proposals) {
      assert(proposal.targetAssetType, "proposal ?? targetAssetType", "INVALID_PROPOSAL");
      assert(proposal.assetId, "proposal ?? assetId", "INVALID_PROPOSAL");

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
            proposalId: proposal.proposalId || `${task.id}:${proposal.assetId}`
          },
          access: proposal.access || { confidentiality: "sensitive", visibility: "enterprise", allowedRoles: [], metadataVisible: true },
          quality: proposal.quality || (task.status === "READY_PARTIAL"
            ? { completeness: "partial", issues: [{ code: "PARTIAL_EXTRACT", severity: "warning", message: "??????????" }] }
            : undefined)
        }, command);
      } else if (["DRAFT", "PROPOSED", "NEEDS_CONFIRMATION"].includes(existing.status) && proposal.reviseIfExists) {
        asset = assetRegistry.revise(proposal.assetId, {
          status: "NEEDS_CONFIRMATION",
          payload: { ...(existing.payload || {}), ...(proposal.proposedPatch || {}) },
          provenance: {
            ...(existing.provenance || {}),
            agentTaskId: task.id,
            agentSerialNo: task.serialNo,
            extractionRuleVersion: task.ruleOrPromptVersion
          }
        }, command);
      } else {
        asset = existing;
      }

      let binding = null;
      if (proposal.binding) {
        const bindingId = proposal.binding.id;
        assert(bindingId, "binding ?? id", "INVALID_BINDING");
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
          assert(
            ["PROPOSED", "PENDING_CONFIRMATION", "CONFIRMED", "REJECTED", "SUPERSEDED"].includes(found.status),
            "??????",
            "INVALID_BINDING"
          );
          binding = found;
        }
      }

      applied.push({
        assetId: asset.id,
        assetVersionId: asset.versionId,
        assetStatus: asset.status,
        bindingId: binding?.id || null,
        bindingStatus: binding?.status || null,
        proposalId: proposal.proposalId || null
      });
    }

    return {
      taskId: task.id,
      serialNo: task.serialNo,
      businessType: task.businessType,
      appliedAs: "proposal_only",
      partial: task.status === "READY_PARTIAL",
      applied
    };
  }

  return { BRIDGE_VERSION, applyTaskResult };
});
