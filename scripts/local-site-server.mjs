#!/usr/bin/env node
/**
 * Local static + serverless API preview for the Lumino site.
 *
 * Usage:
 *   node scripts/local-site-server.mjs [port]
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2] || process.env.PORT || 4174);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env"));

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const apiRoutes = {
  "/api/advisor": "api/advisor.js",
  "/api/advisor-config": "api/advisor-config.js",
  "/api/advisor-metrics": "api/advisor-metrics.js",
  "/api/advisor-ping": "api/advisor-ping.js",
  "/api/knowledge": "api/knowledge.js",
};

const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const rewrites = (vercelConfig.rewrites || []).map(({ source, destination }) => {
  const parameters = [];
  const pattern = source.split("/").map((segment) => {
    if (!segment.startsWith(":")) return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const catchAll = segment.endsWith("*");
    parameters.push(segment.slice(1, catchAll ? -1 : undefined));
    return catchAll ? "(.*)" : "([^/]+)";
  }).join("/");
  return { destination, parameters, regex: new RegExp(`^${pattern}$`) };
});

function applyRewrite(urlPath) {
  for (const rewrite of rewrites) {
    const match = urlPath.match(rewrite.regex);
    if (!match) continue;
    let destination = rewrite.destination;
    rewrite.parameters.forEach((name, index) => {
      destination = destination.replace(`:${name}*`, match[index + 1] || "");
      destination = destination.replace(`:${name}`, match[index + 1] || "");
    });
    return destination.split("?")[0];
  }
  return urlPath;
}

function wrapResponse(response) {
  response.status = (code) => {
    response.statusCode = Number(code) || 200;
    return response;
  };
  response.json = (body) => {
    if (!response.getHeader("Content-Type")) {
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    response.end(JSON.stringify(body));
    return response;
  };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!String(request.headers["content-type"] || "").includes("application/json")) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function loadHandler(relativePath) {
  const fileUrl = pathToFileURL(path.join(root, relativePath));
  const module = await import(`${fileUrl.href}?preview=${Date.now()}`);
  return module.default;
}

function resolvePublicFile(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relativePath = decoded.replace(/^\/+/, "") || "index.html";
  if (relativePath.split(/[\\/]/).some((segment) => segment.startsWith("."))) return null;
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
}

function serveStatic(response, urlPath) {
  let filePath = resolvePublicFile(applyRewrite(urlPath));
  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  wrapResponse(response);
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);
  try {
    const apiFile = apiRoutes[url.pathname];
    if (apiFile) {
      const handler = await loadHandler(apiFile);
      request.query = Object.fromEntries(url.searchParams.entries());
      request.body = ["PATCH", "POST", "PUT"].includes(String(request.method || "").toUpperCase())
        ? await readBody(request)
        : undefined;
      await handler(request, response);
      return;
    }
    serveStatic(response, url.pathname);
  } catch (error) {
    console.error("[local-site-server]", error);
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    if (!response.writableEnded) {
      response.end(JSON.stringify({ error: "local_server_error" }));
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Lumino local preview: http://127.0.0.1:${port}/site`);
  console.log(`Advisor API:          http://127.0.0.1:${port}/api/advisor`);
});
