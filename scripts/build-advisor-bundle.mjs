#!/usr/bin/env node
/**
 * Concatenate browser advisor modules into one file so Ask Lumino pays one RTT
 * on high-latency paths (e.g. CN ? Vercel) instead of four serial downloads.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parts = [
  "packages/advisor/catalog.js",
  "packages/advisor/schema.js",
  "packages/advisor/router.js",
  "apps/site/site/advisor-widget.js",
];
const out = path.join(root, "apps/site/site/advisor-bundle.js");
const banner = "/* auto-built advisor runtime - do not edit; run: node scripts/build-advisor-bundle.mjs */\n\n";
const body = parts.map((rel) => fs.readFileSync(path.join(root, rel), "utf8").trimEnd()).join("\n\n");
fs.writeFileSync(out, `${banner}${body}\n`);
console.log(`wrote ${path.relative(root, out)} (${Buffer.byteLength(body, "utf8")} bytes from ${parts.length} files)`);
