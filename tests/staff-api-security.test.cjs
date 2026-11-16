const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    end(body = "") {
      this.body = body;
      return this;
    },
  };
}

async function loadHandler(relativePath) {
  const url = pathToFileURL(path.join(__dirname, "..", relativePath));
  url.searchParams.set("test", String(Date.now() + Math.random()));
  return (await import(url.href)).default;
}

test("lead staff API fails closed when LEADS_STAFF_KEY is missing", async () => {
  const previous = process.env.LEADS_STAFF_KEY;
  delete process.env.LEADS_STAFF_KEY;
  try {
    const handler = await loadHandler("api/leads.js");
    for (const method of ["GET", "PATCH"]) {
      const response = mockResponse();
      await handler({ method, headers: {}, query: {}, body: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.match(response.body, /未授权/);
    }
  } finally {
    if (previous === undefined) delete process.env.LEADS_STAFF_KEY;
    else process.env.LEADS_STAFF_KEY = previous;
  }
});

test("knowledge staff API fails closed when staff keys are missing", async () => {
  const previousLead = process.env.LEADS_STAFF_KEY;
  const previousKnowledge = process.env.KNOWLEDGE_STAFF_KEY;
  delete process.env.LEADS_STAFF_KEY;
  delete process.env.KNOWLEDGE_STAFF_KEY;
  try {
    const handler = await loadHandler("api/knowledge.js");
    for (const method of ["GET", "PATCH"]) {
      const response = mockResponse();
      await handler({ method, headers: {}, query: {}, body: {} }, response);
      assert.equal(response.statusCode, 401);
      assert.match(response.body, /未授权/);
    }
  } finally {
    if (previousLead === undefined) delete process.env.LEADS_STAFF_KEY;
    else process.env.LEADS_STAFF_KEY = previousLead;
    if (previousKnowledge === undefined) delete process.env.KNOWLEDGE_STAFF_KEY;
    else process.env.KNOWLEDGE_STAFF_KEY = previousKnowledge;
  }
});

test("staff login fails closed when credentials or shared key are not configured", async () => {
  const previousUsers = process.env.STAFF_USERS;
  const previousKey = process.env.LEADS_STAFF_KEY;
  delete process.env.STAFF_USERS;
  delete process.env.LEADS_STAFF_KEY;
  try {
    const handler = await loadHandler("api/staff-login.js");
    const statusResponse = mockResponse();
    await handler({ method: "GET", headers: {}, query: {}, body: {} }, statusResponse);
    assert.equal(statusResponse.statusCode, 200);
    assert.equal(JSON.parse(statusResponse.body).configured, false);

    const loginResponse = mockResponse();
    await handler({ method: "POST", headers: {}, query: {}, body: { email: "ops@example.com", password: "secret" } }, loginResponse);
    assert.equal(loginResponse.statusCode, 503);
    assert.match(loginResponse.body, /尚未配置/);
  } finally {
    if (previousUsers === undefined) delete process.env.STAFF_USERS;
    else process.env.STAFF_USERS = previousUsers;
    if (previousKey === undefined) delete process.env.LEADS_STAFF_KEY;
    else process.env.LEADS_STAFF_KEY = previousKey;
  }
});

test("staff login rejects invalid credentials and returns the configured key for a valid demo user", async () => {
  const previousUsers = process.env.STAFF_USERS;
  const previousKey = process.env.LEADS_STAFF_KEY;
  process.env.STAFF_USERS = "ops@example.com:secret:ops:林晓";
  process.env.LEADS_STAFF_KEY = "test-staff-key";
  try {
    const handler = await loadHandler("api/staff-login.js");
    const invalidResponse = mockResponse();
    await handler({ method: "POST", headers: {}, query: {}, body: { email: "ops@example.com", password: "wrong" } }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 401);
    assert.match(invalidResponse.body, /邮箱或密码错误/);

    const validResponse = mockResponse();
    await handler({ method: "POST", headers: {}, query: {}, body: { email: "OPS@example.com", password: "secret" } }, validResponse);
    assert.equal(validResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(validResponse.body), {
      ok: true,
      email: "ops@example.com",
      name: "林晓",
      role: "ops",
      staffKey: "test-staff-key",
      expiresInHours: 12,
    });
  } finally {
    if (previousUsers === undefined) delete process.env.STAFF_USERS;
    else process.env.STAFF_USERS = previousUsers;
    if (previousKey === undefined) delete process.env.LEADS_STAFF_KEY;
    else process.env.LEADS_STAFF_KEY = previousKey;
  }
});

test("public lead copy does not claim formal database delivery", () => {
  const fs = require("node:fs");
  const contact = fs.readFileSync(path.join(__dirname, "../apps/site/site/contact.js"), "utf8");
  const calculator = fs.readFileSync(path.join(__dirname, "../apps/site/calculator/app.js"), "utf8");
  for (const source of [contact, calculator]) {
    assert.doesNotMatch(source, /已写入线索库|商务可在 Portal 线索箱查看/);
    assert.match(source, /不代表正式数据库回执|未确认进入正式数据库/);
  }
});
