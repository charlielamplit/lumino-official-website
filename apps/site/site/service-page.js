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
  const labels = {
    forWho: L === "en" ? "Who it’s for" : "适用对象",
    basis: L === "en" ? "Based on" : "依据",
    scenarios: t(svc.scenariosTitle) || (L === "en" ? "Where this shows up" : "适用场景"),
    how: L === "en" ? "How we deliver" : "服务流程",
    prepare: L === "en" ? "What to prepare" : "建议优先准备",
    standards: L === "en" ? "Standards & references" : "依据的标准与参考",
    deliv: L === "en" ? "What you receive" : "你会收到",
    boundaries: L === "en" ? "Scope notes" : "范围说明",
    consult: L === "en" ? "What to tell us in a consultation" : "咨询时请说明",
    sample: L === "en" ? "Deliverable" : "交付物",
    ctaTitle: L === "en" ? "Start with a consultation" : "从一次咨询开始",
    ctaSub: L === "en"
      ? "Share products and deadlines—we’ll come back with scope, timing and a quote."
      : "说明产品与时间要求，我们给出范围、周期与报价。",
    cta: L === "en" ? "Book a consultation" : "预约咨询",
  };

  const home = "/apps/site/Lumino%20官网.dc.html";
  const contact = `/apps/site/Lumino%20联系.dc.html?serviceId=${encodeURIComponent(svc.id)}`;
  document.title = `${t(svc.name)} · Lumino`;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", t(svc.desc));

  const nav = catalog.map((s) => {
    const on = s.id === svc.id;
    return `<a class="svc-nav__item" href="${s.href}" ${on ? 'aria-current="page"' : ""}>
      <span class="mono">${esc(s.code)}</span>
      <span>${esc(t(s.name))}</span>
    </a>`;
  }).join("");

  const scenarios = (svc.scenarios || []).map((pair, i) => {
    const [title, detail] = pair;
    return `<article class="svc-scenario">
      <span class="mono">${String(i + 1).padStart(2, "0")}</span>
      <strong>${esc(t(title))}</strong>
      <p>${esc(t(detail))}</p>
    </article>`;
  }).join("");

  const steps = (svc.steps || []).map((pair, i) => {
    const [title, detail] = pair;
    return `<div class="svc-step">
      <span class="mono">${String(i + 1).padStart(2, "0")}</span>
      <strong>${esc(t(title))}</strong>
      <span>${esc(t(detail))}</span>
    </div>`;
  }).join("");

  const prepare = (svc.prepare || []).map((item) =>
    `<li><span class="svc-check" aria-hidden="true"></span><span>${esc(t(item))}</span></li>`
  ).join("");

  const standards = (svc.standards || []).map((s) =>
    `<span class="svc-standard">${esc(typeof s === "string" ? s : t(s))}</span>`
  ).join("");

  const delivers = (svc.deliv || []).map((d) => `<div class="svc-deliv">
      <div class="svc-deliv__shot"><span class="mono">${esc(labels.sample)}</span></div>
      <strong>${esc(t(d))}</strong>
    </div>`).join("");

  const boundaries = (svc.boundaries || []).map((b) => `<li>${esc(t(b))}</li>`).join("");
  const consultAsk = (svc.consultAsk || []).map((b) => `<li>${esc(t(b))}</li>`).join("");

  rootEl.innerHTML = `
  <section class="m-page-hero">
    <div class="wrap">
      <p class="crumb"><a href="${home}">${L === "en" ? "Home" : "首页"}</a> / <a href="${home}#services">${L === "en" ? "Services" : "我们的服务"}</a> / ${esc(t(svc.name))}</p>
      <h1>${esc(t(svc.name))}</h1>
      <p>${esc(t(svc.desc))}</p>
    </div>
  </section>
  <section class="m-section">
    <div class="wrap svc-layout">
      <nav class="svc-nav" aria-label="${L === "en" ? "Services" : "服务列表"}">${nav}</nav>
      <article class="svc-detail">
        <div class="svc-meta">
          <div><span>${esc(labels.forWho)}</span><strong>${esc(t(svc.who))}</strong></div>
          <div><span>${esc(labels.basis)}</span><strong class="mono">${esc(t(svc.basis))}</strong></div>
        </div>

        ${scenarios ? `<div class="svc-block">
          <h2>${esc(labels.scenarios)}</h2>
          <div class="svc-scenario-grid">${scenarios}</div>
        </div>` : ""}

        <div class="svc-block">
          <h2>${esc(labels.how)}</h2>
          <div class="svc-steps">${steps}</div>
        </div>

        ${prepare ? `<div class="svc-block">
          <h2>${esc(labels.prepare)}</h2>
          <ul class="svc-prepare">${prepare}</ul>
        </div>` : ""}

        ${standards ? `<div class="svc-block">
          <h2>${esc(labels.standards)}</h2>
          <div class="svc-standards">${standards}</div>
        </div>` : ""}

        <div class="svc-block">
          <h2>${esc(labels.deliv)}</h2>
          <div class="svc-delivs">${delivers}</div>
        </div>

        ${boundaries ? `<div class="svc-block">
          <h2>${esc(labels.boundaries)}</h2>
          <ul class="svc-boundary">${boundaries}</ul>
        </div>` : ""}

        ${consultAsk ? `<div class="svc-block svc-block--consult">
          <h2>${esc(labels.consult)}</h2>
          <ul class="svc-boundary">${consultAsk}</ul>
        </div>` : ""}

        <div class="svc-cta">
          <div><strong>${esc(labels.ctaTitle)}</strong><span>${esc(labels.ctaSub)}</span></div>
          <a class="button button--primary" href="${contact}">${esc(labels.cta)}</a>
        </div>
        <p class="svc-more-note svc-more-inline">${L === "en"
          ? "Supply-chain surveys, customer templates and disclosure portals—we deliver those on the same data foundation."
          : "供应链问卷、客户指定模板、披露平台对接等要求，我们在同一数据底座上一并交付。"}</p>
      </article>
    </div>
  </section>`;
  if (window.LuminoEnhanceChrome) window.LuminoEnhanceChrome(rootEl);
})();
