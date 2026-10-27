"use strict";

  if (state.importedTrial) {
    const notice = $("#importNotice");
    notice.hidden = false;
    notice.innerHTML = `<strong>已保留刚才的试算摘要</strong>${state.importedTrial.year} 年 · CN ${state.importedTrial.cnCode} · ${state.importedTrial.quantity.toLocaleString("zh-CN")} 吨。登录后可核对并建立正式项目。`;
  }
  const demoRole = incoming.get("demoRole");
  if (demoRole && roleConfig[demoRole]) {
    login(demoRole);
    const demoYear = incoming.get("demoYear");
    if (demoYear && years[demoYear]) {
      state.year = demoYear;
      state.quarter = annualProfiles[demoYear].defaultQuarter;
      loadPeriodState();
      syncUiFromWorkflow();
    }
    const demoPage = incoming.get("demoPage");
    const adminUtilityPages = new Set(["org-settings", "annual-setup"]);
    if (demoPage && (roleConfig[demoRole].nav.some(([id]) => id === demoPage) || (customerRoles.has(demoRole) && (globalCustomerPages.has(demoPage) || servicePages.has(demoPage))) || (demoRole === "customer_admin" && adminUtilityPages.has(demoPage)))) state.page = demoPage;
    render();
  } else {
    const sessionRole = window.sessionStorage.getItem("lumino-portal-session-role");
    if (sessionRole && roleConfig[sessionRole]) login(sessionRole, { restore: true });
  }
  window.addEventListener("online", () => { state.online = true; if (state.loggedIn) render(); toast("网络已恢复，可以继续提交。"); });
  window.addEventListener("offline", () => { state.online = false; if (state.loggedIn) render(); });
