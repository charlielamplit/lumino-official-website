(function (root) {
  "use strict";
  const L = (zh, en) => ({ zh, en });
  const cases = Object.freeze([
    {
      id: "steel-cbam",
      ind: L("钢铁 · 华东", "Steel · East China"),
      svcs: ["CBAM"],
      shot: L("项目图片：热轧产线", "Project photo: rolling mill"),
      title: L("热轧出口企业在 [X] 周内交出首份进口商季度数据包", "A hot-rolled exporter delivers its first importer quarterly pack in [X] weeks"),
      summary: L("进口商临时要求设施级数据；厂内电、气按车间汇总，前体焦炭声明不齐。", "Importer asked for installation-level data at short notice; power and gas were shop totals, and coke statements were incomplete."),
      rows: [
        [L("挑战", "Challenge"), L("计量点对不上产品，CN 编码与产线配置未锁定，默认值与实际值不知如何取舍。", "Meters did not map to products; CN codes and line configs were unlocked; actual vs default was unclear.")],
        [L("我们做了什么", "What we did"), L("先冻结产品—产线—编码关系，补前体缺口表，按月重切能源台账，再并排跑实际值与默认值供进口商选择。", "Froze product–line–code links, filled a precursor gap table, re-cut energy ledgers by month, then ran actual vs default side by side.")],
        [L("交付物", "Deliverables"), L("进口商数据包、设施排放说明、下一季度可复用的填报模板。", "Importer pack, installation emissions note, and a reusable template for the next quarter.")],
      ],
      kpis: [["[X]", L("CN 编码", "CN codes")], ["[X]%", L("实测数据占比", "Measured share")], ["[X] 周", L("交付周期", "Timeline")]],
    },
    {
      id: "textile-pcf",
      ind: L("纺织服装 · 华南", "Textiles · South China"),
      svcs: ["PCF"],
      shot: L("项目图片：面料车间", "Project photo: fabric mill"),
      title: L("面料商按品牌模板完成 [X] 款 ISO 14067 碳足迹", "A fabric mill completes [X] ISO 14067 footprints on the brand’s template"),
      summary: L("品牌要求摇篮到大门结果并标热点；染化料与蒸汽数据在三家染厂。", "Brand required cradle-to-gate results with hotspots; dyestuff and steam data sat across three dye houses."),
      rows: [
        [L("挑战", "Challenge"), L("功能单位与截断规则未写死，外发染厂不愿按同一模板回传。", "Functional unit and cut-offs were not locked; subcontract dye houses resisted one template.")],
        [L("我们做了什么", "What we did"), L("与品牌确认边界后，按款号发放采集表，统一蒸汽分摊，标出染整热点给采购谈判用。", "After locking the boundary with the brand, issued per-style sheets, aligned steam allocation, and marked dyeing hotspots for sourcing talks.")],
        [L("交付物", "Deliverables"), L("碳足迹报告、热点排序、可给下季复用的边界版本。", "Footprint reports, hotspot ranking, and a boundary version reusable next season.")],
      ],
      kpis: [["[X]", L("款号", "Styles")], ["[X]", L("上游染厂", "Dye houses")], ["[X] 周", L("交付周期", "Timeline")]],
    },
    {
      id: "pack-ghg-esg",
      ind: L("包装 · 华北", "Packaging · North China"),
      svcs: ["GHG", "ESG"],
      shot: L("项目图片：包装工厂", "Project photo: packaging plant"),
      title: L("多材料包装集团第一次把三厂区盘查与 ESG 指标对齐", "A multi-material packaging group aligns three sites’ inventory with ESG metrics for the first time"),
      summary: L("纸、塑产线口径不一；客户同时要范围一、二与可持续采购指标。", "Paper and plastics lines used different definitions; customers wanted Scope 1–2 and sustainable-sourcing metrics together."),
      rows: [
        [L("挑战", "Challenge"), L("集团无法回答「哪个厂、哪种材料」对应的排放，ESG 证据散落在邮箱。", "The group could not answer which plant or material drove emissions; ESG evidence lived in inboxes.")],
        [L("我们做了什么", "What we did"), L("统一厂区边界与燃料分类，建材料结构碳数据卡，并把证书、许可挂进证据索引。", "Aligned site boundaries and fuel classes, built material-structure carbon cards, and indexed certificates and permits.")],
        [L("交付物", "Deliverables"), L("盘查报告、ESG 指标表、证据目录。", "Inventory report, ESG metrics table, evidence index.")],
      ],
      kpis: [["[X]", L("厂区", "Sites")], ["[X]", L("披露指标", "Metrics")], ["[X] 周", L("交付周期", "Timeline")]],
    },
  ]);

  function renderCaseRow(item, lang) {
    const Lng = lang === "en" ? "en" : "zh";
    const tt = (o) => (o && o.zh !== undefined ? o[Lng] || o.zh : o);
    const chips = item.svcs.map((s) => `<span class="status-chip">${s}</span>`).join("");
    const rows = item.rows.map(([k, v]) => `<div class="case-fact"><dt>${tt(k)}</dt><dd>${tt(v)}</dd></div>`).join("");
    const kpis = item.kpis.map(([v, k]) => `<div><strong>${v}</strong><span>${tt(k)}</span></div>`).join("");
    return `<article class="case-row">
      <div class="case-row__media"><span class="m-shot-label">${tt(item.shot)}</span></div>
      <div class="case-row__body">
        <div class="m-card__meta"><span>${tt(item.ind)}</span>${chips}</div>
        <h2>${tt(item.title)}</h2>
        <p style="color:var(--ink-secondary);font-size:var(--type-ui);line-height:var(--type-ui-lh)">${tt(item.summary)}</p>
        ${rows}
        <div class="case-kpis">${kpis}</div>
      </div>
    </article>`;
  }

  root.LuminoCases = cases;
  root.LuminoRenderCaseRow = renderCaseRow;
})(typeof window !== "undefined" ? window : globalThis);
