const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const script = path.resolve(__dirname, "../scripts/check-advisor-model.mjs");

function runSmoke(payload) {
  return new Promise((resolve, reject) => {
    let requests = 0;
    const server = http.createServer((request, response) => {
      requests += 1;
      request.resume();
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(payload));
    });
    server.listen(0, "127.0.0.1", () => {
      const child = spawn(process.execPath, [script, `http://127.0.0.1:${server.address().port}`]);
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      child.on("error", reject);
      child.on("close", (code) => server.close(() => resolve({ code, output, requests })));
    });
  });
}

test("advisor model smoke accepts a real model source", async () => {
  const result = await runSmoke({ ok: true, answer: "模型回答", runtime: { source: "general_model" } });
  assert.equal(result.code, 0);
  assert.equal(result.requests, 1);
  assert.match(result.output, /smoke passed/);
});

test("advisor model smoke rejects fallback-only responses after two attempts", async () => {
  const result = await runSmoke({ ok: true, answer: "回退回答", runtime: { source: "retrieval_grounded", degradation_reason: "model_error" } });
  assert.equal(result.code, 1);
  assert.equal(result.requests, 2);
  assert.match(result.output, /source=retrieval_grounded/);
});
