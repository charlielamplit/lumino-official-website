(function () {
  "use strict";
  function run() {
    const i18n = window.LuminoI18n;
    const lang = i18n ? i18n.detectLang() : "zh";
    const L = lang === "en" ? "en" : "zh";
    const id = document.body.getAttribute("data-industry");
    const item = (window.LuminoIndustries || []).find((x) => x.id === id);
    const root = document.getElementById("industry-root");
    if (!item || !root) return;

    const svcMap = {
      cbam: { zh: "CBAM", en: "CBAM", href: "/apps/site/services/cbam/" },
      pcf: { zh: "产品碳足迹", en: "PCF", href: "/apps/site/services/pcf/" },
      esg: { zh: "ESG 报告", en: "ESG", href: "/apps/site/services/esg/" },
      inventory: { zh: "企业碳盘查", en: "GHG inventory", href: "/apps/site/services/ghg-inventory/" },
      assets: { zh: "碳资产与绿证", en: "Carbon assets & EACs", href: "/apps/site/services/carbon-assets/" },
      export: { zh: "出口合规", en: "Export compliance", href: "/apps/site/services/export-compliance/" },
    };

    const serviceLinks = item.services
      .map((sid) => {
        const s = svcMap[sid] || { zh: sid, en: sid, href: "/apps/site/Lumino%20联系.dc.html" };
        return `<a class="m-link" href="${s.href}">${L === "en" ? s.en : s.zh}</a>`;
      })
      .join(" · ");

    root.innerHTML = `
      <section class="m-page-hero">
        <div class="wrap">
          <p class="mono" style="color:var(--muted);font-size:var(--type-meta)">${item.en}</p>
          <h1>${L === "en" ? item.en : item.zh}</h1>
          <p>${item.challenge[L]}</p>
        </div>
      </section>
      <section class="m-section">
        <div class="wrap m-blocks">
          <article class="m-block">
            <h2>${L === "en" ? "Industry challenges" : "行业挑战"}</h2>
            <p>${item.challenge[L]}</p>
          </article>
          <article class="m-block">
            <h2>${L === "en" ? "Applicable requirements" : "适用法规 / 市场要求"}</h2>
            <p>${item.requirements[L]}</p>
          </article>
          <article class="m-block">
            <h2>${L === "en" ? "Combinable services" : "可组合服务"}</h2>
            <p>${serviceLinks}</p>
          </article>
          <article class="m-block">
            <h2>${L === "en" ? "Typical deliverables" : "交付物"}</h2>
            <p>${item.deliverables[L]}</p>
          </article>
          <article class="m-block">
            <h2>${L === "en" ? "Related insights" : "相关知识"}</h2>
            <p><a class="m-link" href="/apps/site/knowledge/?industry=${item.id}">${L === "en" ? "Browse insights →" : "查看知识库 →"}</a></p>
          </article>
          <p><a class="button button--primary" href="/apps/site/Lumino%20联系.dc.html?industry=${item.id}">${L === "en" ? "Book a consultation" : "预约咨询"}</a></p>
        </div>
      </section>`;
    if (i18n) i18n.applyDataI18n(document);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
