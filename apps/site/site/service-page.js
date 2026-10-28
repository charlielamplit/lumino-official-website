(function () {
  "use strict";
  const i18n = window.LuminoI18n || { detectLang: () => "zh", applyDataI18n: () => {} };
  const lang = () => (i18n.detectLang() === "en" ? "en" : "zh");
  const t = (obj) => (obj && typeof obj === "object" && ("zh" in obj || "en" in obj) ? obj[lang()] || obj.zh : obj);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const rootEl = document.getElementById("service-root");
  const id = document.body.dataset.service;
  const catalog = window.LuminoServicesCatalog || [];
  const svc = (window.LuminoServiceById || {})[id] || catalog.find((s) => s.id === id);

  if (!rootEl || !svc) {
    if (rootEl) rootEl.innerHTML = '<section class="m-section"><div class="wrap"><h1>服务页不存在</h1></div></section>';
    return;
  }

  const L = lang();
  const forWho = L === "en" ? "Who it’s for" : "适用对象";
  const basis = L === "en" ? "Based on" : "依据";
  const how = L === "en" ? "How it works" : "如何开展";
  const deliv = L === "en" ? "What you receive" : "你会收到";
  const sample = L === "en" ? "Sample page" : "交付物样页";
  const ctaTitle = L === "en" ? "Start with a consultation" : "从一次咨询开始";
  const ctaSub = L === "en"
    ? "Tell us your products and deadlines, and we’ll come back with scope, timing and a quote."
    : "说明产品与时间要求，我们给出范围、周期与报价。";
  const cta = L === "en" ? "Book a consultation" : "预约咨询";
  const home = "/apps/site/Lumino%20官网.dc.html";
  const contact = `/apps/site/Lumino%20联系.dc.html?serviceId=${encodeURIComponent(svc.id)}`;
  const heroTitle = L === "en" ? "Six core services—clear process, expert delivery" : "六项核心服务，流程清晰、专家交付";
  const heroLead = L === "en"
    ? "Each service has its own process, method and deliverables. Tell us the requirement—we know the path and we deliver."
    : "每项服务有独立的流程、核算方法与交付物。说明你的要求，我们知道怎么做，也负责做到。";

  const nav = catalog.map((s) => {
    const on = s.id === svc.id;
    return `<a class="svc-nav__item" href="${s.href}" ${on ? 'aria-current="page"' : ""}>
      <span class="mono">${esc(s.code)}</span>
      <span>${esc(t(s.name))}</span>
    </a>`;
  }).join("");

  const steps = (svc.steps || []).map((pair, i) => {
    const [title, detail] = pair;
    return `<div class="svc-step">
      <span class="mono">${String(i + 1).padStart(2, "0")}</span>
      <strong>${esc(t(title))}</strong>
      <span>${esc(t(detail))}</span>
    </div>`;
  }).join("");

  const delivers = (svc.deliv || []).map((d) => `<div class="svc-deliv">
      <div class="svc-deliv__shot"><span class="mono">${esc(sample)}</span></div>
      <strong>${esc(t(d))}</strong>
    </div>`).join("");

  rootEl.innerHTML = `
  <section class="m-page-hero">
    <div class="wrap">
      <p class="crumb"><a href="${home}">${L === "en" ? "Home" : "首页"}</a> / <a href="${home}#services">${L === "en" ? "Services" : "我们的服务"}</a> / ${esc(t(svc.name))}</p>
      <h1>${esc(heroTitle)}</h1>
      <p>${esc(heroLead)}</p>
    </div>
  </section>
  <section class="m-section">
    <div class="wrap svc-layout">
      <nav class="svc-nav" aria-label="${L === "en" ? "Services" : "服务列表"}">${nav}</nav>
      <article class="svc-detail">
        <header class="svc-detail__head">
          <span class="mono">${esc(svc.code)}</span>
          <h2>${esc(t(svc.name))}</h2>
          <p>${esc(t(svc.desc))}</p>
        </header>
        <div class="svc-meta">
          <div><span>${esc(forWho)}</span><strong>${esc(t(svc.who))}</strong></div>
          <div><span>${esc(basis)}</span><strong class="mono">${esc(t(svc.basis))}</strong></div>
        </div>
        <div class="svc-block">
          <h3>${esc(how)}</h3>
          <div class="svc-steps">${steps}</div>
        </div>
        <div class="svc-block">
          <h3>${esc(deliv)}</h3>
          <div class="svc-delivs">${delivers}</div>
        </div>
        <div class="svc-cta">
          <div><strong>${esc(ctaTitle)}</strong><span>${esc(ctaSub)}</span></div>
          <a class="button button--primary" href="${contact}">${esc(cta)}</a>
        </div>
        <p class="svc-more-note svc-more-inline">${L === "en"
          ? "Supply-chain surveys, customer templates, disclosure portals and similar asks—we deliver those on the same data foundation."
          : "供应链问卷、客户指定模板、披露平台对接等要求，我们在同一数据底座上一并交付。"}</p>
      </article>
    </div>
  </section>`;
  if (window.LuminoEnhanceChrome) window.LuminoEnhanceChrome(rootEl);
})();
