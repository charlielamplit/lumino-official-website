import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const FILE_PATH = path.join(DATA_DIR, "leads.json");
const TMP_PATH = "/tmp/lumino-leads.json";

const STATUS = new Set(["new", "claimed", "qualified", "disqualified", "converted"]);

function memoryBucket() {
  if (!globalThis.__luminoLeadsStore) {
    globalThis.__luminoLeadsStore = { leads: [], loaded: false };
  }
  return globalThis.__luminoLeadsStore;
}

function readFromDisk() {
  for (const candidate of [FILE_PATH, TMP_PATH]) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const raw = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (Array.isArray(raw?.leads)) return raw.leads;
    } catch (error) {
      console.error("[lumino-lead-store] read failed", candidate, error);
    }
  }
  return null;
}

function writeToDisk(leads) {
  const payload = JSON.stringify({ updatedAt: new Date().toISOString(), leads }, null, 2);
  const targets = [];
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    targets.push(FILE_PATH);
  } catch (_) {
    /* read-only deploy root */
  }
  targets.push(TMP_PATH);
  let wrote = false;
  for (const target of targets) {
    try {
      fs.writeFileSync(target, payload, "utf8");
      wrote = true;
    } catch (error) {
      console.error("[lumino-lead-store] write failed", target, error);
    }
  }
  return wrote;
}

function ensureLoaded() {
  const bucket = memoryBucket();
  if (bucket.loaded) return bucket;
  const disk = readFromDisk();
  if (disk) bucket.leads = disk;
  bucket.loaded = true;
  return bucket;
}

export function listLeads() {
  const bucket = ensureLoaded();
  return [...bucket.leads].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function getLead(id) {
  return ensureLoaded().leads.find((lead) => lead.id === id) || null;
}

export function createLead(input) {
  const bucket = ensureLoaded();
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  const seq = String(bucket.leads.length + 1).padStart(4, "0");
  const lead = {
    id: `LM-${stamp}-${seq}`,
    status: "new",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    claimedBy: null,
    claimedAt: null,
    notes: [],
    ...input,
  };
  bucket.leads.unshift(lead);
  const persisted = writeToDisk(bucket.leads);
  return { lead, persisted };
}

export function updateLead(id, patch, actor = "staff") {
  const bucket = ensureLoaded();
  const index = bucket.leads.findIndex((lead) => lead.id === id);
  if (index < 0) return { lead: null, persisted: false };
  const current = bucket.leads[index];
  const next = { ...current, updatedAt: new Date().toISOString() };

  if (patch.status) {
    const status = String(patch.status);
    if (!STATUS.has(status)) throw new Error("不支持的线索状态");
    next.status = status;
    if (status === "claimed" && !next.claimedBy) {
      next.claimedBy = String(patch.claimedBy || actor);
      next.claimedAt = next.updatedAt;
    }
    if (status === "new") {
      next.claimedBy = null;
      next.claimedAt = null;
    }
  }
  if (patch.claimedBy) {
    next.claimedBy = String(patch.claimedBy);
    next.claimedAt = next.claimedAt || next.updatedAt;
    if (next.status === "new") next.status = "claimed";
  }
  if (patch.note) {
    next.notes = [
      ...(Array.isArray(next.notes) ? next.notes : []),
      { at: next.updatedAt, by: String(actor), text: String(patch.note).slice(0, 2000) },
    ];
  }

  bucket.leads[index] = next;
  const persisted = writeToDisk(bucket.leads);
  return { lead: next, persisted };
}

export const LEAD_STATUSES = [...STATUS];
