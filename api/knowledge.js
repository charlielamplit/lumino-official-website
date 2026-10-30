/**
 * Knowledge catalog API
 * - GET: list articles (staff sees all; ?public=1 only published)
 * - GET ?id=: metadata + markdown body for requested lang
 * - PATCH: update status / note (writes data override; base catalog.json stays in git)
 */
import { getArticle, listArticles, readMarkdown, updateArticle } from "./_lib/knowledge-store.js";

function json(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(body));
}

function staffAuthorized(request) {
  const expected = process.env.LEADS_STAFF_KEY || process.env.KNOWLEDGE_STAFF_KEY;
  if (!expected) return true;
  const header = request.headers["x-lumino-staff-key"] || "";
  const query = request.query?.key || "";
  return header === expected || query === expected;
}

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    const id = request.query?.id;
    const lang = request.query?.lang === "en" ? "en" : "zh";
    const publicOnly = request.query?.public === "1" || request.query?.public === "true";

    if (id) {
      const article = getArticle(String(id));
      if (!article) return json(response, 404, { error: "文章不存在" });
      if (publicOnly && article.status !== "published") {
        return json(response, 404, { error: "文章不存在" });
      }
      if (!publicOnly && !staffAuthorized(request)) return json(response, 401, { error: "未授权" });
      const markdown = readMarkdown(article, lang);
      return json(response, 200, { ok: true, article, lang, markdown });
    }

    if (!publicOnly && !staffAuthorized(request)) return json(response, 401, { error: "未授权" });
    const articles = listArticles({ includeUnpublished: !publicOnly });
    return json(response, 200, { ok: true, articles });
  }

  if (request.method === "PATCH") {
    if (!staffAuthorized(request)) return json(response, 401, { error: "未授权" });
    const body = request.body || {};
    const id = String(body.id || request.query?.id || "").trim();
    if (!id) return json(response, 400, { error: "缺少 id" });
    try {
      const { article, persisted } = updateArticle(id, body, body.actor || "staff");
      if (!article) return json(response, 404, { error: "文章不存在" });
      return json(response, 200, { ok: true, article, persisted });
    } catch (error) {
      return json(response, 400, { error: error.message || "更新失败" });
    }
  }

  return json(response, 405, { error: "Method Not Allowed" });
}
