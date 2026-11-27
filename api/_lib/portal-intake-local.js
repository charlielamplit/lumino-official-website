import { readInvoiceText, callInvoiceModel } from "./portal-intake-extractor.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.localPreview !== true) return response.status(404).json({ error: "not_found" });
  if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });
  if (!String(request.headers["content-type"] || "").startsWith("application/json")) return response.status(415).json({ error: "json_required" });
  const input = request.body;
  if (!input || typeof input !== "object" || typeof input.base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) {
    return response.status(400).json({ error: "invalid_file_payload" });
  }
  if (!/^20\d{2}$/.test(String(input.year)) || !/^Q[1-4]$/.test(String(input.quarter)) || !["上海一厂", "江苏二厂"].includes(input.facilityName)) {
    return response.status(400).json({ error: "invalid_context" });
  }
  try {
    const bytes = Buffer.from(input.base64, "base64");
    const { text, contentSha256 } = await readInvoiceText({ filename: input.filename, bytes });
    const result = await callInvoiceModel({ text, facilityName: input.facilityName, year: input.year, quarter: input.quarter });
    return response.status(200).json({ ...result, contentSha256, extractionMode: "model_gateway", storage: "session_only" });
  } catch (error) {
    return response.status(error.status || 502).json({ error: error.code || "EXTRACTION_FAILED", message: error.message || "账单提取失败。" });
  }
}
