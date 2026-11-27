import { readRecord, putEvidence, putCandidate, confirmCandidate, deleteRecord } from "./portal-intake-store.js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  if (request.localPreview !== true) return response.status(404).json({ error: "not_found" });
  try {
    if (request.method === "GET") {
      const record = await readRecord(request.query?.requestId);
      if (!record) return response.status(404).json({ error: "record_not_found" });
      const { history, ...current } = record;
      return response.status(200).json(current);
    }
    if (request.method !== "POST") return response.status(405).json({ error: "method_not_allowed" });
    if (!String(request.headers["content-type"] || "").startsWith("application/json")) return response.status(415).json({ error: "json_required" });
    const input = request.body;
    if (!input || typeof input !== "object") return response.status(400).json({ error: "invalid_payload" });
    if (input.operation === "putEvidence") {
      const record = await putEvidence(input);
      return response.status(200).json({ evidenceId: record.evidence.evidenceId, stored: true });
    }
    if (input.operation === "putCandidate") {
      const record = await putCandidate(input.candidate);
      return response.status(200).json({ candidateId: record.candidate.id, revision: record.candidate.revision, stored: true });
    }
    if (input.operation === "confirm") {
      const confirmed = await confirmCandidate(input);
      return response.status(200).json({ ...confirmed, stored: true });
    }
    if (input.operation === "delete") {
      await deleteRecord(input.requestId);
      return response.status(200).json({ stored: true });
    }
    return response.status(400).json({ error: "invalid_operation" });
  } catch (error) {
    return response.status(error.status || 500).json({ error: error.code || "local_store_error", message: error.message || "本地证据存储失败。" });
  }
}
