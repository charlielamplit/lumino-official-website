#!/usr/bin/env node
/**
 * Local static + advisor API server (no Vercel login required).
 * Usage: node scripts/local-site-server.mjs [port]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 4174);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env"));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function wrapResponse(res) {
  if (typeof res.status !== "function") {
    res.status = (code) => {
      res.statusCode = Number(code) || 200;
      return res;
    };
  }
  if (typeof res.json !== "function") {
    res.json = (body) => {
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.end(JSON.stringify(body));
      return res;
    };
  }
  return res;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return undefined;
  const type = String(req.headers["content-type"] || "");
  if (type.includes("application/json")) {
    try {
      return JSON.parse(raw.toString("utf8"));
    } catch (_) {
      return raw.toString("utf8");
    }
  }
  return raw.toString("utf8");
}

async function loadHandler(rel) {
  const file = path.join(root, rel);
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  return mod.default;
}

const apiRoutes = {
  "/api/advisor": "api/advisor.js",
  "/api/advisor-config": "api/advisor-config.js",
  "/api/advisor-metrics": "api/advisor-metrics.js",
  "/api/advisor-ping": "api/advisor-ping.js",
  "/api/knowledge": "api/knowledge.js",
};

function safeJoin(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

async function serveStatic(req, res, urlPath) {
  let filePath = safeJoin(urlPath === "/" ? "/index.html" : urlPath);
  if (!filePath) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  Readable.fromWeb
    ? fs.createReadStream(filePath).pipe(res)
    : fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  wrapResponse(res);
  const host = req.headers.host || `127.0.0.1:${port}`;
  const url = new URL(req.url || "/", `http://${host}`);
  const pathname = url.pathname;

  try {
    const apiFile = apiRoutes[pathname];
    if (apiFile) {
      const handler = await loadHandler(apiFile);
      req.query = Object.fromEntries(url.searchParams.entries());
      req.body = ["POST", "PUT", "PATCH"].includes(String(req.method || "").toUpperCase())
        ? await readBody(req)
        : undefined;
      await handler(req, res);
      return;
    }
    await serveStatic(req, res, pathname);
  } catch (error) {
    console.error("[local-site-server]", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "local_server_error", message: String(error?.message || error) }));
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local Lumino site: http://127.0.0.1:${port}/apps/site/Lumino%20%E5%AE%98%E7%BD%91.dc.html`);
  console.log(`Advisor API:       http://127.0.0.1:${port}/api/advisor`);
});
