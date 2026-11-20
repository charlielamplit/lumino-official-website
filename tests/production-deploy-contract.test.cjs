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
  assert.match(workflow, /timeout-minutes: 25/);
  assert.match(workflow, /https:\/\/intl\.luminoyou\.com/);
  assert.match(workflow, /Verify Vercel Advisor model/);
  assert.match(workflow, /Confirm Vercel production SHA[\s\S]*Checkout exact release[\s\S]*Verify Vercel Advisor model/);
  assert.doesNotMatch(workflow, /branches: \[server\]/);
});

test("Tencent deploy seeds an immutable release, syncs only differences and rolls back failed smoke checks", () => {
  const deploy = read("scripts/deploy-tencent.sh");
  const seedIndex = deploy.indexOf("Seed a new release from the current Tencent release");
  const uploadIndex = deploy.indexOf("Sync only release differences");
  const activateIndex = deploy.indexOf("Finalize and activate release");
  assert.ok(seedIndex >= 0 && uploadIndex > seedIndex && activateIndex > uploadIndex);
  assert.match(deploy, /Smoke checks failed; rolling back/);
  assert.match(deploy, /SSH_KNOWN_HOSTS:\?SSH_KNOWN_HOSTS required/);
  assert.match(deploy, /TENCENT_HEALTH_URL/);
  assert.match(deploy, /REMOTE_SMOKE/);
  assert.match(deploy, /bash -s -- "\$health_base" "\$release_sha" "\$deploy_dir"/);
  assert.match(deploy, /deploy_dir="\$3"/);
  assert.match(deploy, /ConnectTimeout=10/);
  assert.match(deploy, /BatchMode=yes/);
  assert.match(deploy, /--link-dest="\$base"/);
  assert.match(deploy, /--exclude '\/data'/);
  assert.match(deploy, /--exclude '\/\.env'/);
  assert.match(deploy, /timeout --foreground 8m rsync/);
  assert.match(deploy, /--delete/);
  assert.match(deploy, /timeout --foreground 5m npm ci/);
  assert.match(deploy, /GITHUB_OUTPUT/);
  assert.match(deploy, /check-advisor-model\.mjs/);
  assert.doesNotMatch(deploy, /ssh-keyscan/);
  assert.doesNotMatch(read(".github/workflows/deploy-production.yml"), /apt-get/);
});

test("local Tencent deploy requires a clean checkout at the exact remote main SHA", () => {
  const localDeploy = read("scripts/deploy-tencent-local.sh");
  const authorize = read(".github/workflows/authorize-local-tencent-deployer.yml");
  assert.match(localDeploy, /git status --porcelain/);
  assert.match(localDeploy, /git fetch origin main/);
  assert.match(localDeploy, /HEAD must equal origin\/main/);
  assert.match(localDeploy, /Vercel is not serving/);
  assert.match(localDeploy, /lumino_tencent_deploy/);
  assert.match(authorize, /environment: tencent-lighthouse/);
  assert.match(authorize, /LOCAL_DEPLOY_PUBLIC_KEY/);
  assert.match(authorize, /grep -qxF/);
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
