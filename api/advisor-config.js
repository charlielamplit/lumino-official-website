import { getPublicFlags } from "./_lib/advisor-flags.js";

export default async function handler(request, response) {
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method Not Allowed" });
    return;
  }
  response.setHeader("Cache-Control", "public, max-age=30");
  response.status(200).json({
    ok: true,
    ...getPublicFlags(),
  });
}
