(function () {
  "use strict";
  const i18n = window.LuminoI18n || { detectLang: () => "zh" };
  const TOP_SHOW_Y = 480;
  const tools = [
    { zh: "CBAM 成本计算器", en: "CBAM cost calculator", href: "/apps/site/calculator/" },
    { zh: "申请产品碳足迹初步估算", en: "Request a footprint estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=pcf&source=tool-float" },
    { zh: "申请企业排放初步估算", en: "Request an emissions estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=inventory&source=tool-float" },
    { zh: "申请绿电需求测算", en: "Request a renewable-power estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=assets&source=tool-float" },
  ];
  const ICONS = {
    // Same 24 viewBox + .tool-float__icon (20px) for ask / tools / top.
    ask: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1v3.2a.8.8 0 0 0 1.3.62L11.1 17H20a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4z"/></svg>',
    // Filled 2×2 tiles — same solid weight as ask bubble (not outline wrench).
    tools: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.5 3.5h7v7h-7v-7Zm10 0h7v7h-7v-7ZM3.5 13.5h7v7h-7v-7Zm10 0h7v7h-7v-7Z"/></svg>',
    top: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 4.2 4.8 11.4h3.7V19.5h7V11.4h3.7L12 4.2z"/></svg>',
  };
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
  function previewHost() {
    const host = String(location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || /\.vercel\.app$/.test(host);
  }
  async function loadAdvisorFlags() {
    try {
      const response = await fetch("/api/advisor-config", {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(2500),
      });
      if (!response.ok) throw new Error("config_http");
      return await response.json();
    } catch (_) {
      return { public_beta: previewHost(), model_enabled: true, lead_capture: false };
    }
  }
  let advisorPromise = null;
  function ensureAdvisor() {
    if (window.LuminoAdvisorWidget) return Promise.resolve(window.LuminoAdvisorWidget);
    if (!advisorPromise) {
      const v = "20261104-fab6";
      loadStyle(`/apps/site/site/advisor-widget.css?v=${v}`);
      advisorPromise = loadScript(`/packages/advisor/catalog.js?v=${v}`)
        .then(() => loadScript(`/packages/advisor/schema.js?v=${v}`))
        .then(() => loadScript(`/packages/advisor/router.js?v=${v}`))
        .then(() => loadScript(`/apps/site/site/advisor-widget.js?v=${v}`))
        .then(() => window.LuminoAdvisorWidget);
    }
    return advisorPromise;
  }
  function hideSoftEntries() {
    document.querySelectorAll("[data-open-advisor]").forEach((node) => {
      if (node.closest(".tool-float")) return;
      node.hidden = true;
      node.setAttribute("aria-hidden", "true");
      node.style.display = "none";
      node.setAttribute("disabled", "true");
    });
  }
  function bindSoftEntries(flags) {
    document.querySelectorAll("[data-open-advisor]").forEach((node) => {
      if (node.closest(".tool-float")) return;
      if (!flags.public_beta) {
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
        node.style.display = "none";
        node.setAttribute("disabled", "true");
        return;
      }
      node.hidden = false;
      node.removeAttribute("aria-hidden");
      node.style.display = "";
      node.removeAttribute("disabled");
      if (node.dataset.advisorBound === "1") return;
      node.dataset.advisorBound = "1";
      node.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          const widget = await ensureAdvisor();
          widget.open({ trigger: node, flags });
        } catch (_) {
          window.location.href = "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor-load-error";
        }
      });
    });
  }
  function labels(lang) {
    return lang === "en"
      ? {
          ask: "Ask Lumino",
          tools: "Tools",
          toolsTitle: "Choose a tool",
          toolsHint: "Calculators and estimates",
          top: "Back to top",
        }
      : {
          ask: "问 Lumino",
          tools: "工具",
          toolsTitle: "选择工具",
          toolsHint: "计算器与初步估算",
          top: "回到顶部",
        };
  }
  function mountShell() {
    if (document.querySelector(".tool-float")) return null;
    hideSoftEntries();
    const L = i18n.detectLang();
    const copy = labels(L);
    const root = document.createElement("div");
    root.className = "tool-float";
    root.setAttribute("data-float-dock", "1");
    root.innerHTML = `
      <div class="tool-float__panel" id="tool-float-panel" hidden role="menu" aria-label="${copy.toolsTitle}">
        ${tools.map((t) => `<a href="${t.href}" role="menuitem"><strong>${L === "en" ? t.en : t.zh}</strong></a>`).join("")}
      </div>
      <div class="tool-float__stack">
        <button type="button" class="tool-float__btn tool-float__btn--top" data-float-top hidden aria-label="${copy.top}">
          <span class="tool-float__tip">${copy.top}</span>
          ${ICONS.top}
        </button>
        <button type="button" class="tool-float__btn tool-float__btn--tools" data-float-tools aria-expanded="false" aria-controls="tool-float-panel" aria-label="${copy.tools}">
          <span class="tool-float__tip">${copy.tools}</span>
          ${ICONS.tools}
        </button>
        <button type="button" class="tool-float__btn tool-float__btn--ask" data-float-primary data-open-advisor aria-label="${copy.ask}">
          <span class="tool-float__tip">${copy.ask}</span>
          ${ICONS.ask}
        </button>
      </div>`;
    document.body.appendChild(root);
    const primary = root.querySelector("[data-float-primary]");
    const toolsBtn = root.querySelector("[data-float-tools]");
    const topBtn = root.querySelector("[data-float-top]");
    const panel = root.querySelector(".tool-float__panel");
    const closePanel = () => {
      toolsBtn.setAttribute("aria-expanded", "false");
      panel.hidden = true;
    };
    toolsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = toolsBtn.getAttribute("aria-expanded") !== "true";
      toolsBtn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    });
    topBtn.addEventListener("click", () => {
      closePanel();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const syncTop = () => {
      topBtn.hidden = !(window.scrollY > TOP_SHOW_Y);
    };
    window.addEventListener("scroll", syncTop, { passive: true });
    syncTop();
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
    document.addEventListener("click", (e) => { if (!root.contains(e.target)) closePanel(); });
    return { root, panel, primary, toolsBtn, topBtn, closePanel, L, copy };
  }
  function setIconButton(btn, { kind, label, askMode }) {
    btn.className = `tool-float__btn tool-float__btn--${kind}`;
    btn.setAttribute("aria-label", label);
    btn.innerHTML = `<span class="tool-float__tip">${label}</span>${ICONS[kind] || ""}`;
    if (askMode) btn.setAttribute("data-open-advisor", "");
    else btn.removeAttribute("data-open-advisor");
  }
  function wirePrimaryAsTools(shell) {
    const { primary, toolsBtn, panel, copy } = shell;
    setIconButton(primary, { kind: "tools", label: copy.tools, askMode: false });
    primary.setAttribute("aria-expanded", "false");
    primary.setAttribute("aria-controls", "tool-float-panel");
    toolsBtn.hidden = true;
    primary.onclick = () => {
      const open = panel.hidden;
      primary.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    };
  }
  function wirePrimaryAsAdvisor(shell, flags) {
    const { primary, toolsBtn, panel, closePanel, copy } = shell;
    setIconButton(primary, { kind: "ask", label: copy.ask, askMode: true });
    primary.removeAttribute("aria-controls");
    primary.removeAttribute("aria-expanded");
    toolsBtn.hidden = false;
    toolsBtn.setAttribute("aria-expanded", "false");
    panel.hidden = true;
    primary.onclick = async () => {
      closePanel();
      primary.disabled = true;
      try {
        const widget = await ensureAdvisor();
        widget.open({ trigger: primary, flags });
      } catch (_) {
        window.location.href = "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor-load-error";
      } finally {
        primary.disabled = false;
      }
    };
  }
  async function mount() {
    const shell = mountShell();
    if (!shell) return;
    const flags = await loadAdvisorFlags();
    if (flags.public_beta) wirePrimaryAsAdvisor(shell, flags);
    else wirePrimaryAsTools(shell);
    bindSoftEntries(flags);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mount(); });
  else mount();
})();
