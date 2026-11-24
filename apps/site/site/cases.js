(function (root) {
  "use strict";
  const L = (zh, en) => ({ zh, en });
  const cases = Object.freeze([
    {
      id: "steel-cbam",
      ind: L("钢铁出口场景", "Steel export scenario"),
      svcs: ["CBAM"],
      shot: L("示意图片：热轧产线", "Illustrative image: rolling mill"),
      img: "/apps/site/site/assets/cases/steel-mill.png",
      imgAlt: L("热轧产线工业场景", "Hot-rolling mill industrial scene"),
      title: L("钢铁出口企业如何准备 CBAM 数据", "How a steel exporter can prepare CBAM data"),
      summary: L("假设进口商要求设施级数据，而能源台账只按车间汇总、前体声明尚不完整。", "Suppose an importer needs installation-level data, while energy records are aggregated by workshop and precursor statements are incomplete."),
      rows: [
        [L("挑战", "Challenge"), L("计量点对不上产品，CN 编码与产线配置未锁定，默认值与实际值不知如何取舍。", "Meters did not map to products; CN codes and line configs were unlocked; actual vs default was unclear.")],
        [L("可提供的服务", "Possible service"), L("核对产品、产线和编码，列出前体数据缺口，整理能源台账并比较适用的核算口径。", "Check product, line and code mapping, identify precursor data gaps, organize energy records and compare applicable calculation approaches.")],
        [L("可交付材料", "Possible deliverables"), L("进口商所需数据包、设施排放说明和可复用的数据采集模板；具体内容依项目确定。", "An importer data pack, installation emissions note and reusable collection template, scoped to the project.")],
      ],
    },
    {
      id: "textile-pcf",
      ind: L("纺织服装场景", "Textiles scenario"),
      svcs: ["PCF"],
      shot: L("示意图片：面料车间", "Illustrative image: fabric mill"),
      img: "/apps/site/site/assets/cases/textile-mill.png",
      imgAlt: L("纺织染整车间场景", "Textile dyeing and finishing workshop"),
      title: L("面料供应商如何准备产品碳足迹", "How a fabric supplier can prepare product footprints"),
      summary: L("假设品牌要求摇篮到大门结果与热点分析，而染化料、蒸汽数据分散在多家染厂。", "Suppose a brand needs cradle-to-gate results and hotspots, while dye and steam data sit with several dye houses."),
      rows: [
        [L("挑战", "Challenge"), L("功能单位与截断规则未写死，外发染厂不愿按同一模板回传。", "Functional unit and cut-offs were not locked; subcontract dye houses resisted one template.")],
        [L("可提供的服务", "Possible service"), L("与客户确认核算边界，按款号采集数据，统一蒸汽分摊并识别染整热点。", "Confirm the boundary, collect data by style, align steam allocation and identify dyeing hotspots.")],
        [L("可交付材料", "Possible deliverables"), L("产品碳足迹报告、热点分析与可复用的数据采集表；具体内容依项目确定。", "Product footprint reports, hotspot analysis and reusable collection sheets, scoped to the project.")],
      ],
    },
    {
      id: "pack-ghg-esg",
      ind: L("包装制造场景", "Packaging scenario"),
      svcs: ["GHG", "ESG"],
      shot: L("示意图片：包装工厂", "Illustrative image: packaging plant"),
      img: "/apps/site/site/assets/cases/packaging-plant.png",
      imgAlt: L("包装产线场景", "Packaging production line"),
      title: L("多厂区包装企业如何衔接盘查与 ESG", "How a multi-site packaging company can link GHG and ESG"),
      summary: L("假设纸、塑产线统计口径不同，客户同时要求范围一、二与可持续采购指标。", "Suppose paper and plastics lines use different definitions, while customers ask for Scope 1–2 and sustainable-sourcing metrics."),
      rows: [
        [L("挑战", "Challenge"), L("集团无法回答「哪个厂、哪种材料」对应的排放，ESG 证据散落在邮箱。", "The group could not answer which plant or material drove emissions; ESG evidence lived in inboxes.")],
        [L("可提供的服务", "Possible service"), L("统一厂区边界和燃料分类，整理材料碳数据，并建立证书、许可等证据索引。", "Align site boundaries and fuel classes, organize material carbon data and index certificates and permits.")],
        [L("可交付材料", "Possible deliverables"), L("温室气体盘查报告、ESG 指标表和证据目录；具体内容依项目确定。", "A GHG inventory report, ESG metrics sheet and evidence index, scoped to the project.")],
      ],
    },
  ]);

  function renderCaseRow(item, lang) {
    const Lng = lang === "en" ? "en" : "zh";
    const tt = (o) => (o && o.zh !== undefined ? o[Lng] || o.zh : o);
    const chips = item.svcs.map((s) => `<span class="status-chip">${s}</span>`).join("");
    const rows = item.rows.map(([k, v]) => `<div class="case-fact"><dt>${tt(k)}</dt><dd>${tt(v)}</dd></div>`).join("");
    const alt = tt(item.imgAlt || item.shot);
    const webp = item.img && item.img.endsWith(".png") ? item.img.replace(/\.png$/, ".webp") : "";
    const media = item.img
      ? `<picture>${webp ? `<source type="image/webp" srcset="${webp}">` : ""}<img src="${item.img}" alt="${alt}" width="1200" height="900" loading="lazy" decoding="async"></picture>`
      : `<span class="m-shot-label">${tt(item.shot)}</span>`;
    return `<article class="case-row">
      <div class="case-row__media">${media}</div>
      <div class="case-row__body">
        <div class="m-card__meta"><span>${tt(item.ind)}</span>${chips}</div>
        <h2>${tt(item.title)}</h2>
        <p style="color:var(--ink-secondary);font-size:var(--type-ui);line-height:var(--type-ui-lh)">${tt(item.summary)}</p>
        ${rows}
      </div>
    </article>`;
  }

  root.LuminoCases = cases;
  root.LuminoRenderCaseRow = renderCaseRow;
})(typeof window !== "undefined" ? window : globalThis);
