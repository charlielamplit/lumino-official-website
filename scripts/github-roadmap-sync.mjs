#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "Roadmap", "github-roadmap.json");
const MARKER_PREFIX = "<!-- lumino-roadmap-id:";

function parseArgs(argv) {
  const flags = new Set(argv.slice(2));
  const known = new Set(["--check", "--dry-run", "--apply", "--help"]);
  const unknown = [...flags].filter((flag) => !known.has(flag));
  if (unknown.length) throw new Error(`未知参数: ${unknown.join(", ")}`);
  if (flags.has("--apply") && (flags.has("--check") || flags.has("--dry-run"))) {
    throw new Error("--apply 不能与 --check 或 --dry-run 同时使用");
  }
  return {
    help: flags.has("--help"),
    check: flags.has("--check"),
    apply: flags.has("--apply"),
    dryRun: !flags.has("--check") && !flags.has("--apply") || flags.has("--dry-run")
  };
}

function printHelp() {
  console.log(`用法:
  node scripts/github-roadmap-sync.mjs --check    只校验本地 Roadmap
  node scripts/github-roadmap-sync.mjs --dry-run  比较远程状态，不写入（默认）
  node scripts/github-roadmap-sync.mjs --apply    创建或更新 GitHub Label / Issue

所需环境变量: GITHUB_OWNER, GITHUB_REPO；--apply 另需 GITHUB_TOKEN 或 GH_TOKEN`);
}

