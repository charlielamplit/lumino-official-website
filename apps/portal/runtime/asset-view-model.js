(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoAssetViewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MASTER_TYPES = new Set(["organization", "organizationUnit", "facility", "product", "productVariant", "process", "productionLine", "counterparty"]);
  const ACTIVITY_TYPES = new Set(["measurement", "energyConsumption", "materialFlow", "productionOutput", "transportActivity", "wasteActivity", "shipmentEvent", "businessTransaction"]);
  const EVIDENCE_TYPES = new Set(["evidence", "certificate", "supplierDeclaration"]);
  const ATTENTION_STATUSES = new Set(["PROPOSED", "NEEDS_CONFIRMATION", "CONFLICTED"]);
  const PENDING_BINDING_STATUSES = new Set(["PROPOSED", "PENDING_CONFIRMATION"]);

  function create(registry, defaults = {}) {
    if (!registry) throw new Error("Asset ViewModel requires an asset registry");
    const defaultTenantId = defaults.tenantId || null;

    function context(input = {}) {
      return { tenantId: input.tenantId || defaultTenantId, role: input.role || "customer_owner", serviceId: input.serviceId || null };
    }

    function accessibleAssets(input = {}) {
      return registry.catalog(context(input));
    }

    function accessibleAsset(id, input = {}) {
      return accessibleAssets(input).find((asset) => asset.id === id) || null;
    }

    function bindingsForVisibleAsset(assetId, input = {}) {
      if (!accessibleAsset(assetId, input)) return [];
      return registry.bindingsForAsset(assetId);
    }

    function overview(input = {}) {
      const assets = accessibleAssets(input);
      const visibleIds = new Set(assets.map((asset) => asset.id));
      const bindings = registry.bindings().filter((binding) => visibleIds.has(binding.assetId));
      const bindingsByAsset = new Map();
      bindings.forEach((binding) => {
        const rows = bindingsByAsset.get(binding.assetId) || [];
        rows.push(binding);
        bindingsByAsset.set(binding.assetId, rows);
      });
      const attentionIds = new Set(assets.filter((asset) => ATTENTION_STATUSES.has(asset.status)).map((asset) => asset.id));
      bindings.filter((binding) => PENDING_BINDING_STATUSES.has(binding.status)).forEach((binding) => attentionIds.add(binding.assetId));
      const matchesFacet = (asset, facet) => {
        const assetBindings = bindingsByAsset.get(asset.id) || [];
        if (facet === "attention") return attentionIds.has(asset.id);
        if (facet === "master") return MASTER_TYPES.has(asset.type);
        if (facet === "activity") return ACTIVITY_TYPES.has(asset.type);
        if (facet === "evidence") return EVIDENCE_TYPES.has(asset.type);
        if (facet === "bound") return assetBindings.length > 0;
        return true;
      };
      const facet = input.facet || "attention";
      const items = assets.filter((asset) => matchesFacet(asset, facet)).map((asset) => {
        const assetBindings = bindingsByAsset.get(asset.id) || [];
        return {
          asset,
          bindings: assetBindings,
          hasPendingBinding: assetBindings.some((binding) => PENDING_BINDING_STATUSES.has(binding.status)),
          primaryIssue: asset.quality?.issues?.[0] || null,
        };
      });
      const count = (name) => assets.filter((asset) => matchesFacet(asset, name)).length;
      return {
        facet,
        assets,
        items,
        bindings,
        attentionIds: [...attentionIds],
        facets: [
          { id: "attention", label: "待我处理", count: attentionIds.size },
          { id: "all", label: "全部", count: assets.length },
          { id: "master", label: "主档", count: count("master") },
          { id: "activity", label: "活动数据", count: count("activity") },
          { id: "evidence", label: "证据", count: count("evidence") },
          { id: "bound", label: "被服务使用", count: count("bound") },
        ],
        summary: {
          total: assets.length,
          evidence: count("evidence"),
          reusable: assets.filter((asset) => (bindingsByAsset.get(asset.id) || []).length > 1).length,
          attention: attentionIds.size,
        },
      };
    }

    function detail(assetId, input = {}) {
      const asset = accessibleAsset(assetId, input);
      if (!asset) return null;
      const visibleIds = new Set(accessibleAssets(input).map((item) => item.id));
      return {
        asset,
        bindings: registry.bindingsForAsset(assetId),
        lineage: registry.lineage(assetId),
        history: registry.history(assetId),
        impact: registry.previewImpact(assetId),
        sourceNames: (asset.provenance?.sourceAssetIds || []).map((id) => visibleIds.has(id) ? (registry.get(id)?.name || id) : "受限来源"),
      };
    }

    function impact(assetId, input = {}) {
      return accessibleAsset(assetId, input) ? registry.previewImpact(assetId) : null;
    }

    return { overview, detail, impact, accessibleAsset, accessibleAssets, bindingsForVisibleAsset };
  }

  return { create, MASTER_TYPES, ACTIVITY_TYPES, EVIDENCE_TYPES };
});
