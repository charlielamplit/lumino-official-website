const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("production workflow deploys one immutable main SHA to both environments", () => {
  const workflow = read(".github/workflows/deploy-production.yml");
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.match(workflow, /Confirm Vercel production SHA/);
  assert.match(workflow, /Deploy the same SHA to Tencent/);
  assert.match(workflow, /Compare production release SHAs/);
  assert.doesNotMatch(workflow, /branches: \[server\]/);
});

test("Tencent deploy uploads before activation and rolls back failed smoke checks", () => {
  const deploy = read("scripts/deploy-tencent.sh");
  const uploadIndex = deploy.indexOf("Upload release without touching the live directory");
  const activateIndex = deploy.indexOf("Finalize and activate release");
  assert.ok(uploadIndex >= 0 && activateIndex > uploadIndex);
  assert.match(deploy, /Smoke checks failed; rolling back/);
  assert.match(deploy, /SSH_KNOWN_HOSTS:\?SSH_KNOWN_HOSTS required/);
  assert.doesNotMatch(deploy, /ssh-keyscan/);
  assert.doesNotMatch(deploy, /rsync[^\n]*--delete/);
});

test("release endpoint reports only a full Git SHA and is routed by Tencent server", async () => {
  const endpoint = read("api/release.js");
  const server = read("scripts/local-site-server.mjs");
  assert.match(endpoint, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(endpoint, /Cache-Control/);
  assert.doesNotMatch(endpoint, /node:fs|import\.meta/);
  assert.match(server, /\.release-sha/);
  assert.match(server, /"\/api\/release": "api\/release\.js"/);

  const previousSha = process.env.VERCEL_GIT_COMMIT_SHA;
  process.env.VERCEL_GIT_COMMIT_SHA = "a".repeat(40);
  const handler = (await import(`../api/release.js?test=${Date.now()}`)).default;
  const result = { headers: {}, statusCode: 0, body: null };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
  handler({ method: "GET" }, response);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.releaseSha, "a".repeat(40));
  assert.equal(result.headers["Cache-Control"], "no-store, max-age=0");
  if (previousSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
  else process.env.VERCEL_GIT_COMMIT_SHA = previousSha;
});
