const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("GitHub workflows use the pinned supported runner and Node runtime", () => {
  for (const file of [
    ".github/workflows/quality-gates.yml",
    ".github/workflows/roadmap-sync.yml",
  ]) {
    const source = read(file);
    assert.match(source, /runs-on: ubuntu-24\.04/);
    assert.match(source, /actions\/checkout@v7/);
    assert.match(source, /actions\/setup-node@v7/);
    assert.match(source, /node-version: 24/);
    assert.doesNotMatch(source, /ubuntu-latest|node-version: 20|actions\/(?:checkout|setup-node)@v4/);
  }
});
