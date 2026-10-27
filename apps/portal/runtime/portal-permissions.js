(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoPortalPermissions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ACTION_ROLES = Object.freeze({
    "asset-confirm": Object.freeze(["customer_admin", "customer_owner"]),
    "asset-revise-confirm": Object.freeze(["customer_admin", "customer_owner"]),
    "pcf-confirm-scope": Object.freeze(["customer_admin", "customer_owner"]),
    "pcf-confirm-boundary": Object.freeze(["customer_admin", "customer_owner"]),
    "pcf-confirm-proposal": Object.freeze(["customer_admin", "customer_owner"]),
    "pcf-run-calculation": Object.freeze(["customer_admin", "customer_owner"]),
    "pcf-complete-review": Object.freeze(["reviewer"]),
    "workflow-approval": Object.freeze(["customer_approver"]),
  });

  function allowedRoles(action) {
    return ACTION_ROLES[action] ? [...ACTION_ROLES[action]] : null;
  }

  function canPerform(role, action) {
    const roles = ACTION_ROLES[action];
    return !roles || roles.includes(role);
  }

  function denialMessage(action) {
    if (action === "pcf-complete-review") return "该操作仅由独立复核员执行；客户可查看草稿和复核状态。";
    if (action === "workflow-approval") return "该操作需要内部审批人权限。";
    return "当前角色没有执行此操作的权限。";
  }

  return { ACTION_ROLES, allowedRoles, canPerform, denialMessage };
});
