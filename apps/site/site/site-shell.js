(function () {
  "use strict";
  const i18n = window.LuminoI18n || {
    detectLang: () => "zh",
    setLang: () => {},
    applyDataI18n: () => {},
  };

  const navDef = [
    { id: "services", href: "/apps/site/Lumino%20官网.dc.html#services", zh: "我们的服务", en: "Services" },
    { id: "platform", href: "/apps/site/Lumino%20平台.dc.html", zh: "我们的平台", en: "Platform" },
    { id: "industries", href: "/apps/site/industries/", zh: "解决方案", en: "Industries" },
    { id: "tools", href: "/apps/site/tools/", zh: "工具", en: "Tools" },
    { id: "knowledge", href: "/apps/site/knowledge/", zh: "行业知识库", en: "Insights" },
    { id: "about", href: "/apps/site/Lumino%20关于.dc.html", zh: "关于我们", en: "About" },
    { id: "contact", href: "/apps/site/Lumino%20联系.dc.html", zh: "联系我们", en: "Contact" },
  ];

  function lang() { return i18n.detectLang(); }
  function label(item) { return lang() === "en" ? item.en : item.zh; }
  function withLang(href) {
    if (!href || href.startsWith("#")) return href;
    try {
      const url = new URL(href, location.origin);
      url.searchParams.set("lang", lang());
      return url.pathname + url.search + url.hash;
    } catch (_) { return href; }
  }
  function navLinks(current) {
    return navDef.map((item) => {
      const on = item.id === current || (current === "cases" && item.id === "industries");
      return `<a href="${withLang(item.href)}" ${on ? 'aria-current="page"' : ""}>${label(item)}</a>`;
    }).join("");
  }

  class LuminoHeader extends HTMLElement {
    connectedCallback() {
      const current = this.getAttribute("current") || "";
      const links = navLinks(current);
      const L = lang();
      const consult = L === "en" ? "Book a consultation" : "预约咨询";
      const portal = L === "en" ? "Client portal" : "客户门户";
      const menu = L === "en" ? "Menu" : "菜单";
      this.innerHTML = `<a class="skip" href="#main" style="position:absolute;left:-9999px">${L === "en" ? "Skip to content" : "跳到主要内容"}</a>
        <header class="site-header">
          <div class="site-header__row">
            <a class="brand-lockup" href="${withLang("/apps/site/Lumino%20官网.dc.html")}" aria-label="Lumino">
              <span class="logo">LUMINO</span>
            </a>
            <nav class="site-nav" aria-label="${L === "en" ? "Primary" : "主导航"}">${links}</nav>
            <div class="header-actions">
              <div class="lang-switch" aria-label="Language">
                <a href="#" data-lang="zh" aria-current="${L === "zh"}">中</a>
                <a href="#" data-lang="en" aria-current="${L === "en"}">EN</a>
              </div>
              <a class="portal-entry" href="/apps/portal/"><span>${portal}</span><b aria-hidden="true">↗</b></a>
              <a class="header-cta" href="${withLang("/apps/site/Lumino%20联系.dc.html")}">${consult}</a>
              <button class="menu-button" type="button" aria-label="${menu}" aria-expanded="false" aria-controls="site-mobile-nav">
                <span class="menu-button__icon" aria-hidden="true"><i></i><i></i><i></i></span>
              </button>
            </div>
          </div>
          <div class="mobile-nav-shell" data-open="false">
            <nav id="site-mobile-nav" class="mobile-nav" aria-label="Mobile">${links}<a href="/apps/portal/">${portal} ↗</a><a href="${withLang("/apps/site/Lumino%20联系.dc.html")}">${consult}</a></nav>
          </div>
        </header>`;

      this.querySelectorAll("[data-lang]").forEach((el) => {
        el.addEventListener("click", (event) => {
          event.preventDefault();
          i18n.setLang(el.getAttribute("data-lang"));
        });
      });
      const button = this.querySelector(".menu-button");
      const shell = this.querySelector(".mobile-nav-shell");
      const close = () => { button.setAttribute("aria-expanded", "false"); shell.dataset.open = "false"; };
      button.addEventListener("click", () => {
        const open = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", String(open));
        shell.dataset.open = String(open);
      });
      shell.addEventListener("click", (event) => { if (event.target.closest("a")) close(); });
      document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
    }
  }

  class LuminoFooter extends HTMLElement {
    connectedCallback() {
      const L = lang();
      const svcLinks = [
        { zh: "欧盟碳边境调节", en: "EU CBAM", href: "/apps/site/services/cbam/" },
        { zh: "产品碳足迹", en: "Product carbon footprint", href: "/apps/site/services/pcf/" },
        { zh: "ESG 报告", en: "ESG reporting", href: "/apps/site/services/esg/" },
        { zh: "碳盘查", en: "GHG inventory", href: "/apps/site/services/ghg-inventory/" },
        { zh: "碳资产与绿证", en: "Carbon assets & EACs", href: "/apps/site/services/carbon-assets/" },
        { zh: "出口合规服务", en: "Export compliance", href: "/apps/site/services/export-compliance/" },
      ];
      const resource = [
        { zh: "我们的平台", en: "Platform", href: "/apps/site/Lumino%20平台.dc.html" },
        { zh: "解决方案", en: "Industries", href: "/apps/site/industries/" },
        { zh: "项目案例", en: "Project cases", href: "/apps/site/cases/" },
        { zh: "工具", en: "Tools", href: "/apps/site/tools/" },
        { zh: "行业知识库", en: "Insights", href: "/apps/site/knowledge/" },
      ];
      const company = [
        { zh: "关于我们", en: "About", href: "/apps/site/Lumino%20关于.dc.html" },
        { zh: "联系我们", en: "Contact", href: "/apps/site/Lumino%20联系.dc.html" },
        { zh: "隐私与数据处理", en: "Privacy & data", href: "/apps/site/Lumino%20隐私与数据处理.dc.html" },
        { zh: "客户门户 ↗", en: "Client portal ↗", href: "/apps/portal/" },
      ];
      const col = (titleZh, titleEn, items) =>
        `<div class="footer-col"><strong>${L === "en" ? titleEn : titleZh}</strong>${items.map((i) => `<a href="${withLang(i.href)}">${L === "en" ? i.en : i.zh}</a>`).join("")}</div>`;

      this.innerHTML = `<footer class="site-footer"><div class="site-footer__inner">
        <div class="footer-brand">
          <a class="logo" href="${withLang("/apps/site/Lumino%20官网.dc.html")}">LUMINO</a>
          <p data-i18n-zh="出口与制造企业的碳与 ESG 合规服务" data-i18n-en="Carbon and ESG compliance for exporters and manufacturers"></p>
        </div>
        <nav class="footer-links" aria-label="${L === "en" ? "Footer" : "页脚导航"}">
          ${col("服务", "Services", svcLinks)}
          ${col("资源", "Resources", resource)}
          ${col("公司", "Company", company)}
        </nav>
        <div class="copyright">
          <span>© 2026 Lumino</span>
        </div>
      </div></footer>`;
      i18n.applyDataI18n(this);
    }
  }

  customElements.define("lumino-header", LuminoHeader);
  customElements.define("lumino-footer", LuminoFooter);

  let revealIo = null;
  function enhanceChrome(root) {
    const scope = root || document;
    const header = document.querySelector(".site-header");
    const headerHost = document.querySelector("lumino-header");
    if (header && !header.dataset.scrollBound) {
      header.dataset.scrollBound = "1";
      const onScroll = () => {
        const on = window.scrollY > 8;
        header.classList.toggle("is-scrolled", on);
        if (headerHost) headerHost.classList.toggle("is-scrolled", on);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }
    const selector = [
      ".m-section__head", ".m-service-tile", ".m-ind-cell", ".m-card",
      ".m-dual > *", ".m-platform > *", ".ind-hero-block", ".ind-bg",
      ".ind-helps-wrap", ".ind-helps", ".ind-chain-wrap", ".ind-chain",
      ".ind-layout", ".ind-help", ".ind-pkg",
      ".ind-band", ".ind-help-card", ".ind-pkg-card", ".ind-intro__copy", ".ind-intro__media",
      ".ind-steps", ".ind-req-block", ".ind-prep",
      ".pf-map", ".pf-shots", ".pf-diagram",
      ".about-team", ".about-mission", ".about-principles",
      ".tools-layout", ".contact-layout", ".svc-layout", ".svc-detail > *",
      ".ins-grid", ".ins-card", ".case-stack > *", ".case-row"
    ].join(", ");
    const targets = [...scope.querySelectorAll(selector)].filter((el) => !el.closest(".m-hero"));
    /* Dynamic subtrees (e.g. industries detail) must not stay opacity:0 if IO misses. */
    const dynamic = !!(root && root !== document);
    targets.forEach((el, i) => {
      if (el.classList.contains("m-reveal") && el.classList.contains("is-in")) return;
      el.classList.add("m-reveal");
      el.style.setProperty("--d", `${Math.min(i % 6, 5) * 60}ms`);
      if (dynamic) el.classList.add("is-in");
    });
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("is-in"));
      return;
    }
    if (dynamic) return;
    if (!revealIo) {
      revealIo = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            revealIo.unobserve(e.target);
          }
        });
      }, { rootMargin: "0px 0px -6% 0px", threshold: 0.08 });
    }
    targets.forEach((el) => {
      if (!el.classList.contains("is-in")) revealIo.observe(el);
    });
  }
  window.LuminoEnhanceChrome = enhanceChrome;

  function scrollPageToTop() {
    const el = document.scrollingElement || document.documentElement;
    el.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  /** Full page navigations start at top; keep in-page #anchors working. */
  function preferTopOnNavigation() {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    if (!location.hash) scrollPageToTop();
  }

  preferTopOnNavigation();
  window.addEventListener("pageshow", (event) => {
    if (!location.hash) scrollPageToTop();
    // bfcache restores often keep old scroll; force top after restore
    if (event.persisted && !location.hash) {
      requestAnimationFrame(scrollPageToTop);
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    if (!location.hash) scrollPageToTop();
    i18n.applyDataI18n(document);
    enhanceChrome();
  });
})();
