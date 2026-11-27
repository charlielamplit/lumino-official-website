import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { readInvoiceText, validateExtraction, callInvoiceModel } from "../api/_lib/portal-intake-extractor.js";

const text = fs.readFileSync(new URL("../qa/fixtures/cbam-gas-realistic.txt", import.meta.url), "utf8");
const answer = {
  quantity: "1,000", unit: "Nm³", facilityName: "上海一厂",
  periodStart: "2026-07-01", periodEnd: "2026-09-30",
  quantityQuote: "本季天然气用量合计：1,000 Nm³",
  facilityQuote: "用气设施：上海一厂",
  periodQuote: "账期：2026-07-01 至 2026-09-30",
};
const context = { text, facilityName: "上海一厂", year: "2026", quarter: "Q3" };

test("ordinary invoice text is sent to the configured model and source-validated", async () => {
  let body;
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://aiberm.com/v1/chat/completions");
    assert.match(options.headers.Authorization, /^Bearer /);
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(answer) } }] }) };
  };
  const result = await callInvoiceModel({ ...context, fetchImpl, env: { ADVISOR_OPENAI_API_KEY: "test-key", ADVISOR_OPENAI_BASE_URL: "https://aiberm.com/v1", ADVISOR_MODEL_SOL: "test-model" } });
  assert.match(body.messages[0].content, /本季天然气用量合计：1,000 Nm³/);
  assert.equal(result.extraction.quantity, "1000");
  assert.equal(result.extraction.unit, "Nm3");
  assert.equal(result.extraction.periodEnd, "2026-09-30");
});

test("model output cannot change facility, period, quantity evidence, or unit", () => {
  assert.throws(() => validateExtraction({ ...answer, facilityName: "江苏二厂" }, context), { code: "FACILITY_SOURCE_MISMATCH" });
  assert.throws(() => validateExtraction({ ...answer, periodEnd: "2026-10-01" }, context), { code: "PERIOD_SOURCE_MISMATCH" });
  const octoberText = text.replace("2026-07-01", "2026-10-01").replace("2026-09-30", "2026-10-31");
  assert.throws(() => validateExtraction({ ...answer, periodStart: "2026-10-01", periodEnd: "2026-10-31", periodQuote: "账期：2026-10-01 至 2026-10-31" }, { ...context, text: octoberText }), { code: "PERIOD_MISMATCH" });
  assert.throws(() => validateExtraction({ ...answer, quantity: "2000" }, context), { code: "QUANTITY_SOURCE_MISMATCH" });
  assert.throws(() => validateExtraction({ ...answer, quantity: "100" }, context), { code: "QUANTITY_SOURCE_MISMATCH" });
  assert.throws(() => validateExtraction({ ...answer, periodStart: "2026-08-01" }, context), { code: "PERIOD_SOURCE_MISMATCH" });
  const julyText = text.replace("2026-09-30", "2026-07-31");
  assert.throws(() => validateExtraction({ ...answer, periodEnd: "2026-07-31", periodQuote: "账期：2026-07-01 至 2026-07-31" }, { ...context, text: julyText }), { code: "PERIOD_INCOMPLETE" });
  assert.throws(() => validateExtraction({ ...answer, unit: "kWh" }, context), { code: "UNIT_UNSUPPORTED" });
});

test("file reader rejects empty scans and accepts UTF-8 text", async () => {
  const read = await readInvoiceText({ filename: "bill.txt", bytes: Buffer.from(text) });
  assert.match(read.text, /华星钢铁有限公司/);
  await assert.rejects(readInvoiceText({ filename: "scan.pdf", bytes: Buffer.from("%PDF-fake"), pdfToText: async () => "" }), { code: "TEXT_NOT_FOUND" });
});
