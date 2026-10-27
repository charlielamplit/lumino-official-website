import { mkdir, writeFile } from "node:fs/promises";

const cdpPort = process.argv[2] || "9223";
const origin = process.argv[3] || "http://127.0.0.1:4173";
const outputDir = new URL("../outputs/review/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const target = await fetch(`http://127.0.0.1:${cdpPort}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const task = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message));
  else task.resolve(message.result);
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const messageId = ++id;
  pending.set(messageId, { resolve, reject });
  socket.send(JSON.stringify({ id: messageId, method, params }));
});
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { returnByValue: true, awaitPromise: true, expression });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await call("Page.enable");
await call("Runtime.enable");
await call("Network.enable");
await call("Page.navigate", { url: `${origin}/apps/portal/?demoRole=reviewer` });
for (let attempt = 0; attempt < 30; attempt += 1) {
  await sleep(150);
  if ((await evaluate("document.readyState")) === "complete") break;
}
await sleep(500);

await evaluate(`(() => {
  workflowEngine.reset();
  workflowEngine.seed([
    { id: 'PCF-2026-001', type: 'serviceCase', status: 'EXPERT_REVIEW', owner: '王晨', year: '2026', scope: '热轧非合金钢卷' },
    { id: 'RUN-PCF-001', type: 'calculationRun', status: 'CURRENT', owner: 'PCF Agent', year: '2026', dependsOn: [], metadata: { serviceId: 'pcf', assetSnapshotId: 'SNAP-PCF-HRC-01', assetRunId: 'ARUN-PCF-001' } },
    { id: 'PCF-RPT-2026-001-R1', type: 'formalArtifact', status: 'INTERNAL_REVIEW', owner: 'PCF 专家', year: '2026', scope: '热轧非合金钢卷', metadata: { serviceId: 'pcf', assetSnapshotId: 'SNAP-PCF-HRC-01' } }
  ]);
  const command = { actor: '李娜', role: 'reviewer', reason: '浏览器专项审查准备' };
  if (!assetRegistry.getSnapshot('SNAP-PCF-HRC-01')) {
    assetRegistry.createSnapshot({ id: 'SNAP-PCF-HRC-01', tenantId: 'TNT-0018', serviceId: 'pcf', caseId: 'PCF-2026-001', inputAssetVersionIds: ['REC-HX-POWER-2026Q3@1'], status: 'CURRENT' }, command);
  }
  if (!assetRegistry.getCalculationRun('ARUN-PCF-001')) {
    assetRegistry.createCalculationRun({ id: 'ARUN-PCF-001', tenantId: 'TNT-0018', serviceId: 'pcf', caseId: 'PCF-2026-001', snapshotId: 'SNAP-PCF-HRC-01', status: 'SUCCEEDED', ruleVersion: 'CN-EF-2026.1' }, command);
  }
  assetRegistry.markCurrent('ARUN-PCF-001', command);
  login('reviewer');
  return true;
})()`);
await sleep(300);

const before = await evaluate(`({
  title: document.title,
  heading: document.querySelector('#main h1')?.textContent || '',
  hasApproveAction: Boolean(document.querySelector('[data-action="pcf-complete-review"]')),
  role: state.role
})`);
await evaluate(`document.querySelector('[data-action="pcf-complete-review"]')?.click()`);
await sleep(500);
const after = await evaluate(`({
  serviceStatus: workflowEngine.get('PCF-2026-001')?.status,
  reportStatus: workflowEngine.get('PCF-RPT-2026-001-R1')?.status,
  snapshotStatus: assetRegistry.getSnapshot('SNAP-PCF-HRC-01')?.status,
  reportSnapshotId: workflowEngine.get('PCF-RPT-2026-001-R1')?.metadata?.snapshotId || null
})`);

const report = {
  before,
  after,
  pass: before.role === "reviewer"
    && before.hasApproveAction
    && after.serviceStatus === "DELIVERABLE_READY"
    && after.reportStatus === "LOCKED"
    && after.snapshotStatus === "LOCKED"
    && after.reportSnapshotId === "SNAP-PCF-HRC-01",
};
await writeFile(new URL("pcf-review-flow-audit.json", outputDir), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();
if (!report.pass) process.exitCode = 1;
