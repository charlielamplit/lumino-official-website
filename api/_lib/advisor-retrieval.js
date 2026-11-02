import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const CATALOG_PATH = path.join(ROOT, "apps/site/knowledge/catalog.json");
const REVIEW_CYCLE_DAYS = 180;
const CONTACT_URL = "/apps/site/Lumino%20联系.dc.html";

let cache = null;

function pick(value, lang) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.zh || value.en || "";
}

function tokenize(text) {
  const normalized = String(text || "").toLowerCase();
  const tokens = new Set();
  for (const part of normalized
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, " ")
    .split(/[\s/+.-]+/)) {
    if (part.length >= 2) tokens.add(part);
  }
  // Character n-grams for continuous CJK so Chinese queries match without spaces.
  const hans = normalized.match(/\p{Script=Han}+/gu) || [];
  for (const run of hans) {
    for (let i = 0; i < run.length; i += 1) {
      if (i + 2 <= run.length) tokens.add(run.slice(i, i + 2));
      if (i + 3 <= run.length) tokens.add(run.slice(i, i + 3));
    }
  }
  return [...tokens];
}

function isFresh(article, asOf) {
  if (!article || article.status !== "published") return false;
  const stamp = article.updatedAt || article.reviewedAt;
  if (!stamp || !/^\d{4}-\d{2}-\d{2}/.test(String(stamp))) return true;
  const reviewedAt = Date.parse(`${String(stamp).slice(0, 10)}T00:00:00Z`);
  const now = asOf ? Date.parse(`${asOf}T00:00:00Z`) : Date.now();
  const ageDays = (now - reviewedAt) / 86400000;
  return Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= REVIEW_CYCLE_DAYS;
}

function readMarkdown(article, lang) {
  const rel = article.paths?.[lang] || article.paths?.zh;
  if (!rel) return "";
  const abs = path.join(ROOT, rel.replace(/^\//, ""));
  try {
    return fs.readFileSync(abs, "utf8");
  } catch (_) {
    return "";
  }
}

function loadCorpus() {
  if (cache) return cache;
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const docs = [];
  for (const article of catalog.articles || []) {
    if (article.status !== "published") continue;
    for (const lang of ["zh", "en"]) {
      const title = pick(article.title, lang);
      const lead = pick(article.lead, lang);
      const markdown = readMarkdown(article, lang);
      const excerpt = markdown
        .replace(/^#.+$/gm, "")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200);
      docs.push({
        id: `${article.id}:${lang}`,
        articleId: article.id,
        lang,
        status: article.status,
        updatedAt: article.updatedAt,
        serviceId: article.serviceId || null,
        title,
        lead,
        excerpt,
        url: `/knowledge/article?id=${encodeURIComponent(article.id)}`,
        tokens: new Set(tokenize(`${title} ${lead} ${excerpt}`)),
      });
    }
  }
  cache = docs;
  return docs;
}

export function clearRetrievalCache() {
  cache = null;
}

export function retrievePublishedKnowledge({ text = "", lang = "zh", asOf = "", limit = 3 } = {}) {
  const queryTokens = tokenize(text);
  if (!queryTokens.length) return [];
  const locale = lang === "en" ? "en" : "zh";
  const scored = [];
  for (const doc of loadCorpus()) {
    if (doc.lang !== locale) continue;
    if (!isFresh({ status: doc.status, updatedAt: doc.updatedAt }, asOf)) continue;
    let score = 0;
    for (const token of queryTokens) {
      if (doc.tokens.has(token)) score += 2;
      if (doc.title.toLowerCase().includes(token)) score += 3;
      if (doc.lead.toLowerCase().includes(token)) score += 1;
    }
    if (score <= 0) continue;
    scored.push({
      score,
      id: doc.articleId,
      title: doc.title,
      lead: doc.lead,
      excerpt: doc.excerpt.slice(0, 420),
      url: doc.url,
      serviceId: doc.serviceId,
    });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}

export function buildGroundedFallback(hits, lang) {
  if (!hits.length) return null;
  const top = hits[0];
  const more = hits.slice(1, 3);
  const answer = lang === "en"
    ? `Based on published Lumino guidance, start with “${top.title}”. ${top.lead} This is orientation only — not a formal compliance conclusion.`
    : `根据已发布的 Lumino 说明，建议先看「${top.title}」。${top.lead} 以上仅为导向说明，不构成正式合规结论。`;
  const services = [];
  if (top.serviceId) {
    services.push({
      service_id: top.serviceId,
      reason: lang === "en" ? "Matched from published knowledge." : "来自已发布知识的匹配结果。",
      priority: 1,
    });
  }
  const secondary = more.find((item) => item.serviceId && item.serviceId !== top.serviceId);
  if (secondary?.serviceId) {
    services.push({
      service_id: secondary.serviceId,
      reason: lang === "en" ? "Related published topic." : "相关已发布主题。",
      priority: 2,
    });
  }
  return {
    intent: "knowledge_retrieval",
    answer_mode: "retrieval_model",
    answer,
    confidence: "medium",
    service_matches: services.slice(0, 2),
    next_question: lang === "en"
      ? "Do you want the service page, or a contact review?"
      : "需要打开服务页，还是通过联系页申请复核？",
    suggested_replies: lang === "en"
      ? [
          { id: "open-article", label: "Open the article" },
          { id: "contact", label: "Contact Lumino" },
        ]
      : [
          { id: "open-article", label: "打开相关文章" },
          { id: "contact", label: "联系 Lumino" },
        ],
    sources: hits.slice(0, 3).map((item) => ({ title: item.title, url: item.url })),
    links: [
      { type: "knowledge", label: lang === "en" ? "Open related article" : "打开相关文章", url: top.url },
      {
        type: "contact",
        label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
        url: `${CONTACT_URL}?source=homepage-advisor&topic=retrieval`,
      },
    ].slice(0, 3),
    cta: { type: "knowledge", label: lang === "en" ? "Open related article" : "打开相关文章", url: top.url },
    handoff: "none",
  };
}

export function stopWithoutSources(lang) {
  return {
    intent: "unresolved",
    answer_mode: "fallback",
    answer: lang === "en"
      ? "I cannot confirm that from published Lumino guidance yet. Choose a topic below, or use the contact page for a scoped review."
      : "目前还无法从已发布说明中确认这个问题。你可以选择下方话题，或通过联系页申请有范围的人工复核。",
    confidence: "low",
    service_matches: [],
    next_question: lang === "en" ? "Which topic is closest to your question?" : "哪个话题最接近你的问题？",
    suggested_replies: [],
    sources: [],
    links: [{
      type: "contact",
      label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
      url: `${CONTACT_URL}?source=homepage-advisor&topic=unresolved`,
    }],
    cta: {
      type: "contact",
      label: lang === "en" ? "Contact Lumino" : "联系 Lumino",
      url: `${CONTACT_URL}?source=homepage-advisor&topic=unresolved`,
    },
    handoff: "contact",
  };
}
