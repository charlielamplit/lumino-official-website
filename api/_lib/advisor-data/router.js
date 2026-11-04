/** Serverless ESM mirror of packages/advisor/router.js */
import catalog from './catalog.js';
import schema from './schema.js';
const router = ((catalog, schema) => {

  "use strict";

  if (!catalog || !schema) throw new Error("Lumino advisor dependencies are missing");

  const topicKeywords = Object.freeze({
    cbam_vs_pcf: ["cbam和pcf", "cbam 和 pcf", "cbam vs pcf", "产品碳足迹有什么区别", "difference between cbam"],
    cbam_data_start: ["进口商", "碳数据", "importer data", "communication template", "准备什么数据"],
    pcf_data_start: ["产品碳足迹", "活动数据", "pcf data", "carbon footprint data", "功能单位", "系统边界怎么采", "collecting pcf", "pcf activity data", "activity data"],
    inventory_first_year: ["组织碳盘查", "首年盘查", "第一次盘查", "year one inventory", "first year ghg", "组织温室气体"],
    eudr_csddd: ["eudr", "csddd", "零毁林", "尽职管理", "毁林", "due diligence directive"],
    esg_ghg: ["scope 1", "scope1", "scope 2", "scope2", "scope 3", "scope3", "碳盘查", "ghg inventory", "esg报告", "esg 报告"],
    renewable_power: ["绿电", "绿证", "i-rec", "irec", "renewable power", "renewable certificate"],
    cbam_scope: ["是否涉及cbam", "是否属于cbam", "cbam范围", "cbam scope", "covered by cbam", "可能涉及 cbam", "涉及 cbam"],
    service_triage: ["不确定需要", "哪项服务", "which service", "not sure which service"]
  });

  function text(value, lang) {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.zh || value.en || "";
  }

  function normalize(value) {
    return String(value || "").toLowerCase().replace(/[\s\u3000]+/g, " ").trim();
  }

  function isPublished(record, asOf) {
    if (!record || record.status !== "published" || !/^\d{4}-\d{2}-\d{2}$/.test(record.reviewedAt || "") || !record.reviewer) return false;
    const reviewedAt = Date.parse(`${record.reviewedAt}T00:00:00Z`);
    const now = asOf ? Date.parse(`${asOf}T00:00:00Z`) : Date.now();
    const ageDays = (now - reviewedAt) / 86400000;
    return Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= catalog.reviewCycleDays;
  }

  function sourceById(id, lang) {
    const item = Object.values(catalog.sources).find((candidate) => candidate.id === id);
    return item ? { title: text(item.title, lang), url: item.url } : null;
  }

  function serviceMatch(serviceId, lang, priority) {
    if (!serviceId) return null;
    const names = {
      cbam: { zh: "欧盟碳边境调节", en: "EU CBAM" },
      pcf: { zh: "产品碳足迹", en: "Product carbon footprint" },
      esg: { zh: "ESG 报告", en: "ESG reporting" },
      inventory: { zh: "碳盘查", en: "GHG inventory" },
      assets: { zh: "碳资产与绿证", en: "Carbon assets and EACs" },
      export: { zh: "出口合规", en: "Export compliance" }
    };
    const name = names[serviceId] || { zh: serviceId, en: serviceId };
    return {
      service_id: serviceId,
      reason: lang === "en" ? `The current question maps to ${name.en}.` : `当前问题主要对应${name.zh}。`,
      priority
    };
  }

  function buildFixed(record, lang) {
    const services = [serviceMatch(record.serviceId, lang, 1), serviceMatch(record.secondaryServiceId, lang, 2)].filter(Boolean);
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      topic_id: record.topicId,
      intent: record.intent,
      answer_mode: "fixed",
      answer: text(record.answer, lang),
      confidence: "high",
      service_matches: services,
      next_question: text(record.nextQuestion, lang) || null,
      suggested_replies: (record.suggestedReplies || []).map((item) => ({ id: item.id, label: text(item.label, lang) })).slice(0, 5),
      sources: (record.sourceIds || []).map((id) => sourceById(id, lang)).filter(Boolean).slice(0, 3),
      links: record.cta ? [{ type: record.cta.type, label: text(record.cta.label, lang), url: record.cta.url }] : [],
      cta: record.cta ? { type: record.cta.type, label: text(record.cta.label, lang), url: record.cta.url } : null,
      handoff: "none"
    };
    assertValid(response);
    return response;
  }

  function buildReplyOutcome(record, replyId, replyLabel, lang) {
    const response = buildFixed(record, lang);
    const allowed = (record.suggestedReplies || []).find((item) => item.id === replyId);
    if (!allowed) return response;
    const selected = replyLabel || text(allowed.label, lang);
    response.answer = lang === "en"
      ? `Recorded: ${selected}. Next, use the reading or service entry below. A formal conclusion still needs the relevant business facts and, where applicable, specialist review.`
      : `已记录：${selected}。接下来可先查看下方资料或服务入口。正式结论仍需结合相关业务事实，必要时由专业人员复核。`;
    response.next_question = null;
    response.suggested_replies = [];
    assertValid(response);
    return response;
  }

  function buildToolRoute(record, lang) {
    const links = record.links.map((item) => ({ type: item.type, label: text(item.label, lang), url: item.url }));
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      intent: record.intent,
      answer_mode: "tool_route",
      answer: text(record.answer, lang),
      confidence: "high",
      service_matches: [serviceMatch("cbam", lang, 1)],
      next_question: null,
      suggested_replies: [],
      sources: (record.sourceIds || []).map((id) => sourceById(id, lang)).filter(Boolean).slice(0, 3),
      links,
      cta: links[0] || null,
      handoff: "expert_required"
    };
    assertValid(response);
    return response;
  }

  function buildFallback(lang) {
    const response = {
      schema_version: catalog.schemaVersion,
      content_version: catalog.contentVersion,
      intent: "unresolved",
      answer_mode: "fallback",
      answer: lang === "en"
        ? "I cannot confirm that from the guidance available here yet. Choose a topic below, or use the contact page for a scoped review."
        : "目前这里的说明还不足以确认这个问题。你可以选择下方话题，或通过联系页申请有范围的人工复核。",
      confidence: "low",
      service_matches: [],
      next_question: lang === "en" ? "Which topic is closest to your question?" : "以下哪个话题最接近你的问题？",
      suggested_replies: catalog.topics.slice(0, 5).map((item) => ({ id: item.id, label: text(item.label, lang) })),
      sources: [],
      links: [{ type: "contact", label: lang === "en" ? "Contact Lumino" : "联系 Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unresolved" }],
      cta: { type: "contact", label: lang === "en" ? "Contact Lumino" : "联系 Lumino", url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unresolved" },
      handoff: "contact"
    };
    assertValid(response);
    return response;
  }

  function assertValid(response) {
    const result = schema.validateResponse(response);
    if (!result.ok) throw new Error(`Invalid advisor response: ${result.errors.join("; ")}`);
  }

  function inferTopic(inputText) {
    for (const [topicId, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some((keyword) => inputText.includes(keyword))) return topicId;
    }
    return "";
  }

  function route(input) {
    const request = input || {};
    const lang = request.lang === "en" ? "en" : "zh";
    const inputText = normalize(request.text);
    const topicId = request.topicId || inferTopic(inputText);
    const asOf = request.asOf || "";

    const toolRoute = catalog.toolRoutes.find((record) => {
      if (!isPublished(record, asOf)) return false;
      if ((record.topicIds || []).includes(topicId)) return true;
      return inputText && record.keywords.some((keyword) => inputText.includes(normalize(keyword)));
    });
    if (toolRoute) return buildToolRoute(toolRoute, lang);

    const answer = catalog.fixedAnswers.find((record) => isPublished(record, asOf) && record.topicId === topicId);
    if (answer && request.replyId) return buildReplyOutcome(answer, request.replyId, request.text, lang);
    if (answer) return buildFixed(answer, lang);
    return buildFallback(lang);
  }

  function getTopics(lang) {
    const locale = lang === "en" ? "en" : "zh";
    return catalog.topics.map((item) => ({ id: item.id, label: text(item.label, locale) }));
  }

  return Object.freeze({ route, getTopics, normalize, schemaVersion: catalog.schemaVersion, contentVersion: catalog.contentVersion });

})(catalog, schema);
export default router;
