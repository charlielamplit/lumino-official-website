#!/usr/bin/env node
// Local browser acceptance: requires PostgreSQL, Portal preview and Chrome CDP.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../packages/platform/db');

const portalUrl = process.env.PORTAL_URL || 'http://127.0.0.1:4196/portal/';
const cdpUrl = process.env.CHROME_CDP_URL || 'http://127.0.0.1:9229/json';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await db.migrate();
  const suffix = crypto.randomBytes(4).toString('hex');
  const email = `keyboard-${suffix}@example.com`;
  const password = `Keyboard-${suffix}-2026!`;
  const otherEmail = `isolated-${suffix}@example.com`;
  const otherPassword = `Isolated-${suffix}-2026!`;
  await db.provisionPortalAccount({
    email, password, name: '企业负责人', tenantSlug: `keyboard-${suffix}`, tenantName: '键盘验收企业',
  });
  await db.provisionPortalAccount({
    email: otherEmail, password: otherPassword, name: '第二企业负责人', tenantSlug: `isolated-${suffix}`, tenantName: '隔离验收企业',
  });
  const targets = await (await fetch(cdpUrl)).json();
  const target = targets.find((item) => item.type === 'page' && item.url.startsWith(new URL(portalUrl).origin));
  assert.ok(target, 'Chrome CDP must expose a page target');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    let lastError;
    for (let index = 0; index < 80; index += 1) {
      try {
        if (await evaluate(expression)) { process.stdout.write(`PASS ${label}\n`); return; }
      } catch (error) {
        lastError = error;
      }
      await pause(150);
    }
    throw new Error(`FAIL ${label}${lastError ? `: ${lastError.message}` : ""}`);
  };
  const key = async (name) => {
    const code = name === ' ' ? 'Space' : name;
    const virtualKeyCode = name === 'Enter' ? 13 : name === ' ' ? 32 : name === 'Tab' ? 9 : 27;
    const event = { key: name, code, windowsVirtualKeyCode: virtualKeyCode, nativeVirtualKeyCode: virtualKeyCode };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...event });
    if (name === 'Enter' || name === ' ') {
      await send('Input.dispatchKeyEvent', { type: 'char', text: name === 'Enter' ? '\r' : ' ', ...event });
    }
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...event });
  };
  const activate = async (selector) => {
    assert.equal(await evaluate(`(() => { const node=document.querySelector(${JSON.stringify(selector)}); if (!node || node.disabled || node.hidden) return false; node.focus(); return document.activeElement===node; })()`), true, `focus ${selector}`);
    await key('Enter');
  };

  try {
    await send('Page.navigate', { url: portalUrl });
    await waitFor('document.readyState==="complete" && !!document.querySelector("#loginEmail")', 'login page ready');
    await evaluate('sessionStorage.clear()');
    await send('Page.reload', { ignoreCache: true });
    await waitFor('document.readyState==="complete" && !!document.querySelector("#loginEmail")', 'clean login page ready');
    await evaluate(`(() => { const input=document.querySelector('#loginEmail'); input.value=${JSON.stringify(email)}; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); })()`);
    await key('Enter');
    await waitFor('document.querySelector("#loginForm").dataset.step==="password" && document.activeElement?.id==="loginPassword"', 'email Enter focuses password');
    await evaluate(`(() => {
      const original=window.fetch.bind(window); window.__customerOriginalFetch=original; window.__failLoginOnce=true;
      window.fetch=(url,options) => {
        if (String(url)==='/api/portal-login' && window.__failLoginOnce) {
          window.__failLoginOnce=false;
          return Promise.resolve(new Response(JSON.stringify({ok:false,error:{code:'DEPENDENCY_UNAVAILABLE'}}),{status:503,headers:{'Content-Type':'application/json'}}));
        }
        return original(url,options);
      };
      document.querySelector('#loginPassword').value=${JSON.stringify(password)};
    })()`);
    await key('Enter');
    await waitFor('document.querySelector("#loginForm").dataset.step==="password" && !document.querySelector("#loginPasswordError").hidden', 'login outage stays on retryable password step');
    assert.match(await evaluate('document.querySelector("#loginPasswordError").textContent'), /暂不可用/);
    await activate('#loginForm [data-step-panel="password"] button[type="submit"]');
    await waitFor('!document.querySelector("#portal").hidden && !document.querySelector("[data-customer-view-panel=home]").hidden && document.activeElement?.matches("[data-customer-view-panel=home] h1")', 'retry logs in and focuses workbench');
    await activate('#shellRail [data-customer-view=cbam]');
    await waitFor('!document.querySelector("[data-customer-view-panel=setup]").hidden && document.activeElement?.id==="customerWorkspaceTitle"', 'first CBAM entry focuses guide');
    await evaluate('document.querySelector("#customerTenantConfirmed").focus()');
    await key(' ');
    await waitFor('document.querySelector("#customerTenantConfirmed").checked', 'Space confirms enterprise name');
    await activate('#customerSetupForm button[type=submit]');
    await waitFor('!document.querySelector("#customerProductStep").hidden && document.activeElement?.id==="customerProductTitle"', 'project creation focuses product step');
    await waitFor('document.querySelector("#customerCnSearchStatus").textContent.includes("目录有")', 'CN catalogue ready');
    await evaluate(`(() => { const input=document.querySelector('#customerCnSearch'); input.value='72085120'; input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await waitFor('document.querySelector("#customerCnResults button")?.textContent==="加入"', 'CN candidate available');
    await activate('#customerCnResults button');
    await waitFor('document.querySelector("#customerCnSelectedCount").textContent==="1" && document.activeElement?.id==="customerCnSearch"', 'keyboard selection returns to search');
    await activate('#customerCnSave');
    await waitFor('document.querySelector("#customerProductCount").textContent.includes("1") && document.activeElement?.id==="customerCnSaveFeedback"', 'saved product announces result');
    await activate('#customerProductStep [data-customer-step-target=facility]');
    await waitFor('!document.querySelector("#customerFacilityStep").hidden && document.activeElement?.id==="customerFacilityTitle"', 'facility step receives focus');
    await evaluate(`(() => { const f=document.querySelector('#customerFacilityStep form'); f.elements.name.value='上海一厂'; f.elements.location.value='中国上海'; })()`);
    await activate('#customerFacilityStep form button[type=submit]');
    await waitFor('document.querySelector("#customerFacilityCount").textContent.includes("1")', 'facility saves by Enter');
    await activate('#customerFacilityStep [data-customer-step-target=review]');
    await waitFor('!document.querySelector("#customerOverviewStep").hidden && document.activeElement?.id==="customerOverviewTitle"', 'review step receives focus');
    await activate('#customerCompleteSetup');
    await waitFor('!document.querySelector("[data-customer-view-panel=cbam]").hidden && document.activeElement?.matches("[data-customer-view-panel=cbam] h1")', 'keyboard completes guide and focuses CBAM');
    await waitFor('document.querySelectorAll("#roleNav button").length===5 && !document.querySelector("#sidebar").hidden', 'real CBAM shows five shared navigation entries');

    await evaluate(`(() => {
      window.__failProjectWriteOnce=true;
      const original=window.__customerOriginalFetch;
      window.fetch=(url,options) => {
        if (String(url)==='/api/portal-workspace' && options?.method==='PUT' && window.__failProjectWriteOnce) {
          window.__failProjectWriteOnce=false;
          return Promise.resolve(new Response(JSON.stringify({ok:false,error:{code:'DEPENDENCY_UNAVAILABLE'}}),{status:503,headers:{'Content-Type':'application/json'}}));
        }
        return original(url,options);
      };
      const f=document.querySelector('#customerProductionLinkForm');
      f.elements.productId.selectedIndex=1; f.elements.facilityId.selectedIndex=1; f.elements.processSummary.value='本厂轧制';
    })()`);
    await activate('#customerProductionLinkForm button[type=submit]');
    await waitFor('document.querySelector("#customerProductionLinkFeedback").textContent.includes("暂不可用") && document.querySelector("#customerProductionLinkForm").elements.productId.value', 'failed write preserves form and shows retryable error');
    await activate('#customerProductionLinkForm button[type=submit]');
    await waitFor('document.querySelectorAll("#customerProductionLinksList li").length===1', 'retry saves one production relationship');
    await waitFor('!document.querySelector("#customerMaterialPlanForm").hidden', 'linked facility unlocks material plan');
    await evaluate(`(() => { const f=document.querySelector('#customerMaterialPlanForm'); f.elements.facilityId.selectedIndex=1; f.elements.quarter.value='1'; })()`);
    await activate('#customerMaterialPlanForm button[type=submit]');
    await waitFor('document.querySelectorAll("#customerMaterialPlanList li").length===1 && document.querySelector("#customerMaterialPlanFeedback").textContent.includes("尚未发送")', 'material request saves as an unsent draft');
    await waitFor('document.querySelector("#customerEvidenceForm").hidden && document.querySelector("#customerEvidenceHint").textContent.includes("尚未开通")', 'unconfigured private upload stays closed with a clear explanation');
    for (const width of [320, 390, 768, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 821 });
      await pause(150);
      const dimensions = JSON.parse(await evaluate('JSON.stringify({ viewport:innerWidth, scroll:document.documentElement.scrollWidth })'));
      assert.equal(dimensions.viewport, width);
      assert.equal(dimensions.scroll, width);
      process.stdout.write(`PASS ${width}px viewport has no page overflow\n`);
    }
    await activate('#profileButton');
    await waitFor('!document.querySelector("#accountMenu").hidden', 'profile menu opens by Enter');
    await activate('#logoutButton');
    await waitFor('!document.querySelector("#loginScreen").hidden && !document.querySelector("#customerPages").textContent.includes("键盘验收企业")', 'logout clears hidden tenant data');
    await evaluate(`(() => { const input=document.querySelector('#loginEmail'); input.value=${JSON.stringify(otherEmail)}; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); })()`);
    await key('Enter');
    await waitFor('document.querySelector("#loginForm").dataset.step==="password" && document.activeElement?.id==="loginPassword"', 'second tenant password step');
    await evaluate(`document.querySelector('#loginPassword').value=${JSON.stringify(otherPassword)}`);
    await key('Enter');
    await waitFor('!document.querySelector("[data-customer-view-panel=home]").hidden && document.querySelector("[data-customer-view-panel=home]").textContent.includes("隔离验收企业")', 'second tenant opens same workbench');
    await activate('#shellRail [data-customer-view=assets]');
    await waitFor('document.querySelector("[data-customer-view-panel=assets]")?.textContent.includes("尚无产品或设施") && !document.querySelector("#customerProjectSummary").dataset.projectId', 'second tenant sees no first tenant records');
    await activate('#profileButton');
    await activate('#logoutButton');
    await waitFor('!document.querySelector("#loginScreen").hidden', 'second tenant logs out');
    assert.equal(await evaluate('document.querySelectorAll("#demoRoleSelect option[value]").length - 1'), 11);
    await evaluate('document.querySelector("#demoRoleSelect").value="reviewer"; document.querySelector("#demoRoleSelect").dispatchEvent(new Event("change",{bubbles:true}))');
    await waitFor('!document.querySelector("#portal").hidden && !document.querySelector("#demoWorkspaceLabel").hidden && document.querySelector("#main").textContent.includes("复核")', 'demo reviewer remains available');
    await send('Page.navigate', { url: `${portalUrl}?demoRole=customer_owner&service=cbam&page=work` });
    await waitFor('!document.querySelector("#portal").hidden && !document.querySelector("#demoWorkspaceLabel").hidden && document.querySelectorAll("#roleNav button").length===5', 'demo customer keeps CBAM menu');
    await waitFor('document.querySelector("#companyName").textContent.includes("华星") && !document.querySelector("#customerPages").textContent.includes("键盘验收企业")', 'demo data stays distinct from tenant data');
    await activate('#profileButton');
    await activate('#logoutButton');
    await waitFor('!document.querySelector("#loginScreen").hidden', 'demo account logs out');
    await evaluate(`(() => { const input=document.querySelector('#loginEmail'); input.value=${JSON.stringify(email)}; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus(); })()`);
    await key('Enter');
    await waitFor('document.querySelector("#loginForm").dataset.step==="password" && document.activeElement?.id==="loginPassword"', 'real account resumes after demo');
    await evaluate(`document.querySelector('#loginPassword').value=${JSON.stringify(password)}`);
    await key('Enter');
    await waitFor('document.querySelector("#portal").classList.contains("portal--real-customer") && !location.search.includes("demoRole")', 'real login removes demo route');
    await send('Page.reload', { ignoreCache: true });
    await waitFor('document.querySelector("#portal").classList.contains("portal--real-customer") && !document.querySelector("[data-customer-view-panel=home]").hidden', 'refresh restores real tenant after demo');
    await activate('#shellRail [data-customer-view=cbam]');
    await waitFor('!document.querySelector("[data-customer-view-panel=cbam]").hidden', 'real CBAM project reopens');
    await waitFor('document.querySelectorAll("#roleNav button").length===5 && document.querySelector("#customerProductCount").textContent.includes("1") && document.querySelector("#customerFacilityCount").textContent.includes("1") && document.querySelectorAll("#customerProductionLinksList li").length===1 && document.querySelectorAll("#customerMaterialPlanList li").length===1', 'refresh restores product, facility, production relationship and material draft');
    await evaluate(`(() => {
      const original=window.fetch.bind(window);
      window.__failSessionOnce=true;
      window.fetch=(url,options) => {
        if (String(url)==='/api/portal-workspace' && options?.method==='PUT' && window.__failSessionOnce) {
          window.__failSessionOnce=false;
          return Promise.resolve(new Response(JSON.stringify({ok:false,error:{code:'AUTH_REQUIRED'}}),{status:401,headers:{'Content-Type':'application/json'}}));
        }
        return original(url,options);
      };
      const f=document.querySelector('#customerProductionLinkForm');
      f.elements.productId.selectedIndex=1; f.elements.facilityId.selectedIndex=1;
    })()`);
    await activate('#customerProductionLinkForm button[type=submit]');
    await waitFor('!document.querySelector("#loginScreen").hidden && !sessionStorage.getItem("lumino-portal-customer-token") && !document.querySelector("#customerPages").textContent.includes("键盘验收企业")', 'expired session returns to login and clears tenant data');
  } finally {
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }).catch(() => {});
    socket.close();
    await db.closePool();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; void db.closePool(); });
