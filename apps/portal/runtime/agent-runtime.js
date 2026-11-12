(function () {
  "use strict";

  let returnFocus = null;
  let focusOnOpen = false;
  let activeQuestionAbort = null;
  let questionSequence = 0;

  const catalog = () => window.LuminoAgentCatalog || {};
  const PBM = () => catalog().PBM || {};
  const PLAYBOOKS = () => catalog().PLAYBOOKS || [];
  const AG_SUG = () => catalog().AG_SUG || {};
  const AG_REPLY = () => catalog().AG_REPLY || {};
  const PAGE_PLAYBOOK = () => catalog().PAGE_PLAYBOOK || {};
  const GRP_LABELS = () => catalog().GRP_LABELS || ["开通期 · 只做一次", "季度循环 · 每季度", "年度 · 每年一次"];
  const goldenIds = new Set(["p06", "p07", "p08"]);
  const goldenStage = (pbId) => goldenIds.has(pbId) && typeof cbamGoldenPath !== "undefined" ? cbamGoldenPath.stage(pbId) : null;
  const playbookDone = (pbId) => {
    const stage = goldenStage(pbId);
    return stage ? ["done", "done_external"].includes(stage.state) : Boolean(state.rtDone[pbId]);
  };
  const currentActor = () => ({ name: roleConfig[state.role]?.name || "未知用户", role: state.role, perspective: state.agentAs });

  function ensureAgentState() {
    if (!state.agentOpen) state.agentOpen = false;
    if (typeof state.agentDock !== "boolean") state.agentDock = false;
    if (!state.agentPb) state.agentPb = "chat";
    if (!state.agentAs) state.agentAs = "client";
    if (!state.agentTab) state.agentTab = "art";
    if (!state.agentMode) state.agentMode = "ask";
    if (!Array.isArray(state.agentMsgs)) state.agentMsgs = [];
    if (typeof state.agentInput !== "string") state.agentInput = "";
    if (!state.rtCur) state.rtCur = {};
    if (!state.rtAns) state.rtAns = {};
    if (!state.rtDone) state.rtDone = {};
    if (!state.rtStarted) state.rtStarted = {};
    if (!Array.isArray(state.agentLog)) state.agentLog = [];
    if (!state.agentMobileView) state.agentMobileView = "conversation";
  }

  function agentCtxLabel() {
    const map = {
      workbench: "工作台 · 所有服务",
      tasks: "我的任务 · 跨服务",
      assets: "数据资产",
      deliver: "交付中心",
      services: "服务目录",
      work: state.year === "2026" ? `CBAM · ${state.year} ${state.quarter} 当前工作` : `CBAM · ${state.year} 当前工作`,
      roadmap: `CBAM · ${state.year} 全年流程`,
      products: "CBAM · 产品与工厂",
      data: `CBAM · ${state.year} ${state.quarter} 季度数据`,
      results: `CBAM · ${state.year} ${state.quarter} 计算与成本`,
      deliverables: "CBAM · 报告与交付",
      "org-settings": "企业设置",
    };
    return map[state.page] || `当前页 · ${state.page}`;
  }

  function preferredPlaybookId() {
    const map = PAGE_PLAYBOOK();
    if (state.page === "deliverables") return "p08";
    if (state.page === "data") return "p06";
    if (state.page === "products") return "p03";
    if (state.page === "results") return "p07";
    if (state.page === "roadmap") return "p10";
    if (state.page === "work") return "p02";
    if (state.page === "services" || state.page === "services-hub") return "p01";
    if (state.page === "org-settings") return "p05";
    return map[state.page] || null;
  }

  function agentStatusChip(pb) {
    if (!pb || state.agentPb === "chat") return { t: "问答", tone: "muted" };
    const stage = goldenStage(pb.id);
    if (stage?.state === "waiting_human") return { t: `等待 ${stage.assignee || "具名处理人"}`, tone: "warn" };
    if (stage?.state === "blocked") return { t: "前置阻断", tone: "warn" };
    if (stage?.state === "failed") return { t: "需要处理", tone: "warn" };
    if (playbookDone(pb.id)) return { t: "已完成", tone: "ok" };
    if (!state.rtStarted[pb.id]) return { t: "未开始", tone: "muted" };
    const cur = state.rtCur[pb.id] ?? 0;
    const step = pb.steps[cur];
    if (!step) return { t: "已完成", tone: "ok" };
    if (state.rtBusy === pb.id) return { t: `执行中 · ${cur + 1}/${pb.steps.length}`, tone: "ok" };
    if (step.k === "ask") return { t: "等你回答", tone: "warn" };
    if (step.k === "ap") {
      const needExpert = step.by === "expert" && state.agentAs === "client";
      return needExpert
        ? { t: `等待 ${step.who}`, tone: "warn" }
        : { t: "等你确认", tone: "warn" };
    }
    return { t: `执行中 · ${cur + 1}/${pb.steps.length}`, tone: "ok" };
  }

  function playbookSub(pb) {
    const stage = goldenStage(pb.id);
    if (stage?.state === "blocked") return "存在前置阻断";
    if (stage?.state === "waiting_human") return `等待 ${stage.assignee || "具名处理人"}`;
    if (playbookDone(pb.id)) return "已完成";
    if (!state.rtStarted[pb.id]) return pb.who;
    const cur = state.rtCur[pb.id] ?? 0;
    const step = pb.steps[cur];
    if (!step) return "已完成";
    if (step.k === "ask") return "等你回答";
    if (step.k === "ap") return `等 ${step.who} 确认`;
    return `步骤 ${cur + 1}/${pb.steps.length}`;
  }

  function kindLabel(k) {
    return { auto: "Agent", bg: "Agent · 后台", ask: "需要你回答", ap: "需要确认" }[k] || "Agent";
  }

  function openAgent(opts = {}) {
    ensureAgentState();
    const pbId = opts.playbookId || (opts.chat ? "chat" : preferredPlaybookId()) || "chat";
    state.agentOpen = true;
    returnFocus = document.activeElement;
    focusOnOpen = true;
    state.agentPb = pbId;
    if (opts.dock != null) state.agentDock = Boolean(opts.dock);
    if (pbId !== "chat" && !state.rtStarted[pbId] && opts.autostart) {
      state.rtStarted[pbId] = true;
      state.rtCur[pbId] = 0;
    }
    renderAgentRuntime();
    syncAgentTopbar();
  }

  function closeAgent() {
    questionSequence += 1;
    if (activeQuestionAbort) activeQuestionAbort.abort();
    state.agentOpen = false;
    renderAgentRuntime();
    syncAgentTopbar();
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
  }

  function toggleAgent() {
    if (state.agentOpen) closeAgent();
    else openAgent({ chat: true });
  }

  function syncAgentTopbar() {
    const btn = document.getElementById("agentTopbarBtn");
    if (!btn) return;
    const live = Boolean(state.rtBusy || state.agentBusy);
    btn.classList.toggle("is-open", Boolean(state.agentOpen));
    btn.classList.toggle("is-live", live);
    btn.setAttribute("aria-pressed", state.agentOpen ? "true" : "false");
  }

  function agentBtnHtml() {
    ensureAgentState();
    const live = Boolean(state.rtBusy || state.agentBusy);
    return `<button type="button" class="agent-topbar-btn${state.agentOpen ? " is-open" : ""}${live ? " is-live" : ""}" id="agentTopbarBtn" data-agent-action="toggle" aria-pressed="${state.agentOpen ? "true" : "false"}" title="Lumino Agent">
      <span class="agent-topbar-btn__icon" aria-hidden="true">✦</span>Agent${live ? '<span class="agent-topbar-btn__dot" aria-hidden="true"></span>' : ""}
    </button>`;
  }

  function agentPageAction(label = "用 Agent 完成") {
    const pbId = preferredPlaybookId();
    if (!pbId) return "";
    const pb = PBM()[pbId];
    if (!pb) return "";
    return `<button type="button" class="button button--secondary button--sm agent-page-cta" data-agent-action="open-pb" data-agent-pb="${safe(pbId)}"><span aria-hidden="true">✦</span> ${safe(label)}</button>`;
  }

  function resolveReply(q) {
    const entry = AG_REPLY()[q];
    if (!entry) return null;
    return typeof entry === "function" ? entry(state) : entry;
  }

  function localQuestionFallback(reason) {
    return {
      text: "暂时无法连接模型，但你仍可继续工作：先说明你要处理的对象、期间和期望产出，再从话题目录选择最接近的阶段。此回复没有执行工作流操作。",
      sourceLabel: `本地回退 · ${reason || "model_unavailable"}`,
    };
  }

  async function requestOpenAnswer(q) {
    if (activeQuestionAbort) activeQuestionAbort.abort();
    const controller = new AbortController();
    activeQuestionAbort = controller;
    const timer = window.setTimeout(() => controller.abort(), 18000);
    try {
      const history = (state.agentMsgs || []).slice(-6).map((message) => ({ role: message.me ? "user" : "assistant", text: message.text }));
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ text: q, lang: "zh", asOf: "2026-11-12", history }),
        signal: controller.signal,
      });
      if (!response.ok) return localQuestionFallback(`http_${response.status}`);
      const payload = await response.json();
      if (!payload?.answer) return localQuestionFallback("empty_response");
      const source = payload.runtime?.source || payload.answer_mode || "advisor_api";
      return { text: payload.answer, sourceLabel: `Agent API · ${source}`, tools: [], prop: null };
    } catch (error) {
      return localQuestionFallback(controller.signal.aborted ? "timeout_or_cancelled" : "network_error");
    } finally {
      window.clearTimeout(timer);
      if (activeQuestionAbort === controller) activeQuestionAbort = null;
    }
  }

  function pushLog(k, t) {
    state.agentLog = [[k, t], ...(state.agentLog || [])].slice(0, 40);
  }

  async function agentAsk(raw) {
    const q = String(raw || "").trim();
    if (!q) return;
    const sequence = ++questionSequence;
    if (activeQuestionAbort) activeQuestionAbort.abort();
    ensureAgentState();
    state.agentPb = "chat";
    state.agentMsgs = [...state.agentMsgs, { me: true, text: q }];
    state.agentInput = "";
    state.agentBusy = true;
    if (typeof persistPortalState === "function") persistPortalState();
    renderAgentRuntime();
    const fixed = resolveReply(q);
    const reply = fixed
      ? await new Promise((resolve) => window.setTimeout(() => resolve({ ...fixed, sourceLabel: "预置回答 · 未执行工作流" }), 1000 + Math.floor(Math.random() * 3001)))
      : await requestOpenAnswer(q);
    if (sequence !== questionSequence) return;
    state.agentBusy = false;
    state.agentMsgs = [...state.agentMsgs, {
      me: false,
      text: reply.text,
      tools: reply.tools || [],
      sourceLabel: reply.sourceLabel || "Agent",
      prop: reply.prop || null,
      done: null,
    }];
    pushLog("问答", `${q} · ${reply.sourceLabel || "Agent"}`);
    if (typeof persistPortalState === "function") persistPortalState();
    renderAgentRuntime();
  }

  function advancePlaybook(pbId) {
    const pb = PBM()[pbId];
    if (!pb) return;
    let cur = state.rtCur[pbId] ?? 0;
    cur += 1;
    if (cur >= pb.steps.length) {
      state.rtDone[pbId] = playbookDone(pbId);
      state.rtCur[pbId] = pb.steps.length;
      state.rtBusy = null;
      if (state.rtDone[pbId]) finishPlaybook(pb);
      else pushLog("等待", goldenStage(pbId)?.recovery || "等待具名处理人完成下一个门槛。");
      renderAgentRuntime();
      return;
    }
    state.rtCur[pbId] = cur;
    runAutoSteps(pbId);
  }

  function finishPlaybook(pb) {
    pushLog("完成", pb.title);
    if (pb.id === "p03") {
      state.prodDec = { ...(state.prodDec || {}), p1: "in", p2: "out", p3: "in" };
    }
    if (typeof persistPortalState === "function") persistPortalState();
    if (typeof render === "function") render();
    if (Array.isArray(pb.toast) && pb.toast[0] && typeof toast === "function") {
      toast(pb.toast[0] + (pb.toast[1] ? ` · ${pb.toast[1]}` : ""));
    }
  }

  function runAutoSteps(pbId) {
    const pb = PBM()[pbId];
    if (!pb || state.rtDone[pbId]) return;
    const cur = state.rtCur[pbId] ?? 0;
    const step = pb.steps[cur];
    if (!step) return;
    if (step.k === "ask" || step.k === "ap") {
      state.rtBusy = null;
      renderAgentRuntime();
      return;
    }
    state.rtBusy = pbId;
    renderAgentRuntime();
    const delay = step.k === "bg" ? 900 : 520;
    window.setTimeout(() => {
      if (state.rtBusy !== pbId) return;
      pushLog(step.k === "bg" ? "后台" : "自动", step.t);
      advancePlaybook(pbId);
    }, delay);
  }

  function startPlaybook(pbId) {
    ensureAgentState();
    state.agentPb = pbId;
    if (goldenIds.has(pbId)) {
      const stage = goldenStage(pbId);
      if (stage?.state === "blocked" || stage?.state === "failed") {
        if (typeof toast === "function") toast(stage.recovery || "请先处理当前阻断。");
        renderAgentRuntime();
        return;
      }
      if (pbId === "p07" && !cbamGoldenPath.snapshot().run) {
        try { cbamGoldenPath.command("p07", "calculate", { name: "CBAM Calculation Engine", role: "system" }); }
        catch (error) { if (typeof toast === "function") toast(error.message); renderAgentRuntime(); return; }
      }
    }
    state.rtStarted[pbId] = true;
    state.rtDone[pbId] = false;
    state.rtCur[pbId] = 0;
    state.rtAns[pbId] = {};
    state.agentTab = "art";
    if (typeof persistPortalState === "function") persistPortalState();
    runAutoSteps(pbId);
  }

  function answerStep(pbId, opt) {
    const pb = PBM()[pbId];
    if (!pb) return;
    const cur = state.rtCur[pbId] ?? 0;
    state.rtAns[pbId] = { ...(state.rtAns[pbId] || {}), [cur]: opt };
    pushLog("回答", opt);
    if (typeof persistPortalState === "function") persistPortalState();
    advancePlaybook(pbId);
  }

  function approveStep(pbId) {
    const pb = PBM()[pbId];
    if (!pb) return;
    const cur = state.rtCur[pbId] ?? 0;
    const step = pb.steps[cur];
    try {
      if (pbId === "p06") cbamGoldenPath.command("p06", "confirm", currentActor());
      if (pbId === "p07" && step?.by === "expert") cbamGoldenPath.command("p07", "review", currentActor());
      if (pbId === "p07" && step?.by === "client") {
        const stage = goldenStage("p07");
        if (stage?.code === "REVIEW_REQUIRED") throw Object.assign(new Error("需要由李娜先完成独立复核。"), { code: "REVIEW_REQUIRED" });
        if (stage?.code === "APPROVAL_REQUIRED") {
          if (typeof persistPortalState === "function") persistPortalState();
          if (typeof toast === "function") toast("审批 AP-2026-014 正在等待赵海峰处理。");
        }
      }
      if (pbId === "p08") cbamGoldenPath.command("p08", "package", currentActor());
    } catch (error) {
      pushLog("被拒绝", error.message);
      if (typeof toast === "function") toast(error.recovery || error.message);
      renderAgentRuntime();
      return;
    }
    pushLog("确认", step?.t || pb.title);
    if (typeof persistPortalState === "function") persistPortalState();
    advancePlaybook(pbId);
  }

  function agentActFromProp(act) {
    const routes = {
      products: () => { state.currentService = "cbam"; state.page = "products"; },
      data: () => { state.currentService = "cbam"; state.page = "data"; },
      energy: () => { state.currentService = "cbam"; state.page = "data"; },
      results: () => { state.currentService = "cbam"; state.page = "results"; },
      deliver: () => { state.currentService = "cbam"; state.page = "deliverables"; },
      cbamWork: () => { state.currentService = "cbam"; state.page = "work"; },
      fnd: () => { state.currentService = "cbam"; state.page = "data"; },
      setupDocs: () => { state.currentService = "cbam"; state.page = "work"; },
      fix9: () => { state.currentService = "cbam"; state.page = "data"; },
    };
    const go = routes[act];
    if (go) {
      go();
      if (typeof persistPortalState === "function") persistPortalState();
      if (typeof render === "function") render();
      closeAgent();
    } else if (typeof toast === "function") {
      toast("原型已记录该提议；对应页面动作后续细化。");
    }
  }

  function goPlaybookPage(pb) {
    if (!pb?.page) return;
    if (["products", "data", "results", "deliverables", "roadmap", "work"].includes(pb.page)) {
      state.currentService = "cbam";
    }
    if (pb.page === "org-settings") {
      state.currentService = null;
      state.settingsSection = "members";
    }
    if (pb.page === "services") {
      state.currentService = null;
      state.page = "services";
    } else {
      state.page = pb.page;
    }
    if (typeof persistPortalState === "function") persistPortalState();
    if (typeof render === "function") render();
    renderAgentRuntime();
  }

  function renderLeft(pbActive) {
    const groups = [0, 1, 2].map((grp) => {
      const items = PLAYBOOKS().filter((p) => p.grp === grp).map((p) => {
        const on = state.agentPb === p.id;
        const done = playbookDone(p.id);
        const mark = done ? "✓" : p.n.replace(/^0/, "") || p.n;
        return `
          <button type="button" class="rt-pb-item${on ? " is-on" : ""}${done ? " is-done" : ""}" data-agent-action="select-pb" data-agent-pb="${safe(p.id)}">
            <span class="rt-pb-item__mark" aria-hidden="true">${mark}</span>
            <strong>${safe(p.title)}</strong>
            <small>${safe(playbookSub(p))}</small>
          </button>`;
      }).join("");
      return `<div class="rt-pb-group"><small>${safe(GRP_LABELS()[grp])}</small>${items}</div>`;
    }).join("");

    const chatOn = state.agentPb === "chat";
    const tools = state.agentAs === "expert"
      ? ["读取文件", "结构化提取", "编辑监测计划", "运行计算", "复核签名", "起草回复"]
      : ["读取文件", "结构化提取", "跨期比对", "起草消息", "提议写入"];

    return `
      <aside class="rt-left">
        <button type="button" class="rt-chat-item${chatOn ? " is-on" : ""}" data-agent-action="select-pb" data-agent-pb="chat">
          <span>自由对话 · 当前页面</span><small>问答</small>
        </button>
        ${groups}
        <div class="rt-tools">
          <small>${state.agentAs === "expert" ? "专家可用工具" : "可用工具"}</small>
          <span class="rt-tools__list">${tools.map((t) => `<span>${safe(t)}</span>`).join("")}</span>
        </div>
      </aside>`;
  }

  function renderChatCenter() {
    const sugs = (AG_SUG()[state.page] || AG_SUG()._ || []).map((q) => `
      <button type="button" class="rt-sug" data-agent-action="ask" data-agent-q="${safe(q)}"><span>${safe(q)}</span><span aria-hidden="true">→</span></button>`).join("");
    const msgs = (state.agentMsgs || []).map((m, i) => {
      if (m.me) return `<div class="rt-msg rt-msg--me">${safe(m.text)}</div>`;
      const tools = (m.tools || []).length
        ? `<div class="rt-msg__tools">${m.tools.map((t) => `<span>✓ ${safe(t)}</span>`).join("")}</div>`
        : "";
      let prop = "";
      if (m.prop && !m.done) {
        const rows = (m.prop.rows || []).map(([k, v]) => `<div><dt>${safe(k)}</dt><dd>${safe(v)}</dd></div>`).join("");
        prop = `<div class="rt-prop${m.prop.write ? " is-write" : ""}">
          <small>${safe(m.prop.k)}</small>
          <strong>${safe(m.prop.t)}</strong>
          ${rows ? `<dl>${rows}</dl>` : ""}
          <div class="rt-prop__actions">
            <button type="button" class="button button--primary button--sm" data-agent-action="prop-act" data-agent-act="${safe(m.prop.act || "")}" data-agent-msg="${i}">${safe(m.prop.btn || "打开")}</button>
            <button type="button" class="button button--secondary button--sm" data-agent-action="prop-ignore" data-agent-msg="${i}">忽略</button>
          </div>
        </div>`;
      } else if (m.prop && m.done) {
        prop = `<div class="rt-prop is-done"><small>${safe(m.done)}</small><strong>${safe(m.prop.t)}</strong></div>`;
      }
      return `<div class="rt-msg rt-msg--agent">${m.sourceLabel ? `<small class="rt-msg__source">${safe(m.sourceLabel)}</small>` : ""}${tools}<span class="rt-msg__text">${safe(m.text)}</span>${prop}</div>`;
    }).join("");

    return `
      <div class="rt-chat-head">
        <strong>在当前页面的上下文中提问</strong>
        <span>上下文：${safe(agentCtxLabel())}。要完成一整件事，从左侧选择一个 CBAM 阶段，Agent 会按步骤执行，并在需要你回答或确认时停下来。</span>
      </div>
      ${!(state.agentMsgs || []).length ? `<div class="rt-sug-list">${sugs}</div>` : ""}
      <div class="rt-msg-list">${msgs}</div>
      ${state.agentBusy ? '<div class="rt-busy" aria-live="polite">运行中…</div>' : ""}`;
  }

  function renderPlaybookCenter(pb) {
    const started = Boolean(state.rtStarted[pb.id]);
    const done = playbookDone(pb.id);
    const cur = state.rtCur[pb.id] ?? 0;
    const grp = GRP_LABELS()[pb.grp] || "";
    const intro = `
      <div class="rt-pb-card">
        <small>阶段 ${safe(pb.n)} · ${safe(grp)} · ${safe(pb.who)}</small>
        <strong>${safe(pb.title)}</strong>
        <span>${safe(pb.goal)}</span>
        <div class="rt-pb-facts">
          <div><small>需要的输入</small>${pb.inputs.map((t) => `<span>· ${safe(t)}</span>`).join("")}</div>
          <div><small>会产出</small>${pb.outputs.map((t) => `<span>· ${safe(t)}</span>`).join("")}</div>
          <div><small>需要人确认</small>${pb.checks.map((t) => `<span>· ${safe(t)}</span>`).join("")}</div>
        </div>
        ${!started ? `<div class="rt-pb-card__actions">
          <button type="button" class="button button--primary" data-agent-action="start-pb" data-agent-pb="${safe(pb.id)}">开始执行</button>
          <button type="button" class="button button--secondary" data-agent-action="go-page" data-agent-pb="${safe(pb.id)}">在页面上手动完成</button>
        </div>` : ""}
      </div>`;

    const steps = started ? pb.steps.map((st, i) => {
      const past = done || i < cur;
      const current = !done && i === cur;
      const future = !done && i > cur;
      const ans = (state.rtAns[pb.id] || {})[i];
      const busy = current && state.rtBusy === pb.id && (st.k === "auto" || st.k === "bg");
      let mark = past ? "✓" : String(i + 1);
      if (busy) mark = "";
      const askOpen = current && st.k === "ask" && !ans;
      const apOpen = current && st.k === "ap";
      const needExpert = st.by === "expert" && state.role !== "reviewer";
      const namedClient = st.by !== "expert" && roleConfig[state.role]?.name === st.who;
      const canAp = apOpen && (st.by === "expert" ? !needExpert : namedClient);
      const cantAp = apOpen && !canAp;
      return `
        <div class="rt-step${current ? " is-current" : ""}${past ? " is-past" : ""}${future ? " is-future" : ""}">
          <span class="rt-step__mark${busy ? " is-spin" : ""}" aria-hidden="true">${busy ? "" : mark}</span>
          <div class="rt-step__body">
            <div class="rt-step__title">
              <strong>${safe(st.t)}</strong>
              <small class="rt-step__kind">${safe(kindLabel(st.k))}</small>
              ${st.by === "expert" ? `<small class="rt-step__by">Lumino · ${safe(st.who || "专家")}</small>` : ""}
            </div>
            ${st.tool && (past || current) ? `<span class="rt-step__tool">${safe(st.tool)}</span>` : ""}
            ${ans ? `<span class="rt-step__answer">你的回答：${safe(ans)}</span>` : ""}
            ${(past || (current && !busy && (st.k === "auto" || st.k === "bg"))) && st.r ? `<span class="rt-step__result">${safe(st.r)}</span>` : ""}
            ${askOpen ? `<div class="rt-ask">${st.opts.map((o) => `
              <button type="button" data-agent-action="answer" data-agent-pb="${safe(pb.id)}" data-agent-opt="${safe(o)}"><i aria-hidden="true"></i>${safe(o)}</button>`).join("")}</div>` : ""}
            ${apOpen ? `<div class="rt-ap">
              <div class="rt-ap__body">
                <small>需要 ${safe(st.who)} 确认 · 确认后写入审计记录</small>
                <span>${safe(st.d)}</span>
              </div>
              <div class="rt-ap__foot">
                ${canAp ? `<button type="button" class="button button--primary button--sm" data-agent-action="approve" data-agent-pb="${safe(pb.id)}">${safe(st.btn || "确认")}</button><span class="rt-ap__hint">「变更集」列出将提交的改动</span>` : ""}
                ${cantAp ? `<span class="rt-ap__wait">等待 Lumino ${safe(st.who)} 处理。客户只看到结果。</span>
                  <span class="rt-ap__wait">演示视角不会授予操作权限。</span>` : ""}
              </div>
            </div>` : ""}
            ${past && st.k === "ap" ? `<span class="rt-step__approved">✓ 已由 ${safe(st.who)} 确认</span>` : ""}
          </div>
        </div>`;
    }).join("") : "";

    const nextPb = PLAYBOOKS().find((p) => Number(p.n) === Number(pb.n) + 1);
    const doneBar = done ? `
      <div class="rt-done">
        <span><strong>已完成：${safe(pb.title)}</strong><small>${safe((pb.toast && pb.toast[1]) || "结果已写入变更集，可在页面上查看。")}</small></span>
        ${nextPb ? `<button type="button" class="button button--primary button--sm" data-agent-action="select-pb" data-agent-pb="${safe(nextPb.id)}">下一步：${safe(nextPb.title)} →</button>` : ""}
        <button type="button" class="button button--secondary button--sm" data-agent-action="go-page" data-agent-pb="${safe(pb.id)}">在页面上查看</button>
      </div>` : "";

    return `${intro}${steps}${doneBar}`;
  }

  function renderRight(pb) {
    const tabs = [
      ["art", "产物", null],
      ["chg", "变更集", pb ? String((pb.changes || []).length) : null],
      ["src", "依据", pb ? String((pb.sources || []).length) : null],
      ["log", "日志", null],
    ];
    const tabBtns = tabs.map(([id, label, badge]) => `
      <button type="button" role="tab" id="rt-tab-${id}" aria-selected="${state.agentTab === id ? "true" : "false"}" aria-controls="rt-panel-${id}" class="${state.agentTab === id ? "is-on" : ""}" data-agent-action="tab" data-agent-tab="${id}">
        ${safe(label)}${badge ? `<span class="rt-tab-badge">${safe(badge)}</span>` : ""}
      </button>`).join("");

    let body = "";
    if (state.agentTab === "art") {
      if (!pb) {
        body = `<p class="rt-right__hint">选择左侧阶段后，这里显示将生成的产物表。自由对话不会自动改写页面数据。</p>`;
      } else {
        const st = playbookDone(pb.id) ? "已确认" : state.rtStarted[pb.id] ? "草稿" : "未生成";
        const tone = playbookDone(pb.id) ? "ok" : state.rtStarted[pb.id] ? "warn" : "muted";
        const cols = (pb.art?.cols || []).map((c) => `<span>${safe(c)}</span>`).join("");
        const rows = (pb.art?.rows || []).map((r) => {
          const cells = r.map((c) => `<span>${safe(c === "warn" ? "" : c)}</span>`).join("");
          return `<div class="rt-art__row" style="grid-template-columns:${safe(pb.art.grid)}">${cells}</div>`;
        }).join("");
        body = `
          <div class="rt-art__head"><strong>${safe(pb.art?.title || pb.title)}</strong><span class="status-chip ${tone === "ok" ? "" : tone}">${st}</span></div>
          <div class="rt-art">
            <div class="rt-art__cols" style="grid-template-columns:${safe(pb.art?.grid || "1fr")}">${cols}</div>
            ${rows}
          </div>
          <button type="button" class="button button--secondary button--sm" data-agent-action="go-page" data-agent-pb="${safe(pb.id)}">在页面上打开 · 可直接编辑</button>`;
      }
    } else if (state.agentTab === "chg") {
      const list = (pb?.changes || []).map((t) => {
        const submitted = Boolean(pb && playbookDone(pb.id));
        return `<span class="rt-chg-row"><span>${safe(t)}</span><small class="${submitted ? "is-ok" : ""}">${submitted ? "已提交" : "待确认后提交"}</small></span>`;
      }).join("") || `<p class="rt-right__hint">尚无变更。</p>`;
      body = `<p class="rt-right__hint">Agent 不直接写入。以下改动在对应确认步骤通过后提交，并记录为「确认人 · Agent 提议」。</p><div class="rt-chg">${list}</div>`;
    } else if (state.agentTab === "src") {
      const list = (pb?.sources || []).map((t) => `<span class="rt-src-row"><span aria-hidden="true">▢</span>${safe(t)}</span>`).join("")
        || `<p class="rt-right__hint">选择阶段后显示证据来源。</p>`;
      body = `<p class="rt-right__hint">Agent 的每个结论都链接到这些来源。原文件只读，保存为证据。</p><div class="rt-src">${list}</div>`;
    } else {
      const logs = (state.agentLog || []).map(([k, t]) => `<span class="rt-log-row"><b>${safe(k)}</b><span>${safe(t)}</span></span>`).join("")
        || `<span class="rt-log-row"><b>就绪</b><span>等待你选择阶段或提问</span></span>`;
      body = `<div class="rt-log">${logs}</div>
        <div class="rt-wont">
          <strong>Agent 不会做的事</strong>
          确认企业数据、签收监测计划、锁定计算、专家复核签名、共享或撤回数据包。这些只能由有权限的人在确认卡片中完成。
        </div>`;
    }

    return `
      <aside class="rt-right">
        <div class="rt-tabs" role="tablist">${tabBtns}</div>
        <div class="rt-right__body" id="rt-panel-${state.agentTab}" role="tabpanel" aria-labelledby="rt-tab-${state.agentTab}">${body}</div>
      </aside>`;
  }

  function renderMobileBar() {
    const options = [`<option value="chat"${state.agentPb === "chat" ? " selected" : ""}>自由对话</option>`]
      .concat(PLAYBOOKS().map((pb) => `<option value="${safe(pb.id)}"${state.agentPb === pb.id ? " selected" : ""}>${safe(pb.n)} · ${safe(pb.title)}</option>`)).join("");
    return `<div class="rt-mobile-bar">
      <label><span>话题</span><select data-agent-playbook-select aria-label="选择 Agent 话题">${options}</select></label>
      <span class="rt-mobile-views" role="radiogroup" aria-label="Agent 面板">
        <button type="button" role="radio" aria-checked="${state.agentMobileView === "conversation"}" class="${state.agentMobileView === "conversation" ? "is-on" : ""}" data-agent-action="mobile-view" data-agent-mobile-view="conversation">对话</button>
        <button type="button" role="radio" aria-checked="${state.agentMobileView === "details"}" class="${state.agentMobileView === "details" ? "is-on" : ""}" data-agent-action="mobile-view" data-agent-mobile-view="details">产物与日志</button>
      </span>
    </div>`;
  }

  function renderComposer(pb) {
    const mode = state.agentMode || "ask";
    const modes = [
      ["ask", "问答"],
      ["run", "执行任务"],
      ["draft", "仅起草"],
    ].map(([id, label]) => `
      <button type="button" role="radio" aria-checked="${mode === id ? "true" : "false"}" class="${mode === id ? "is-on" : ""}" data-agent-action="mode" data-agent-mode="${id}">${label}</button>`).join("");
    const hints = {
      ask: "只回答问题，不产生任何改动",
      run: "多步骤执行；所有写入进入变更集，由你提交后生效",
      draft: "只生成草稿，不触碰数据",
    };
    const who = `当前登录：${roleConfig[state.role]?.name || "未知用户"} · 演示视角只改变展示，不改变权限`;
    const pills = ((state.agentPb === "chat" ? (AG_SUG()[state.page] || AG_SUG()._) : (AG_SUG()[pb?.page] || AG_SUG()._)) || [])
      .slice(0, 3)
      .map((q) => `<button type="button" class="rt-pill" data-agent-action="ask" data-agent-q="${safe(q)}">${safe(q)}</button>`)
      .join("");

    return `
      <div class="rt-composer">
        <div class="rt-pills">${pills}</div>
        <div class="rt-input">
          <textarea id="agentInput" rows="2" placeholder="继续对话，或让 Agent 解释、比对、起草…">${safe(state.agentInput || "")}</textarea>
          <div class="rt-input__bar">
            <button type="button" class="rt-attach" data-agent-action="attach">＋ 文件</button>
            <span class="rt-spacer"></span>
            <span class="rt-modes" role="radiogroup" aria-label="模式">${modes}</span>
            <button type="button" class="button button--primary button--sm" data-agent-action="send">发送</button>
          </div>
        </div>
        <small class="rt-composer__hint">${safe(hints[mode])} · ${safe(who)}</small>
      </div>`;
  }

  function renderAgentRuntime() {
    ensureAgentState();
    const layer = document.getElementById("agentRuntimeLayer");
    if (!layer) return;
    if (!state.loggedIn || !state.agentOpen || !isCustomer()) {
      layer.hidden = true;
      layer.innerHTML = "";
      syncAgentTopbar();
      return;
    }

    const pb = state.agentPb !== "chat" ? PBM()[state.agentPb] : null;
    const status = agentStatusChip(pb);
    const dock = Boolean(state.agentDock);
    const title = pb ? `${pb.n} · ${pb.title}` : "自由对话";
    const asOpts = [
      ["client", "客户 · 周岚"],
      ["expert", "专家 · 王晨"],
    ].map(([id, label]) => `
      <button type="button" role="radio" aria-checked="${state.agentAs === id ? "true" : "false"}" class="${state.agentAs === id ? "is-on" : ""}" data-agent-action="as" data-agent-as="${id}">${label}</button>`).join("");

    layer.hidden = false;
    layer.className = `agent-runtime-layer${dock ? " is-dock" : " is-modal"}${state.agentMobileView === "details" ? " is-mobile-right" : ""}`;
    layer.innerHTML = `
      ${dock ? "" : '<button type="button" class="rt-backdrop" data-agent-action="close" aria-label="关闭 Agent"></button>'}
      <div class="rt-dialog" role="dialog" aria-modal="${dock ? "false" : "true"}" aria-label="Lumino Agent Runtime">
        <header class="rt-head">
          <span class="rt-head__mark" aria-hidden="true">✦</span>
          <strong class="rt-head__brand">Lumino Agent</strong>
          <span class="rt-head__sep" aria-hidden="true"></span>
          <strong class="rt-head__title">${safe(title)}</strong>
          <span class="status-chip ${status.tone === "ok" ? "" : status.tone === "warn" ? "warn" : "locked"}">${safe(status.t)}</span>
          <span class="rt-spacer"></span>
          ${dock ? `<button type="button" class="button button--secondary button--sm" data-agent-action="panel-swap">${state.agentTab === "art" ? "产物 · 变更集" : "回到对话"}</button>` : ""}
          ${!dock ? `<span class="rt-as" role="radiogroup" aria-label="演示视角"><small>演示视角</small>${asOpts}</span>` : ""}
          <button type="button" class="button button--secondary button--sm" data-agent-action="dock">${dock ? "展开 ⤢" : "收为侧栏"}</button>
          <button type="button" class="rt-close" data-agent-action="close" aria-label="关闭">×</button>
        </header>
        ${renderMobileBar()}
        <div class="rt-grid">
          ${renderLeft(pb)}
          <div class="rt-center">
            <div class="rt-body" id="rtBody">
              ${pb ? renderPlaybookCenter(pb) : renderChatCenter()}
            </div>
            ${renderComposer(pb)}
          </div>
          ${renderRight(pb)}
        </div>
      </div>`;
    syncAgentTopbar();
    const body = document.getElementById("rtBody");
    if (body) body.scrollTop = body.scrollHeight;
    if (focusOnOpen && !dock) {
      focusOnOpen = false;
      layer.querySelector(".rt-close")?.focus();
    }
  }

  function handleAgentChange(event) {
    const select = event.target.closest("[data-agent-playbook-select]");
    if (!select) return false;
    state.agentPb = select.value || "chat";
    state.agentMobileView = "conversation";
    if (state.agentPb !== "chat") state.agentTab = "art";
    if (typeof persistPortalState === "function") persistPortalState();
    renderAgentRuntime();
    return true;
  }

  function trapFocus(event) {
    if (!state.agentOpen || state.agentDock || event.key !== "Tab") return false;
    const dialog = document.querySelector("#agentRuntimeLayer .rt-dialog");
    if (!dialog) return false;
    const nodes = [...dialog.querySelectorAll('button:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!nodes.length) return false;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); return true; }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); return true; }
    return false;
  }

  function handleAgentEvent(event) {
    const el = event.target.closest("[data-agent-action]");
    if (!el) return false;
    const action = el.dataset.agentAction;
    ensureAgentState();

    if (action === "toggle") { toggleAgent(); return true; }
    if (action === "close") { closeAgent(); return true; }
    if (action === "dock") {
      state.agentDock = !state.agentDock;
      renderAgentRuntime();
      return true;
    }
    if (action === "open-pb") {
      openAgent({ playbookId: el.dataset.agentPb || preferredPlaybookId() });
      return true;
    }
    if (action === "select-pb") {
      state.agentPb = el.dataset.agentPb || "chat";
      if (state.agentPb !== "chat") state.agentTab = "art";
      renderAgentRuntime();
      return true;
    }
    if (action === "start-pb") {
      startPlaybook(el.dataset.agentPb);
      return true;
    }
    if (action === "answer") {
      answerStep(el.dataset.agentPb, el.dataset.agentOpt);
      return true;
    }
    if (action === "approve") {
      approveStep(el.dataset.agentPb);
      return true;
    }
    if (action === "as") {
      state.agentAs = el.dataset.agentAs || "client";
      renderAgentRuntime();
      return true;
    }
    if (action === "tab") {
      state.agentTab = el.dataset.agentTab || "art";
      renderAgentRuntime();
      return true;
    }
    if (action === "panel-swap") {
      state.agentTab = state.agentTab === "art" ? "chg" : "art";
      renderAgentRuntime();
      return true;
    }
    if (action === "mobile-view") {
      state.agentMobileView = el.dataset.agentMobileView || "conversation";
      renderAgentRuntime();
      return true;
    }
    if (action === "mode") {
      state.agentMode = el.dataset.agentMode || "ask";
      renderAgentRuntime();
      return true;
    }
    if (action === "ask") {
      agentAsk(el.dataset.agentQ);
      return true;
    }
    if (action === "send") {
      sendComposer();
      return true;
    }
    if (action === "attach") {
      if (typeof toast === "function") toast("原型中可先在页面上传材料；Agent 会引用已上传证据。");
      return true;
    }
    if (action === "go-page") {
      goPlaybookPage(PBM()[el.dataset.agentPb]);
      return true;
    }
    if (action === "prop-act") {
      const idx = Number(el.dataset.agentMsg);
      if (Number.isFinite(idx) && state.agentMsgs[idx]) state.agentMsgs[idx].done = "已打开";
      agentActFromProp(el.dataset.agentAct);
      return true;
    }
    if (action === "prop-ignore") {
      const idx = Number(el.dataset.agentMsg);
      if (Number.isFinite(idx) && state.agentMsgs[idx]) state.agentMsgs[idx].done = "已忽略";
      renderAgentRuntime();
      return true;
    }
    return false;
  }

  function sendComposer() {
    const input = document.getElementById("agentInput");
    agentAsk(input ? input.value : state.agentInput);
  }

  window.LuminoAgentRuntime = {
    openAgent,
    closeAgent,
    toggleAgent,
    renderAgentRuntime,
    handleAgentEvent,
    handleAgentChange,
    trapFocus,
    agentBtnHtml,
    agentPageAction,
    preferredPlaybookId,
    syncAgentTopbar,
    ensureAgentState,
    sendComposer,
  };
})();
