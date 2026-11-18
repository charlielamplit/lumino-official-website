const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const CLIENT_SOURCE = fs.readFileSync(path.join(ROOT, "packages/shared/leads-client.js"), "utf8");

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

function response(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => payload,
  };
}

function loadClient({ fetchImpl, localSeed, sessionSeed } = {}) {
  const events = [];
  const context = {
    fetch: fetchImpl || (async () => { throw new Error("fetch not configured"); }),
    localStorage: createStorage(localSeed),
    sessionStorage: createStorage(sessionSeed),
    CustomEvent: class CustomEvent {
      constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    dispatchEvent(event) { events.push(event); },
  };
  context.window = context;
  vm.runInNewContext(CLIENT_SOURCE, context, { filename: "leads-client.js" });
  return { client: context.LuminoLeadsClient, context, events };
}

test("response parser accepts legacy and Platform API Contract v1 success shapes", () => {
  const { client } = loadClient();
  const legacy = client.parseApiResponse(response(200, {}), { ok: true, leads: [{ id: "OLD-1" }] });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.data.leads[0].id, "OLD-1");

  const v1 = client.parseApiResponse(response(200, {}), {
    ok: true,
    contractVersion: "1.0.0",
    requestId: "REQ-1",
    data: { leads: [{ id: "NEW-1" }] },
  });
  assert.equal(v1.ok, true);
  assert.equal(v1.data.leads[0].id, "NEW-1");
  assert.equal(v1.requestId, "REQ-1");
});

test("public submission never turns 503 or network failure into local success", async () => {
  const unavailable = loadClient({
    fetchImpl: async () => response(503, {
      ok: false,
      contractVersion: "1.0.0",
      requestId: "REQ-503",
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        retryable: true,
        recovery: "RETRY_LATER",
      },
    }),
  });
  const result = await unavailable.client.submitLead({ company: "A", name: "B", email: "a@example.com", note: "Need CBAM", consent: true });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DEPENDENCY_UNAVAILABLE");
  assert.match(result.error, /尚未正式保存/);
  assert.equal(unavailable.client.readLocal().length, 0);

  const offline = loadClient({ fetchImpl: async () => { throw new Error("offline"); } });
  const offlineResult = await offline.client.submitLead({ company: "A", name: "B", email: "a@example.com", note: "Need CBAM", consent: true });
  assert.equal(offlineResult.ok, false);
  assert.equal(offlineResult.code, "NETWORK_UNAVAILABLE");
  assert.equal(offline.client.readLocal().length, 0);
});

test("public submission accepts v1 success without caching contact PII locally", async () => {
  const { client } = loadClient({
    fetchImpl: async () => response(200, {
      ok: true,
      contractVersion: "1.0.0",
      requestId: "REQ-CREATE",
      data: {
        leadId: "LM-20261118-0001",
        notified: false,
        lead: {
          id: "LM-20261118-0001",
          status: "new",
          company: "Confirmed Co",
          createdAt: "2026-11-18T00:00:00Z",
        },
      },
    }),
  });
  const result = await client.submitLead({ company: "Confirmed Co", name: "B", email: "a@example.com", note: "Need CBAM", consent: true });
  assert.equal(result.ok, true);
  assert.equal(result.channel, "api");
  assert.equal(result.leadId, "LM-20261118-0001");
  assert.equal(result.lead.localOnly, false);
  assert.equal(client.readLocal().length, 0);
});

test("personal session inbox uses bearer auth and never merges local demo leads", async () => {
  let authorization = "";
  const localLead = { id: "LOCAL-1", company: "Demo", createdAt: "2026-01-01T00:00:00Z", localOnly: true };
  const { client } = loadClient({
    localSeed: { "lumino.public.leads.v1": JSON.stringify([localLead]) },
    sessionSeed: { "lumino-staff-session-token": "personal-token" },
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return response(200, {
        ok: true,
        contractVersion: "1.0.0",
        requestId: "REQ-LIST",
        data: { leads: [{ id: "REMOTE-1", company: "Remote", createdAt: "2026-11-18T00:00:00Z" }] },
      });
    },
  });
  const result = await client.fetchLeads();
  assert.equal(authorization, "Bearer personal-token");
  assert.equal(result.ok, true);
  assert.equal(result.source, "api");
  assert.deepEqual(Array.from(result.leads, (lead) => lead.id), ["REMOTE-1"]);
});

