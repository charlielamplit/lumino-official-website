import test from "node:test";
import assert from "node:assert/strict";
import { parsePrecursorLlmOutput } from "../api/_lib/precursor-model.js";

test("??????? precursors ??", () => {
  const rows = parsePrecursorLlmOutput(JSON.stringify({
    precursors: [
      { name: "??", cnCode: "72071210", estimateValue: 2, consumption: 1.05, reason: "??" },
      { name: "??", cnCode: "72071111", estimateValue: 1, consumption: 1, reason: "x" },
      { name: "??", cnCode: "72071112", estimateValue: 1, consumption: 1, reason: "y" },
      { name: "?????", cnCode: "72071113", estimateValue: 1, consumption: 1, reason: "z" },
    ],
  }));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].cnCode, "72071210");
  assert.equal(rows[0].consumption, 1.05);
});

test("?????? markdown ??", () => {
  const rows = parsePrecursorLlmOutput(`\`\`\`json
[{"name":"??","cnCode":"25231000","estimateValue":0.9,"consumption":0.85,"reason":"??????"}]
\`\`\``);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "??");
});

test("?? JSON ?????", () => {
  assert.deepEqual(parsePrecursorLlmOutput("not json"), []);
});


import { extractPrecursorMessageText } from "../api/_lib/precursor-model.js";

test("忽略纯 reasoning 散文，避免空 content 被当成答案", () => {
  const extracted = extractPrecursorMessageText({
    choices: [{
      finish_reason: "length",
      message: {
        content: "",
        reasoning_content: "I am thinking about billets for rebar...",
      },
    }],
  });
  assert.equal(extracted.empty, true);
});

test("content 有 JSON 时优先用 content", () => {
  const extracted = extractPrecursorMessageText({
    choices: [{
      finish_reason: "stop",
      message: {
        content: '{"precursors":[{"name":"钢坯","cnCode":"72071210","estimateValue":2,"consumption":1.05,"reason":"x"}]}',
        reasoning_content: "thinking...",
      },
    }],
  });
  assert.equal(extracted.empty, false);
  assert.equal(extracted.source, "content");
  assert.equal(parsePrecursorLlmOutput(extracted.raw).length, 1);
});