async function loadDotEnv(filePath) {
  let source = "";
  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  for (const rawLine of source.split(/\r?\n/)) {
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

async function loadManifest() {
  const source = await readFile(MANIFEST_PATH, "utf8");
  return JSON.parse(source);
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function validateManifest(manifest) {
  const errors = [];
  if (manifest.schemaVersion !== 1) errors.push("schemaVersion 必须为 1");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt || "")) errors.push("updatedAt 必须为 YYYY-MM-DD");
  if (!Array.isArray(manifest.labels) || !manifest.labels.length) errors.push("labels 不能为空");
  if (!Array.isArray(manifest.issues) || !manifest.issues.length) errors.push("issues 不能为空");
  if (errors.length) return errors;

  const labelNames = manifest.labels.map((label) => label.name);
  const labelSet = new Set(labelNames);
  const issueIds = manifest.issues.map((issue) => issue.id);
  const issueTitles = manifest.issues.map((issue) => issue.title);
  const issueMap = new Map(manifest.issues.map((issue) => [issue.id, issue]));

  for (const name of duplicates(labelNames)) errors.push(`重复 Label: ${name}`);
  for (const id of duplicates(issueIds)) errors.push(`重复 Issue ID: ${id}`);
  for (const title of duplicates(issueTitles)) errors.push(`重复 Issue 标题: ${title}`);

  for (const label of manifest.labels) {
    if (!label.name?.trim()) errors.push("Label 名称不能为空");
    if (!/^[0-9A-Fa-f]{6}$/.test(label.color || "")) errors.push(`Label ${label.name} 的 color 必须是 6 位十六进制`);
    if (!label.description?.trim()) errors.push(`Label ${label.name} 缺少 description`);
  }

  for (const issue of manifest.issues) {
    const prefix = issue.id || "<unknown>";
    if (!['roadmap', 'epic', 'feature'].includes(issue.kind)) errors.push(`${prefix}: kind 非法`);
    if (!['open', 'closed'].includes(issue.state)) errors.push(`${prefix}: state 非法`);
    if (!issue.title?.trim()) errors.push(`${prefix}: title 不能为空`);
    if (!issue.summary?.trim()) errors.push(`${prefix}: summary 不能为空`);
    if (!Array.isArray(issue.scope) || !issue.scope.length) errors.push(`${prefix}: scope 不能为空`);
    if (!Array.isArray(issue.acceptance) || issue.acceptance.length < 2) errors.push(`${prefix}: 至少需要 2 条验收标准`);
    for (const labelName of issue.labels || []) {
      if (!labelSet.has(labelName)) errors.push(`${prefix}: 引用了未定义 Label ${labelName}`);
    }
    const expectedType = `type/${issue.kind}`;
    if (!issue.labels?.includes(expectedType)) errors.push(`${prefix}: 缺少 ${expectedType}`);
    if ((issue.labels || []).filter((label) => label.startsWith("status/")).length !== 1) {
      errors.push(`${prefix}: 必须且只能包含一个 status/* Label`);
    }
    if (issue.kind === "feature") {
      const parent = issueMap.get(issue.parentId);
      if (!parent) errors.push(`${prefix}: 父 Epic ${issue.parentId} 不存在`);
      else if (parent.kind !== "epic") errors.push(`${prefix}: parentId 必须指向 Epic`);
    } else if (issue.parentId) {
      errors.push(`${prefix}: 只有 Feature 可以声明 parentId`);
    }
    for (const dependencyId of issue.dependencies || []) {
      if (!issueMap.has(dependencyId)) errors.push(`${prefix}: 依赖 ${dependencyId} 不存在`);
      if (dependencyId === issue.id) errors.push(`${prefix}: 不能依赖自身`);
    }
  }

  const roadmaps = manifest.issues.filter((issue) => issue.kind === "roadmap");
  if (roadmaps.length !== 1) errors.push("必须且只能定义一个 roadmap Issue");
  return errors;
}

function bulletList(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function referenceLink(reference) {
  if (/^https?:\/\//.test(reference)) return reference;
  return `[${reference}](../blob/main/${encodeURI(reference)})`;
}

function renderIssueBody(issue, issueNumberById, allIssues) {
  const lines = [];
  if (issue.kind === "feature") {
    const parentNumber = issueNumberById.get(issue.parentId);
    lines.push(parentNumber ? `Epic: #${parentNumber}` : `Epic: ${issue.parentId}（等待首次同步）`, "");
  }
  lines.push(`${MARKER_PREFIX}${issue.id} -->`);
  lines.push("_本 Issue 由 `Roadmap/github-roadmap.json` 同步。人工补充评论可以保留；标题、正文、标签和状态以清单为准。_", "");
  lines.push("## 目标", "", issue.summary, "");
  lines.push("## 范围", "", bulletList(issue.scope), "");
  lines.push("## 验收标准", "");
  for (const item of issue.acceptance) lines.push(`- [${issue.state === "closed" ? "x" : " "}] ${item}`);

  const children = allIssues.filter((candidate) => candidate.parentId === issue.id || (issue.kind === "roadmap" && candidate.kind === "epic"));
  if (children.length) {
    lines.push("", issue.kind === "roadmap" ? "## Epics" : "## Features", "");
    for (const child of children) {
      const number = issueNumberById.get(child.id);
      const target = number ? `#${number}` : child.id;
      lines.push(`- [${child.state === "closed" ? "x" : " "}] ${target} — ${child.title.replace(/^\[[^\]]+\]\s*/, "")}`);
    }
  }

  if (issue.dependencies?.length) {
    lines.push("", "## 依赖", "");
    for (const id of issue.dependencies) {
      const number = issueNumberById.get(id);
      lines.push(`- Depends: ${number ? `#${number}` : id}`);
    }
  }

  if (issue.references?.length) {
    lines.push("", "## 仓库依据", "");
    for (const reference of issue.references) lines.push(`- ${referenceLink(reference)}`);
  }

  lines.push("", `清单 ID: \`${issue.id}\` · 清单更新: \`${issue.manifestUpdatedAt || "由同步器注入"}\``);
  return `${lines.join("\n").trim()}\n`;
}

function sortIssues(issues) {
  const rank = { roadmap: 0, epic: 1, feature: 2 };
  return [...issues].sort((a, b) => rank[a.kind] - rank[b.kind] || a.id.localeCompare(b.id));
}

function markerId(body = "") {
  const match = body.match(/<!-- lumino-roadmap-id:([^\s]+) -->/);
  return match?.[1];
}

function sameLabels(remoteLabels, desiredNames) {
  const remote = (remoteLabels || []).map((label) => label.name).sort();
  const desired = [...desiredNames].sort();
  return JSON.stringify(remote) === JSON.stringify(desired);
}

function compactConfig() {
  const [repositoryOwner = "", repositoryName = ""] = (process.env.GITHUB_REPOSITORY || "").split("/");
  return {
    apiUrl: (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, ""),
    owner: process.env.GITHUB_OWNER || repositoryOwner,
    repo: process.env.GITHUB_REPO || repositoryName,
    token: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ""
  };
}

function missingConfig(config, includeToken = true) {
  return ["owner", "repo", ...(includeToken ? ["token"] : [])].filter((key) => !config[key]);
}

function createApi(config) {
  const repoPath = `${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const base = `${config.apiUrl}/repos/${repoPath}`;
  async function request(method, resource, body) {
    const response = await fetch(`${base}${resource}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lumino-roadmap-sync",
        ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }
    if (!response.ok) {
      const message = typeof payload === "object" && payload?.message ? payload.message : response.statusText;
      const acceptedPermissions = response.headers.get("x-accepted-github-permissions");
      const permissionHint = acceptedPermissions ? `；需要权限: ${acceptedPermissions}` : "";
      throw new Error(`GitHub API ${method} ${resource} 失败 (${response.status}): ${message}${permissionHint}`);
    }
    return payload;
  }

  async function listAll(resource) {
    const records = [];
    for (let page = 1; page <= 100; page += 1) {
      const separator = resource.includes("?") ? "&" : "?";
      const batch = await request("GET", `${resource}${separator}per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error(`GitHub API ${resource} 未返回数组`);
      records.push(...batch);
      if (batch.length < 100) break;
    }
    return records;
  }

  return { request, listAll };
}

async function sync(manifest, { apply }) {
  const config = compactConfig();
  const missing = missingConfig(config, apply);
  if (missing.length) {
    if (apply) throw new Error(`--apply 缺少环境变量: ${missing.join(", ")}`);
    console.log(`远程比较已跳过：缺少 ${missing.join(", ")}。`);
    console.log(`本地计划: ${manifest.labels.length} 个 Labels，${manifest.issues.filter((i) => i.kind === "epic").length} 个 Epics，${manifest.issues.filter((i) => i.kind === "feature").length} 个 Features。`);
    return;
  }

  const api = createApi(config);
  const remoteLabels = await api.listAll("/labels");
  const remoteIssues = (await api.listAll("/issues?state=all")).filter((issue) => !issue.pull_request);
  const labelByName = new Map(remoteLabels.map((label) => [label.name, label]));
  const issueById = new Map();
  const issueByTitle = new Map(remoteIssues.map((issue) => [issue.title, issue]));
  for (const issue of remoteIssues) {
    const id = markerId(issue.body);
    if (id) issueById.set(id, issue);
  }

  let createdLabels = 0;
  let updatedLabels = 0;
  for (const label of manifest.labels) {
    const existing = labelByName.get(label.name);
    if (!existing) {
      console.log(`${apply ? "CREATE" : "WOULD CREATE"} label ${label.name}`);
      if (apply) {
        const created = await api.request("POST", "/labels", label);
        labelByName.set(label.name, created);
      }
      createdLabels += 1;
      continue;
    }
    if (existing.color?.toLowerCase() !== label.color.toLowerCase() || (existing.description || "") !== label.description) {
      console.log(`${apply ? "UPDATE" : "WOULD UPDATE"} label ${label.name}`);
      if (apply) {
        const updated = await api.request("PATCH", `/labels/${encodeURIComponent(label.name)}`, label);
        labelByName.set(label.name, updated);
      }
      updatedLabels += 1;
    }
  }

  const issueNumberById = new Map();
  for (const issue of manifest.issues) {
    const existing = issueById.get(issue.id) || issueByTitle.get(issue.title);
    if (existing) {
      issueById.set(issue.id, existing);
      issueNumberById.set(issue.id, existing.number);
    }
  }

  let createdIssues = 0;
  let updatedIssues = 0;
  const sorted = sortIssues(manifest.issues).map((issue) => ({ ...issue, manifestUpdatedAt: manifest.updatedAt }));

  for (const issue of sorted) {
    if (issueById.has(issue.id)) continue;
    console.log(`${apply ? "CREATE" : "WOULD CREATE"} ${issue.kind} ${issue.id}: ${issue.title}`);
    if (apply) {
      const missingLabel = issue.labels.find((name) => !labelByName.has(name));
      if (missingLabel) throw new Error(`${issue.id}: Label ${missingLabel} 尚未创建`);
      const created = await api.request("POST", "/issues", {
        title: issue.title,
        body: renderIssueBody(issue, issueNumberById, sorted),
        labels: issue.labels
      });
      issueById.set(issue.id, created);
      issueNumberById.set(issue.id, created.number);
    }
    createdIssues += 1;
  }

  for (const issue of sorted) {
    const existing = issueById.get(issue.id);
    if (!existing) continue;
    const desiredBody = renderIssueBody(issue, issueNumberById, sorted);
    const changed = existing.title !== issue.title ||
      (existing.body || "") !== desiredBody ||
      existing.state !== issue.state ||
      !sameLabels(existing.labels, issue.labels);
    if (!changed) continue;
    console.log(`${apply ? "UPDATE" : "WOULD UPDATE"} ${issue.kind} ${issue.id} (#${existing.number})`);
    if (apply) {
      const missingLabel = issue.labels.find((name) => !labelByName.has(name));
      if (missingLabel) throw new Error(`${issue.id}: Label ${missingLabel} 尚未创建`);
      const updated = await api.request("PATCH", `/issues/${existing.number}`, {
        title: issue.title,
        body: desiredBody,
        state: issue.state,
        labels: issue.labels
      });
      issueById.set(issue.id, updated);
    }
    updatedIssues += 1;
  }

  console.log(`${apply ? "同步完成" : "Dry-run 完成"}: Labels +${createdLabels}/~${updatedLabels}，Issues +${createdIssues}/~${updatedIssues}。`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) return printHelp();
  await loadDotEnv(path.join(ROOT, ".env"));
  const manifest = await loadManifest();
  const errors = validateManifest(manifest);
  if (errors.length) {
    console.error("Roadmap 校验失败:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Roadmap 校验通过: ${manifest.labels.length} Labels / ${manifest.issues.length} Issues。`);
  if (args.check) return;
  await sync(manifest, args);
}

main().catch((error) => {
  console.error(`同步失败: ${error.message}`);
  process.exitCode = 1;
});