test("401 clears personal and legacy session keys and does not expose local cache", async () => {
  const { client, context, events } = loadClient({
    localSeed: { "lumino.public.leads.v1": JSON.stringify([{ id: "LOCAL-1" }]) },
    sessionSeed: {
      "lumino-staff-session-token": "expired-token",
      "lumino-leads-staff-key": "legacy-token",
      "lumino-staff-profile": "{}",
    },
    fetchImpl: async () => response(401, {
      ok: false,
      contractVersion: "1.0.0",
      requestId: "REQ-401",
      error: { code: "AUTH_REQUIRED", retryable: false, recovery: "SIGN_IN" },
    }),
  });
  const result = await client.fetchLeads();
  assert.equal(result.ok, false);
  assert.equal(result.source, "auth-required");
  assert.deepEqual(Array.from(result.leads), []);
  assert.equal(context.sessionStorage.getItem("lumino-staff-session-token"), null);
  assert.equal(context.sessionStorage.getItem("lumino-leads-staff-key"), null);
  assert.equal(context.sessionStorage.getItem("lumino-staff-profile"), null);
  assert.equal(events[0].type, "lumino:staff-session-expired");
});

test("409 update failure preserves cached data and requires refresh", async () => {
  const original = { id: "LM-1", status: "new", notes: [], updatedAt: "2026-11-18T00:00:00Z" };
  let requestBody = null;
  const { client } = loadClient({
    localSeed: { "lumino.public.leads.v1": JSON.stringify([original]) },
    sessionSeed: { "lumino-staff-session-token": "personal-token" },
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return response(409, {
        ok: false,
        contractVersion: "1.0.0",
        requestId: "REQ-409",
        error: { code: "REVISION_CONFLICT", retryable: false, recovery: "REFRESH_RESOURCE" },
      });
    },
  });
  const result = await client.patchLead("LM-1", { status: "qualified", actor: "forged-client-actor" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "REVISION_CONFLICT");
  assert.equal(result.recovery, "REFRESH_RESOURCE");
  assert.equal(client.readLocal()[0].status, "new");
  assert.equal(Object.hasOwn(requestBody, "actor"), false);
  assert.equal(Object.hasOwn(requestBody, "claimedBy"), false);
});

test("no-session demo updates remain explicitly local-only", async () => {
  const original = { id: "LOCAL-1", status: "new", notes: [], localOnly: true };
  const { client } = loadClient({
    localSeed: { "lumino.public.leads.v1": JSON.stringify([original]) },
  });
  const result = await client.patchLead("LOCAL-1", { status: "claimed", claimedBy: "Demo" });
  assert.equal(result.ok, true);
  assert.equal(result.localOnly, true);
  assert.equal(result.source, "local-demo");
  assert.equal(result.lead.status, "claimed");
});

test("Portal login consumes v1 data and keeps session-expiry recovery wired", () => {
  const eventsSource = fs.readFileSync(path.join(ROOT, "apps/portal/runtime/portal-events.js"), "utf8");
  const roleSource = fs.readFileSync(path.join(ROOT, "apps/portal/pages/role-pages.js"), "utf8");
  assert.match(eventsSource, /parseApiResponse\(response, data/);
  assert.match(eventsSource, /lumino-staff-session-token/);
  assert.match(eventsSource, /lumino:staff-session-expired/);
  assert.match(roleSource, /不会用本机缓存冒充服务端数据/);
  assert.doesNotMatch(roleSource, /已合并服务端线索库与本机缓存/);
});
