import fs from "node:fs";
import path from "node:path";

// Avoid import.meta.url — Vercel may compile these helpers as CJS.
const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, "apps/site/knowledge/catalog.json");
const DATA_OVERRIDE = path.join(ROOT, "data/knowledge-catalog.json");
const TMP_OVERRIDE = "/tmp/lumino-knowledge-catalog.json";
const STATUS = new Set(["draft", "published", "archived"]);

function memoryBucket() {
  if (!globalThis.__luminoKnowledgeStore) {
    globalThis.__luminoKnowledgeStore = { catalog: null };
  }
  return globalThis.__luminoKnowledgeStore;
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error("[lumino-knowledge] read failed", filePath, error);
    return null;
  }
}

function loadCatalog() {
  const bucket = memoryBucket();
  if (bucket.catalog) return bucket.catalog;
  const override = readJson(DATA_OVERRIDE) || readJson(TMP_OVERRIDE);
  const base = readJson(CATALOG_PATH) || { updatedAt: new Date().toISOString(), articles: [] };
  if (override?.articles) {
    const byId = new Map(base.articles.map((a) => [a.id, a]));
    for (const article of override.articles) {
      const prev = byId.get(article.id) || {};
      byId.set(article.id, { ...prev, ...article });
    }
    bucket.catalog = { updatedAt: override.updatedAt || base.updatedAt, articles: [...byId.values()] };
  } else {
    bucket.catalog = base;
  }
  return bucket.catalog;
}

function writeOverride(catalog) {
  const payload = JSON.stringify(catalog, null, 2);
  let wrote = false;
  try {
    fs.mkdirSync(path.dirname(DATA_OVERRIDE), { recursive: true });
    fs.writeFileSync(DATA_OVERRIDE, payload, "utf8");
    wrote = true;
  } catch (error) {
    console.error("[lumino-knowledge] data write failed", error);
  }
  try {
    fs.writeFileSync(TMP_OVERRIDE, payload, "utf8");
    wrote = true;
  } catch (error) {
    console.error("[lumino-knowledge] tmp write failed", error);
  }
  memoryBucket().catalog = catalog;
  return wrote;
}

export function listArticles({ includeUnpublished = false } = {}) {
  const catalog = loadCatalog();
  let articles = [...(catalog.articles || [])];
  if (!includeUnpublished) articles = articles.filter((a) => a.status === "published");
  return articles.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

export function getArticle(id) {
  return loadCatalog().articles.find((a) => a.id === id) || null;
}

export function updateArticle(id, patch, actor = "staff") {
  const catalog = loadCatalog();
  const index = catalog.articles.findIndex((a) => a.id === id);
  if (index < 0) return { article: null, persisted: false };
  const current = catalog.articles[index];
  const next = { ...current, updatedAt: new Date().toISOString().slice(0, 10) };
  if (patch.status) {
    const status = String(patch.status);
    if (!STATUS.has(status)) throw new Error("无效状态");
    next.status = status;
  }
  if (patch.note) {
    next.notes = [
      ...(Array.isArray(next.notes) ? next.notes : []),
      { at: new Date().toISOString(), by: String(actor), text: String(patch.note).slice(0, 2000) },
    ];
  }
  catalog.articles[index] = next;
  catalog.updatedAt = new Date().toISOString();
  const persisted = writeOverride(catalog);
  return { article: next, persisted };
}

export function readMarkdown(article, lang = "zh") {
  if (!article?.paths) return null;
  const rel = article.paths[lang] || article.paths.zh;
  if (!rel) return null;
  const abs = path.join(ROOT, rel.replace(/^\//, ""));
  try {
    return fs.readFileSync(abs, "utf8");
  } catch (error) {
    console.error("[lumino-knowledge] md read failed", abs, error);
    return null;
  }
}

export const KNOWLEDGE_STATUSES = [...STATUS];
