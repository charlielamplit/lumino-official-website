const test = require("node:test");
const assert = require("node:assert/strict");
const permissions = require("../apps/portal/runtime/portal-permissions.js");

test("PCF 报告锁定只允许独立复核员执行", () => {
  ["customer_admin", "customer_owner", "customer_contrib", "customer_approver", "expert", "ops"].forEach((role) => {
    assert.equal(permissions.canPerform(role, "pcf-complete-review"), false, role);
  });
  assert.equal(permissions.canPerform("reviewer", "pcf-complete-review"), true);
});

test("客户业务动作与内部审批保持职责分离", () => {
  assert.equal(permissions.canPerform("customer_owner", "pcf-confirm-scope"), true);
  assert.equal(permissions.canPerform("customer_contrib", "pcf-confirm-scope"), false);
  assert.equal(permissions.canPerform("customer_approver", "workflow-approval"), true);
  assert.equal(permissions.canPerform("customer_owner", "workflow-approval"), false);
});

test("未登记的普通界面动作不被权限模块误拦截", () => {
  assert.equal(permissions.canPerform("customer_owner", "dismiss-onboarding"), true);
  assert.equal(permissions.allowedRoles("dismiss-onboarding"), null);
});

test("CBAM 黄金路径保持客户、系统、复核和审批职责分离", () => {
  assert.equal(permissions.canPerform("customer_owner", "cbam-confirm-quarter-data"), true);
  assert.equal(permissions.canPerform("customer_approver", "cbam-confirm-quarter-data"), false);
  assert.equal(permissions.canPerform("system", "cbam-run-calculation"), true);
  assert.equal(permissions.canPerform("customer_owner", "cbam-run-calculation"), false);
  assert.equal(permissions.canPerform("reviewer", "cbam-review-calculation"), true);
  assert.equal(permissions.canPerform("customer_approver", "cbam-review-calculation"), false);
  assert.equal(permissions.canPerform("customer_owner", "cbam-build-package"), true);
});
