const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "scripts/local-site-server.mjs"), "utf8");

test("local preview serves the Advisor APIs on loopback only", () => {
  assert.match(source, /server\.listen\(port, "127\.0\.0\.1"/);
  assert.match(source, /"\/api\/advisor": "api\/advisor\.js"/);
  assert.match(source, /"\/api\/advisor-config": "api\/advisor-config\.js"/);
  assert.match(source, /"\/api\/knowledge": "api\/knowledge\.js"/);
  assert.match(source, /vercel\.json/);
  assert.match(source, /function applyRewrite/);
});

test("local preview rejects traversal and hidden files", () => {
  assert.match(source, /decodeURIComponent/);
  assert.match(source, /segment\.startsWith\("\."\)/);
  assert.match(source, /filePath\.startsWith\(`\$\{root\}\$\{path\.sep\}`\)/);
  assert.doesNotMatch(source, /Lumino%20\?\?/);
});
