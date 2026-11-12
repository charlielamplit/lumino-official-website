const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("calculator assets survive Vercel's no-trailing-slash canonical URL", () => {
  const html = read("apps/site/calculator/index.html");
  const app = read("apps/site/calculator/app.js");
  const config = JSON.parse(read("vercel.json"));

  assert.match(html, /href="\/calculator\/styles\.css"/);
  assert.match(html, /src="\/calculator\/app\.js"/);
  assert.doesNotMatch(html, /(?:href|src)="\.\/(?:styles\.css|app\.js)"/);
  assert.match(app, /const DATA_ROOT = "\/calculator\/data"/);

  const rewrites = new Map(config.rewrites.map(({ source, destination }) => [source, destination]));
  assert.equal(rewrites.get("/calculator"), "/apps/site/calculator/index.html");
  assert.equal(rewrites.get("/calculator/:path*"), "/apps/site/calculator/:path*");
});
