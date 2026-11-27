"use strict";

  if (state.importedTrial) {
    const notice = $("#importNotice");
    notice.hidden = false;
    notice.innerHTML = `<strong>已保留刚才的试算摘要</strong>${safe(state.importedTrial.year)} 年 · CN ${safe(state.importedTrial.cnCode)} · ${safe(state.importedTrial.quantity.toLocaleString("zh-CN"))} 吨。客户账号开通后可核对并建立项目。`;
  }
  const demoRole = incoming.get("demoRole");
  if (["127.0.0.1", "localhost"].includes(window.location.hostname) && demoRole && roleConfig[demoRole]) {
    login(demoRole, { demo: true });
    const demoYear = incoming.get("demoYear");
    if (demoYear && years[demoYear]) {
      state.year = demoYear;
      state.quarter = annualProfiles[demoYear].defaultQuarter;
      loadPeriodState();
      syncUiFromWorkflow();
    }
    const demoPage = incoming.get("demoPage");
    if (demoPage && canAccessPage(demoPage, demoRole, state.currentService)) state.page = demoPage;
    render();
  } else {
    const sessionRole = window.sessionStorage.getItem("lumino-portal-session-role");
    const sessionMode = window.sessionStorage.getItem("lumino-portal-session-mode");
    if (window.sessionStorage.getItem("lumino-portal-customer-token")) {
      void restorePortalCustomerSession();
    } else if (sessionRole && roleConfig[sessionRole] && ((sessionMode === "demo" && ["127.0.0.1", "localhost"].includes(window.location.hostname)) || (sessionMode === "staff" && window.LuminoLeadsClient?.hasStaffSession()))) {
      login(sessionRole, { restore: true, demo: sessionMode === "demo" });
    }
  }
  void restoreIntakeRecords().then(() => { if (state.loggedIn) render(); }).catch((error) => toast(error.message || "本地证据恢复失败。"));
  window.addEventListener("online", () => { state.online = true; if (state.loggedIn) render(); toast("网络已恢复，可以继续提交。"); });
  window.addEventListener("offline", () => { state.online = false; if (state.loggedIn) render(); });
