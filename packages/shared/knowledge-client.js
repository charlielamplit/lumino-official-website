(function (root) {
  "use strict";

  const STORAGE_KEY = "lumino.knowledge.overrides.v1";
  const CATALOG_URL = "/apps/site/knowledge/catalog.json";
  const STATUS_LABELS = {
    draft: "??",
    published: "???",
    archived: "???",
  };

  function readOverrides() {
    try {
      const raw = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (_) {
      return {};
    }
  }

  function writeOverrides(map) {
    root.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function mergeArticle(base, override) {
    return override ? { ...base, ...override, title: override.title || base.title, lead: override.lead || base.lead, paths: override.paths || base.paths } : base;
  }

  async function loadCatalog() {
    const response = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("?????????");
    const data = await response.json();
    const overrides = readOverrides();
    const articles = (data.articles || []).map((article) => mergeArticle(article, overrides[article.id]));
    return { ...data, articles };
  }

  async function fetchArticles({ publicOnly = false } = {}) {
    try {
      const headers = {};
      const key = root.sessionStorage.getItem("lumino-leads-staff-key");
      if (key) headers["X-Lumino-Staff-Key"] = key;
      const url = publicOnly ? "/api/knowledge?public=1" : "/api/knowledge";
      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        const overrides = readOverrides();
        const articles = (data.articles || []).map((article) => mergeArticle(article, overrides[article.id]));
        return { articles, source: "api" };
      }
    } catch (_) {
      /* fall through */
    }
    const catalog = await loadCatalog();
    let articles = catalog.articles;
    if (publicOnly) articles = articles.filter((a) => a.status === "published");
    return { articles, source: "catalog" };
  }

  async function fetchArticle(id, lang = "zh") {
    try {
      const headers = {};
      const key = root.sessionStorage.getItem("lumino-leads-staff-key");
      if (key) headers["X-Lumino-Staff-Key"] = key;
      const response = await fetch(`/api/knowledge?id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}&public=1`);
      if (response.ok) {
        const data = await response.json();
        if (data.markdown) return data;
      }
    } catch (_) {
      /* fall through */
    }
    const catalog = await loadCatalog();
    const article = catalog.articles.find((a) => a.id === id);
    if (!article) throw new Error("?????");
    const path = article.paths?.[lang] || article.paths?.zh;
    if (!path) throw new Error("??????");
    const mdResponse = await fetch(path, { cache: "no-store" });
    if (!mdResponse.ok) throw new Error("???? Markdown");
    const markdown = await mdResponse.text();
    return { ok: true, article, lang, markdown, source: "static" };
  }

  async function patchArticle(id, patch) {
    const overrides = readOverrides();
    const prev = overrides[id] || {};
    overrides[id] = {
      ...prev,
      ...patch,
      id,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    if (patch.note) {
      overrides[id].notes = [
        ...(Array.isArray(prev.notes) ? prev.notes : []),
        { at: new Date().toISOString(), by: patch.actor || "staff", text: patch.note },
      ];
    }
    writeOverrides(overrides);

    try {
      const headers = { "Content-Type": "application/json" };
      const key = root.sessionStorage.getItem("lumino-leads-staff-key");
      if (key) headers["X-Lumino-Staff-Key"] = key;
      const response = await fetch("/api/knowledge", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, ...patch }),
      });
      if (response.ok) {
        const data = await response.json();
        return { ok: true, article: data.article, source: "api" };
      }
    } catch (_) {
      /* local override remains */
    }
    return { ok: true, article: overrides[id], source: "local" };
  }

  function publicHref(id) {
    return `/apps/site/knowledge/article.html?id=${encodeURIComponent(id)}`;
  }

  root.LuminoKnowledgeClient = {
    STATUS_LABELS,
    loadCatalog,
    fetchArticles,
    fetchArticle,
    patchArticle,
    publicHref,
    readOverrides,
  };
})(typeof window !== "undefined" ? window : globalThis);
