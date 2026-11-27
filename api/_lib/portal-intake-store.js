import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildEvidenceId, buildCandidateId } = require("../../packages/agent/domain/intake-model.js");
const MAX_BYTES = 30 * 1024 * 1024;
// shortcut: Single-process loopback preview; shared deployment needs authenticated database transactions and private object storage.

function fail(code, message, status = 422) {
  throw Object.assign(new Error(message), { code, status });
}

function dataDir() {
  if (!process.env.PORTAL_INTAKE_DATA_DIR) fail("LOCAL_STORE_NOT_CONFIGURED", "本地证据存储尚未配置。", 503);
  return process.env.PORTAL_INTAKE_DATA_DIR;
}

function fileFor(requestId) {
  if (!/^MR-CBAM-20\d{2}-Q[1-4]-E02$/.test(String(requestId))) fail("INVALID_REQUEST_ID", "材料请求编号无效。", 400);
  return path.join(dataDir(), `${createHash("sha256").update(requestId).digest("hex")}.json`);
}

function decode(base64) {
  if (typeof base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail("INVALID_FILE_PAYLOAD", "文件编码无效。", 400);
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_BYTES || bytes.toString("base64") !== base64) fail("INVALID_FILE_PAYLOAD", "文件为空、超过 30 MB 或编码无效。", 413);
  return bytes;
}

async function readRecord(requestId) {
  try {
    const record = JSON.parse(await fs.readFile(fileFor(requestId), "utf8"));
    if (record.requestId !== requestId || !record.evidence || !record.base64) fail("STORE_CORRUPT", "本地证据记录不完整。", 500);
    for (const version of [record, ...(record.history || [])]) {
      const digest = createHash("sha256").update(decode(version.base64)).digest("hex");
      if (digest !== version.evidence.contentSha256) fail("STORE_CORRUPT", "本地证据文件摘要不匹配。", 500);
    }
    return record;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeRecord(requestId, record) {
  const filename = fileFor(requestId);
  await fs.mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify(record), { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  return record;
}

export async function putEvidence({ evidence, base64 }) {
  const requestId = evidence?.requestId;
  fileFor(requestId);
  const bytes = decode(base64);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (evidence.tenantId !== "TNT-0018" || !/^FAC-(SH-01|JS-02)$/.test(String(evidence.facilityAssetId))
    || !/^20\d{2}$/.test(String(evidence.year)) || !/^Q[1-4]$/.test(String(evidence.quarter))
    || !String(requestId).includes(`${evidence.year}-${evidence.quarter}`)
    || evidence.contentSha256 !== digest || evidence.byteLength !== bytes.length
    || evidence.evidenceId !== buildEvidenceId(evidence)
    || !/^[^/\\\0]{1,200}\.(txt|csv|pdf)$/i.test(String(evidence.filename))) {
    fail("EVIDENCE_MISMATCH", "文件、摘要或材料请求不一致。", 409);
  }
  const previous = await readRecord(requestId);
  if (previous?.confirmed) fail("CORRECTION_REQUIRED", "该材料已确认；请走更正流程。", 409);
  const history = previous ? [
    ...(previous.history || []),
    { evidence: previous.evidence, base64: previous.base64, candidate: previous.candidate, confirmed: previous.confirmed },
  ] : [];
  return writeRecord(requestId, { requestId, evidence, base64, candidate: null, confirmed: null, history });
}

export async function putCandidate(candidate) {
  const requestId = candidate?.requestId;
  const record = await readRecord(requestId);
  if (!record) fail("EVIDENCE_NOT_FOUND", "请先保存原始文件。", 404);
  if (record.confirmed) fail("CORRECTION_REQUIRED", "该材料已确认；请走更正流程。", 409);
  if (candidate.status !== "READY_FOR_REVIEW" || candidate.evidenceId !== record.evidence.evidenceId
    || candidate.tenantId !== record.evidence.tenantId || candidate.facilityAssetId !== record.evidence.facilityAssetId
    || String(candidate.year) !== String(record.evidence.year) || candidate.quarter !== record.evidence.quarter
    || candidate.evidenceContentSha256 !== record.evidence.contentSha256
    || candidate.id !== buildCandidateId(candidate) || !Number.isSafeInteger(candidate.revision) || candidate.revision < 1
    || !/^\d+(?:\.\d+)?$/.test(String(candidate.proposedPatch?.originalValue))
    || candidate.proposedPatch?.originalUnit !== "Nm3") {
    fail("CANDIDATE_MISMATCH", "候选与保存的原始文件不一致。", 409);
  }
  if (record.candidate && candidate.revision < record.candidate.revision) fail("CANDIDATE_REVISION_STALE", "候选版本已更新。", 409);
  return writeRecord(requestId, { ...record, candidate });
}

export async function confirmCandidate({ requestId, candidateId, revision, actor }) {
  const record = await readRecord(requestId);
  if (!record?.candidate || record.candidate.id !== candidateId || record.candidate.revision !== revision) {
    fail("CANDIDATE_NOT_CURRENT", "待确认候选已变化，请刷新。", 409);
  }
  if (record.confirmed) return record.confirmed;
  if (!actor || typeof actor !== "string" || actor.length > 80) fail("NAMED_ACTOR_REQUIRED", "请使用具名身份确认。", 400);
  const confirmed = { candidateId, revision, evidenceId: record.evidence.evidenceId, value: record.candidate.proposedPatch.originalValue, unit: "Nm3", actor, confirmedAt: new Date().toISOString() };
  await writeRecord(requestId, { ...record, confirmed });
  return confirmed;
}

export async function deleteRecord(requestId) {
  await fs.rm(fileFor(requestId), { force: true });
}

export { readRecord };
