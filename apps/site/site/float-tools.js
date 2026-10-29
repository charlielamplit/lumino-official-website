(function () {
  "use strict";
  const i18n = window.LuminoI18n || { detectLang: () => "zh" };
  const tools = [
    { zh: "CBAM 成本计算器", en: "CBAM cost calculator", href: "/apps/site/calculator/", blank: true },
    { zh: "产品碳足迹快速估算", en: "Quick footprint estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=pcf&source=tool-float" },
    { zh: "企业排放量估算", en: "Company emissions estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=inventory&source=tool-float" },
    { zh: "绿电需求测算", en: "Renewable power needs", href: "/apps/site/Lumino%20联系.dc.html?serviceId=assets&source=tool-float" },
  ];
  function mount() {
    if (document.querySelector(".tool-float")) return;
    const L = i18n.detectLang();
    const label = L === "en" ? "Estimate" : "测算";
    const title = L === "en" ? "Choose a calculator" : "选择测算";
    const root = document.createElement("div");
    root.className = "tool-float";
    root.innerHTML = `
      <div class="tool-float__panel" id="tool-float-panel" hidden role="menu" aria-label="${title}">
        ${tools.map((t) => `<a href="${t.href}" role="menuitem"${t.blank ? ' target="_blank" rel="noopener"' : ""}><strong>${L === "en" ? t.en : t.zh}</strong></a>`).join("")}
      </div>
      <button type="button" class="tool-float__btn" aria-expanded="false" aria-controls="tool-float-panel">${label}</button>`;
    document.body.appendChild(root);
    const btn = root.querySelector(".tool-float__btn");
    const panel = root.querySelector(".tool-float__panel");
    const close = () => { btn.setAttribute("aria-expanded", "false"); panel.hidden = true; };
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
