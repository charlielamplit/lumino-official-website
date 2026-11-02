(function () {
  "use strict";
  const i18n = window.LuminoI18n || { detectLang: () => "zh" };
  const tools = [
    { zh: "CBAM 成本计算器", en: "CBAM cost calculator", href: "/apps/site/calculator/" },
    { zh: "申请产品碳足迹初步估算", en: "Request a footprint estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=pcf&source=tool-float" },
    { zh: "申请企业排放初步估算", en: "Request an emissions estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=inventory&source=tool-float" },
    { zh: "申请绿电需求测算", en: "Request a renewable-power estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=assets&source=tool-float" },
  ];
  function loadStyle(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing?.dataset.loaded === "true") return resolve();
      const script = existing || document.createElement("script");
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
      script.addEventListener("error", reject, { once: true });
      if (!existing) document.head.appendChild(script);
    });
  }
  let advisorPromise = null;
  function ensureAdvisor() {
    if (window.LuminoAdvisorWidget) return Promise.resolve(window.LuminoAdvisorWidget);
    if (!advisorPromise) {
      const v = "20261102-copy1";
      loadStyle(`/apps/site/site/advisor-widget.css?v=${v}`);
      advisorPromise = loadScript(`/packages/advisor/catalog.js?v=${v}`)
        .then(() => loadScript(`/packages/advisor/schema.js?v=${v}`))
        .then(() => loadScript(`/packages/advisor/router.js?v=${v}`))
        .then(() => loadScript(`/apps/site/site/advisor-widget.js?v=${v}`))
        .then(() => window.LuminoAdvisorWidget);
    }
    return advisorPromise;
  }
  function mount() {
    if (document.querySelector(".tool-float")) return;
    const L = i18n.detectLang();
    const label = L === "en" ? "Tools" : "工具";
    const title = L === "en" ? "Choose a tool" : "选择工具";
    const advisorLabel = L === "en" ? "Ask Lumino" : "问 Lumino";
    const advisorHint = L === "en" ? "Find the right service and next step" : "帮你找到合适的服务与下一步";
    const root = document.createElement("div");
    root.className = "tool-float";
    root.innerHTML = `
      <div class="tool-float__panel" id="tool-float-panel" hidden role="menu" aria-label="${title}">
        <button type="button" role="menuitem" data-open-advisor><strong>${advisorLabel}</strong><small>${advisorHint}</small></button>
        ${tools.map((t) => `<a href="${t.href}" role="menuitem"><strong>${L === "en" ? t.en : t.zh}</strong></a>`).join("")}
      </div>
      <button type="button" class="tool-float__btn" aria-expanded="false" aria-controls="tool-float-panel">${label}</button>`;
    document.body.appendChild(root);
    const btn = root.querySelector(".tool-float__btn");
    const panel = root.querySelector(".tool-float__panel");
    const close = () => { btn.setAttribute("aria-expanded", "false"); panel.hidden = true; };
    root.querySelector("[data-open-advisor]").addEventListener("click", async (event) => {
      const opener = event.currentTarget;
      opener.disabled = true;
      close();
      try {
        const widget = await ensureAdvisor();
        widget.open({ trigger: btn });
        opener.disabled = false;
      } catch (_) {
        opener.disabled = false;
        window.location.href = "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor-load-error";
      }
    });
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.addEventListener("click", (e) => { if (!root.contains(e.target)) close(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
