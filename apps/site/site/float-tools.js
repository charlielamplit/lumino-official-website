(function () {
  "use strict";
  const i18n = window.LuminoI18n || { detectLang: () => "zh" };
  const TOP_SHOW_Y = 480;
  // Preload hints reduce download time; the runtime itself starts only after user intent.
  const ADVISOR_ASSET_V = "20261108-compact1";
  const ADVISOR_OPEN_TIMEOUT_MS = 12000;
  const ADVISOR_SCRIPT_TIMEOUT_MS = 6000;
  const pendingScriptCancels = new Set();
  const tools = [
    { zh: "CBAM 成本计算器", en: "CBAM cost calculator", href: "/apps/site/calculator/" },
    { zh: "申请产品碳足迹初步估算", en: "Request a footprint estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=pcf&source=tool-float" },
    { zh: "申请企业排放初步估算", en: "Request an emissions estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=inventory&source=tool-float" },
    { zh: "申请绿电需求测算", en: "Request a renewable-power estimate", href: "/apps/site/Lumino%20联系.dc.html?serviceId=assets&source=tool-float" },
  ];
  const ICONS = {
    ask: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1v3.2a.8.8 0 0 0 1.3.62L11.1 17H20a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4z"/></svg>',
    tools: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3.5 3.5h7v7h-7v-7Zm10 0h7v7h-7v-7ZM3.5 13.5h7v7h-7v-7Zm10 0h7v7h-7v-7Z"/></svg>',
    top: '<svg class="tool-float__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 4.2 4.8 11.4h3.7V19.5h7V11.4h3.7L12 4.2z"/></svg>',
  };
  const ADVISOR_ASSETS = Object.freeze({
    css: `/apps/site/site/advisor-widget.css?v=${ADVISOR_ASSET_V}`,
    catalog: `/packages/advisor/catalog.js?v=${ADVISOR_ASSET_V}`,
    schema: `/packages/advisor/schema.js?v=${ADVISOR_ASSET_V}`,
    router: `/packages/advisor/router.js?v=${ADVISOR_ASSET_V}`,
    widget: `/apps/site/site/advisor-widget.js?v=${ADVISOR_ASSET_V}`,
  });

  function loadStyle(href) {
    return new Promise((resolve, reject) => {
      // A preload link is not an applied stylesheet. Only reuse rel=stylesheet.
      const existing = document.querySelector(`link[rel="stylesheet"][href="${href}"]`);
      if (existing?.dataset.loaded === "true" || existing?.sheet) return resolve();
      const link = existing || document.createElement("link");
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          link.remove();
          reject(error);
          return;
        }
        link.dataset.loaded = "true";
        resolve();
      };
      const timer = setTimeout(() => finish(new Error(`style_load_timeout:${href}`)), ADVISOR_SCRIPT_TIMEOUT_MS);
      link.addEventListener("load", () => finish(), { once: true });
      link.addEventListener("error", () => finish(new Error(`style_load_failed:${href}`)), { once: true });
      if (!existing) {
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  function preloadScript(href) {
    if (document.querySelector(`link[rel="preload"][as="script"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = href;
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing?.dataset.loaded === "true") return resolve();
      if (existing && existing.dataset.loaded !== "true") existing.remove();
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.advisorLoading = "1";
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingScriptCancels.delete(cancel);
        script.dataset.advisorLoading = "0";
        if (error) {
          script.remove();
          reject(error);
          return;
        }
        script.dataset.loaded = "true";
        resolve();
      };
      const cancel = () => finish(new Error(`script_load_cancelled:${src}`));
      pendingScriptCancels.add(cancel);
      const timer = setTimeout(() => {
        finish(new Error(`script_load_timeout:${src}`));
      }, ADVISOR_SCRIPT_TIMEOUT_MS);
      script.addEventListener("load", () => finish(), { once: true });
      script.addEventListener("error", () => finish(new Error(`script_load_failed:${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  function withTimeout(promise, ms, code) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(code || "timeout")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
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
  function resetAdvisorLoader() {
    advisorPromise = null;
    [...pendingScriptCancels].forEach((cancel) => cancel());
    document.querySelectorAll('script[data-advisor-loading="1"]').forEach((script) => script.remove());
  }
  function ensureAdvisor() {
    if (window.LuminoAdvisorWidget) {
      return loadStyle(ADVISOR_ASSETS.css).then(() => window.LuminoAdvisorWidget);
    }
    if (!advisorPromise) {
      preloadScript(ADVISOR_ASSETS.catalog);
      preloadScript(ADVISOR_ASSETS.schema);
      preloadScript(ADVISOR_ASSETS.router);
      preloadScript(ADVISOR_ASSETS.widget);
      const loadAttempt = Promise.all([
        loadStyle(ADVISOR_ASSETS.css),
        loadScript(ADVISOR_ASSETS.catalog),
        loadScript(ADVISOR_ASSETS.schema),
      ])
        .then(() => loadScript(ADVISOR_ASSETS.router))
        .then(() => loadScript(ADVISOR_ASSETS.widget))
        .then(() => {
          if (!window.LuminoAdvisorWidget) throw new Error("advisor_widget_missing");
          return window.LuminoAdvisorWidget;
        });
      advisorPromise = withTimeout(loadAttempt, ADVISOR_OPEN_TIMEOUT_MS, "advisor_load_timeout")
        .catch((error) => {
          resetAdvisorLoader();
          throw error;
        });
    }
    return advisorPromise;
  }

  function bootstrapCopy() {
    return i18n.detectLang() === "en"
      ? {
          title: "Lumino Service Guide",
          loading: "Opening the advisor…",
          failed: "The advisor took too long to load.",
          hint: "Check your connection and try again, or contact us directly.",
          retry: "Try again",
          contact: "Contact us",
          close: "Close",
        }
      : {
          title: "Lumino 服务顾问",
          loading: "正在打开顾问……",
          failed: "顾问加载超时。",
          hint: "请检查网络后重试，或直接联系我们。",
          retry: "重试",
          contact: "联系我们",
          close: "关闭",
        };
  }

  function showAdvisorBootstrap(trigger) {
    document.querySelector(".advisor-bootstrap")?.remove();
    const copy = bootstrapCopy();
    const shell = document.createElement("section");
    shell.className = "advisor-bootstrap";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "false");
    shell.setAttribute("aria-labelledby", "advisor-bootstrap-title");
    shell.innerHTML = `<header><strong id="advisor-bootstrap-title">${copy.title}</strong>
      <button type="button" aria-label="${copy.close}" data-advisor-bootstrap-close>×</button></header>
      <div class="advisor-bootstrap__body" aria-live="polite"><span class="advisor-bootstrap__spinner" aria-hidden="true"></span><p>${copy.loading}</p></div>`;
    document.body.appendChild(shell);
    shell.querySelector("[data-advisor-bootstrap-close]").addEventListener("click", () => {
      shell.dataset.cancelled = "1";
      resetAdvisorLoader();
      shell.remove();
      trigger?.focus?.({ preventScroll: true });
    });
    return shell;
  }

  function showAdvisorLoadError(shell, trigger) {
    const copy = bootstrapCopy();
    shell.classList.add("is-error");
    shell.querySelector(".advisor-bootstrap__body").innerHTML = `<strong>${copy.failed}</strong><p>${copy.hint}</p>
      <div class="advisor-bootstrap__actions"><button type="button" class="button button--sm" data-advisor-load-retry>${copy.retry}</button>
      <a class="button button--outline button--sm" href="/apps/site/Lumino%20联系.dc.html?source=homepage-advisor-load-error">${copy.contact}</a></div>`;
    shell.querySelector("[data-advisor-load-retry]").addEventListener("click", () => {
      shell.remove();
      trigger?.click?.();
    });
    shell.querySelector("[data-advisor-load-retry]").focus({ preventScroll: true });
  }

  async function openAdvisorSafe(trigger, flags, source) {
    const shell = showAdvisorBootstrap(trigger);
    try {
      const widget = await ensureAdvisor();
      if (shell.dataset.cancelled === "1") return null;
      shell.remove();
      widget.open({ trigger, flags, source });
      return widget;
    } catch (_) {
      if (shell.dataset.cancelled !== "1") showAdvisorLoadError(shell, trigger);
      return null;
    }
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
        if (node.dataset.advisorOpening === "1") return;
        node.dataset.advisorOpening = "1";
        node.setAttribute("aria-busy", "true");
        try {
          await openAdvisorSafe(node, flags, "soft-entry");
        } finally {
          node.dataset.advisorOpening = "0";
          node.removeAttribute("aria-busy");
        }
      });
    });
  }

  function labels(lang) {
    return lang === "en"
      ? {
          ask: "Ask Lumino",
          tools: "Compliance tools",
          toolsTitle: "Choose a compliance tool",
          toolsHint: "Calculators and quick checks",
          top: "Back to top",
        }
      : {
          ask: "问 Lumino",
          tools: "合规工具",
          toolsTitle: "选择合规工具",
          toolsHint: "计算器与快速核对",
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
    // Do not expose an inert Ask control while public flags are still loading.
    root.hidden = true;
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
      if (primary.dataset.advisorOpening === "1") return;
      primary.dataset.advisorOpening = "1";
      primary.setAttribute("aria-busy", "true");
      primary.classList.add("is-loading");
      try {
        await openAdvisorSafe(primary, flags, "float-ask");
      } finally {
        primary.dataset.advisorOpening = "0";
        primary.removeAttribute("aria-busy");
        primary.classList.remove("is-loading");
      }
    };
  }

  async function mount() {
    const shell = mountShell();
    if (!shell) return;

    const flags = await loadAdvisorFlags();
    if (flags.public_beta) {
      wirePrimaryAsAdvisor(shell, flags);
      bindSoftEntries(flags);
      // Product requirement: enter the homepage with Ask already expanded.
      openAdvisorSafe(shell.primary, flags, "auto-open");
    } else {
      wirePrimaryAsTools(shell);
    }
    shell.root.hidden = false;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mount(); });
  else mount();
})();
