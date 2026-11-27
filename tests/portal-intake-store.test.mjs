import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { putEvidence, putCandidate, confirmCandidate, readRecord } from "../api/_lib/portal-intake-store.js";

const require = createRequire(import.meta.url);
const { buildEvidenceId, buildCandidateId } = require("../packages/agent/domain/intake-model.js");

test("local CBAM intake survives store reload and rejects mismatched lineage", async () => {
  const previousDir = process.env.PORTAL_INTAKE_DATA_DIR;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "lumino-intake-test-"));
  process.env.PORTAL_INTAKE_DATA_DIR = directory;
  try {
    const bytes = Buffer.from("NATURAL_GAS_NM3=18420\n", "utf8");
    const requestId = "MR-CBAM-2026-Q3-E02";
    const evidence = {
      requestId, annualCaseId: "CASE-CBAM-2026", year: "2026", quarter: "Q3",
      facilityAssetId: "FAC-SH-01", tenantId: "TNT-0018", filename: "invoice.txt",
      byteLength: bytes.length, contentSha256: createHash("sha256").update(bytes).digest("hex"),
    };
    evidence.evidenceId = buildEvidenceId(evidence);
    await putEvidence({ evidence, base64: bytes.toString("base64") });
    const candidate = {
      requestId, evidenceId: evidence.evidenceId, evidenceContentSha256: evidence.contentSha256,
      tenantId: evidence.tenantId, facilityAssetId: evidence.facilityAssetId,
      year: evidence.year, quarter: evidence.quarter, extractorVersion: "extract-gas@1.1.0",
      revision: 1, status: "READY_FOR_REVIEW", proposedPatch: { originalValue: "18420", originalUnit: "Nm3" },
    };
    candidate.id = buildCandidateId(candidate);
    await assert.rejects(putCandidate({ ...candidate, evidenceId: "EVD-FORGED" }), { code: "CANDIDATE_MISMATCH" });
    await putCandidate(candidate);
    const replacement = Buffer.from("NATURAL_GAS_NM3=2000\n", "utf8");
    const nextEvidence = { ...evidence, byteLength: replacement.length, contentSha256: createHash("sha256").update(replacement).digest("hex") };
    nextEvidence.evidenceId = buildEvidenceId(nextEvidence);
    await putEvidence({ evidence: nextEvidence, base64: replacement.toString("base64") });
    assert.equal((await readRecord(requestId)).history[0].evidence.evidenceId, evidence.evidenceId);
    assert.equal(Buffer.from((await readRecord(requestId)).history[0].base64, "base64").toString(), bytes.toString());
    await putEvidence({ evidence, base64: bytes.toString("base64") });
    await putCandidate(candidate);
    const saved = await readRecord(requestId);
    assert.equal(Buffer.from(saved.base64, "base64").toString(), bytes.toString());
    assert.equal(saved.candidate.id, candidate.id);
    await assert.rejects(confirmCandidate({ requestId, candidateId: candidate.id, revision: 2, actor: "周岚" }), { code: "CANDIDATE_NOT_CURRENT" });
    const confirmed = await confirmCandidate({ requestId, candidateId: candidate.id, revision: 1, actor: "周岚" });
    assert.equal((await readRecord(requestId)).confirmed.value, "18420");
    assert.equal(confirmed.evidenceId, evidence.evidenceId);
    await assert.rejects(putEvidence({ evidence, base64: bytes.toString("base64") }), { code: "CORRECTION_REQUIRED" });
    const files = await fs.readdir(directory);
    assert.equal(files.length, 1);
    assert.equal((await fs.stat(path.join(directory, files[0]))).mode & 0o777, 0o600);
  } finally {
    if (previousDir === undefined) delete process.env.PORTAL_INTAKE_DATA_DIR;
    else process.env.PORTAL_INTAKE_DATA_DIR = previousDir;
    await fs.rm(directory, { recursive: true, force: true });
  }
});
