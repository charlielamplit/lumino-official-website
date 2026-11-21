(function (root, factory) {
  "use strict";
  const dependency = root?.LuminoIntakeModel || (typeof require === "function" ? require("./intake-model.js") : null);
  const api = factory(root, dependency);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LuminoEvidenceStore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root, intake) {
  "use strict";

  async function sha256(bytes) {
    const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (root?.crypto?.subtle) {
      const digest = await root.crypto.subtle.digest("SHA-256", input);
      return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
    }
    if (typeof require === "function") return require("node:crypto").createHash("sha256").update(input).digest("hex");
    throw new Error("sha256_unavailable");
  }

  function createMemoryEvidenceStore({ clock = () => Date.now() } = {}) {
    const records = new Map();
    const bytesById = new Map();
    function visible(context) {
      const record = records.get(context?.evidenceId);
      return record && context?.tenantId && record.tenantId === context.tenantId && context?.actor ? record : null;
    }
    return {
      async put(input) {
        if (!input?.actor?.actor || input.actor.tenantId !== input.tenantId) throw Object.assign(new Error("无权写入其他租户证据。"), { code: "TENANT_MISMATCH" });
        const bytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes || []);
        if (!bytes.byteLength) throw Object.assign(new Error("证据文件为空。"), { code: "FILE_REQUIRED" });
        const contentSha256 = await sha256(bytes);
        const evidenceId = intake.buildEvidenceId({ ...input, contentSha256 });
        if (!records.has(evidenceId)) {
          records.set(evidenceId, Object.freeze({
            evidenceId,
            requestId: input.requestId,
            filename: input.filename,
            mediaType: input.mediaType || "text/plain",
            byteLength: bytes.byteLength,
            contentSha256,
            tenantId: input.tenantId,
            annualCaseId: input.annualCaseId,
            year: String(input.year),
            quarter: input.quarter,
            storedAt: new Date(clock()).toISOString(),
            storedBy: input.actor.actor,
          }));
          bytesById.set(evidenceId, new Uint8Array(bytes));
        }
        return { ...records.get(evidenceId) };
      },
      get(context) {
        const record = visible(context);
        return record ? { ...record } : null;
      },
      getBytes(context) {
        const record = visible(context);
        return record ? new Uint8Array(bytesById.get(record.evidenceId)) : null;
      },
      digestOf: sha256,
    };
  }

  return { sha256, createMemoryEvidenceStore };
});
