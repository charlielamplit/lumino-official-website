"use strict";

  if (state.importedTrial) {
    const notice = $("#importNotice");
    notice.hidden = false;
    notice.innerHTML = `<strong>已保留刚才的试算摘要</strong>${safe(state.importedTrial.year)} 年 · CN ${safe(state.importedTrial.cnCode)} · ${safe(state.importedTrial.quantity.toLocaleString("zh-CN"))} 吨。登录后可核对并建立正式项目。`;
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
    if (demoPage && canAccessPage(demoPage, demoRole, state.currentService)) state.page = demoPage;
    render();
  } else {
    const sessionRole = window.sessionStorage.getItem("lumino-portal-session-role");
    if (sessionRole && roleConfig[sessionRole]) login(sessionRole, { restore: true });
  }
  window.addEventListener("online", () => { state.online = true; if (state.loggedIn) render(); toast("网络已恢复，可以继续提交。"); });
  window.addEventListener("offline", () => { state.online = false; if (state.loggedIn) render(); });
