(function (root) {
  "use strict";

  const SESSION_KEY = "lumino.advisor.state.v1";
  const i18n = root.LuminoI18n || { detectLang: () => "zh" };
  let panel = null;
  let trigger = null;
  let history = [];
  let runtimeFlags = { public_beta: true, lead_capture: false };

  function trackMetric(payload) {
    try {
      const body = JSON.stringify(payload || {});
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/advisor-metrics", blob);
        return;
      }
      fetch("/api/advisor-metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  }

  function lang() { return i18n.detectLang() === "en" ? "en" : "zh"; }
  function label(zh, en) { return lang() === "en" ? en : zh; }
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.origin);
      if (url.origin !== location.origin) return "#";
      return `${url.pathname}${url.search}${url.hash}`;
    } catch (_) { return "#"; }
  }

  function loadState() {
    try {
      const state = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (state && Array.isArray(state.history)) {
        history = state.history.filter((item) => item?.topicId && item?.response?.answer_mode).slice(-8);
      }
    } catch (_) { history = []; }
  }

  function saveState() {
    try {
      const safeHistory = history.filter((item) => item.topicId && !item.freeText).slice(-8);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ history: safeHistory }));
    } catch (_) {}
  }

  function containsSensitiveInfo(value) {
    const input = String(value || "");
    return /\b1[3-9]\d{9}\b/.test(input) || /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(input) || /\b\d{15,18}[0-9xX]\b/.test(input);
  }

  function initialMarkup() {
    const topics = root.LuminoAdvisor.getTopics(lang());
    return `<section class="advisor-welcome">
      <span class="advisor-welcome__label">${label("公开试用 · 服务引导", "Public beta · service guide")}</span>
      <h2>${label("先说明你正在解决的问题。", "Start with the problem you need to solve.")}</h2>
      <p>${label("可以直接选择话题，也可以输入问题。我们会先给出可执行的说明，并在合适时推荐试算器、知识文章或联系入口。当前版本不收集联系方式或生产资料。", "Choose a topic or type a question. We start with practical guidance and, when useful, suggest a calculator, knowledge article or contact path. This version does not collect contact details or production data.")}</p>
    </section>
    <div class="advisor-topics" aria-label="${label("预选话题", "Suggested topics")}">
      ${topics.map((topic) => `<button class="advisor-topic" type="button" data-topic-id="${escapeHtml(topic.id)}">${escapeHtml(topic.label)}</button>`).join("")}
    </div>`;
  }

  function answerMarkup(response) {
    const mode = response.answer_mode === "tool_route"
      ? label("推荐工具", "Suggested tool")
      : response.answer_mode === "fixed"
        ? label("服务说明", "Guidance")
        : response.answer_mode === "retrieval_model"
          ? label("初步判断", "Preliminary view")
          : label("暂无法确认", "Unable to confirm");
    const replies = (response.suggested_replies || []).map((item) =>
      `<button class="advisor-reply" type="button" data-topic-id="${escapeHtml(response.topic_id || "")}" data-reply-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`
    ).join("");
    const links = (response.links || []).map((item, index) =>
      `<a class="advisor-link ${index === 0 ? "advisor-link--primary" : ""}" href="${escapeHtml(safeUrl(item.url))}" data-advisor-cta="${escapeHtml(item.type || "link")}" data-answer-mode="${escapeHtml(response.answer_mode || "")}">${escapeHtml(item.label)}</a>`
    ).join("");
    const sources = (response.sources || []).map((item) =>
      `<a href="${escapeHtml(safeUrl(item.url))}">${escapeHtml(item.title)} ↗</a>`
    ).join("");
    return `<article class="advisor-turn advisor-turn--assistant">
      <div class="advisor-answer">
        <span class="advisor-answer__mode">${mode}</span>
        <p>${escapeHtml(response.answer)}</p>
        ${response.next_question ? `<p class="advisor-answer__question">${escapeHtml(response.next_question)}</p>` : ""}
        ${replies ? `<div class="advisor-replies">${replies}</div>` : ""}
        ${links ? `<div class="advisor-links">${links}</div>` : ""}
        ${sources ? `<div class="advisor-sources"><span>${label("相关资料", "Related reading")}</span>${sources}</div>` : ""}
      </div>
    </article>`;
  }

  function scrollToLatest() {
    const body = panel.querySelector(".advisor-widget__body");
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function announce(message) {
    const status = panel.querySelector(".advisor-widget__status");
    status.textContent = "";
    requestAnimationFrame(() => { status.textContent = message; });
  }

  async function resolveResponse(request) {
    const payload = { ...request, lang: lang() };
    try {
      const upstream = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (upstream.ok) {
        const data = await upstream.json();
        if (data && data.answer_mode && data.answer) return data;
      }
    } catch (error) {
      const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
      if (timedOut) {
        trackMetric({ type: "client", timeout: true, ok: false, answer_mode: "fallback", source: "error" });
      }
      /* local deterministic router remains the offline fallback */
    }
    return root.LuminoAdvisor.route(payload);
  }

  async function appendExchange(userLabel, request, options) {
    const thread = panel.querySelector(".advisor-thread");
    if (userLabel) thread.insertAdjacentHTML("beforeend", `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(userLabel)}</p></article>`);
    const started = performance.now();
    const response = await resolveResponse(request);
    thread.insertAdjacentHTML("beforeend", answerMarkup(response));
    history.push({ topicId: options?.topicId || request.topicId || "", userLabel, response });
    saveState();
    trackMetric({
      type: "client",
      answer_mode: response.answer_mode,
      source: response.runtime?.source || "",
      handoff: response.handoff,
      has_sources: Boolean(response.sources?.length),
      latency_ms: Math.round(performance.now() - started),
      ok: true,
    });
    announce(response.answer);
    scrollToLatest();
  }

  function showSensitiveWarning() {
    const response = root.LuminoAdvisor.route({ text: "", lang: lang() });
    response.answer = label(
      "输入中可能包含联系方式或证件号码。为避免在公开顾问中提交个人信息，这段内容没有显示或保存。如需联系，请使用受控联系页。",
      "The input may contain contact or identity details. It was not displayed or saved. Use the controlled contact page if you want Lumino to contact you."
    );
    response.next_question = null;
    response.suggested_replies = [];
    panel.querySelector(".advisor-thread").insertAdjacentHTML("beforeend", answerMarkup(response));
    announce(response.answer);
    scrollToLatest();
  }

  function reset() {
    history = [];
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    panel.querySelector(".advisor-thread").innerHTML = initialMarkup();
    panel.querySelector("textarea").value = "";
    announce(label("已重新开始", "Started over"));
  }

  function restoredMarkup() {
    if (!history.length) return initialMarkup();
    return `<section class="advisor-resumed">
      <span>${label("已恢复当前标签页中的对话", "Conversation restored in this tab")}</span>
    </section>${history.map((item) => `${item.userLabel ? `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(item.userLabel)}</p></article>` : ""}${answerMarkup(item.response)}`).join("")}`;
  }

  function mount() {
    if (panel) return panel;
    loadState();
    panel = document.createElement("section");
    panel.className = "advisor-widget";
    panel.id = "lumino-advisor-widget";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "advisor-title");
    panel.innerHTML = `<header class="advisor-widget__head">
      <div>
        ${runtimeFlags.public_beta === false ? "" : `<span class="advisor-widget__beta">${label("公开试用", "Public beta")}</span>`}
        <strong id="advisor-title">${label("Lumino 服务顾问", "Lumino Service Guide")}</strong>
        <p>${label("初步判断，帮助你快速定向；不替代正式合规结论，也不在此收集联系方式或客户文件。", "Preliminary guidance to get oriented — not a formal compliance conclusion, and no contact details or client files are collected here.")}</p>
      </div>
      <div class="advisor-widget__head-actions">
        <button class="advisor-widget__reset" type="button">${label("重新开始", "Start over")}</button>
        <button class="advisor-widget__close" type="button" aria-label="${label("关闭服务顾问", "Close service guide")}">×</button>
      </div>
    </header>
    <div class="advisor-widget__body"><div class="advisor-thread">${restoredMarkup()}</div></div>
    <form class="advisor-widget__composer">
      <textarea name="question" rows="1" maxlength="2000" placeholder="${label("输入你的问题……", "Type your question…")}" aria-label="${label("输入你的问题", "Type your question")}"></textarea>
      <button class="advisor-widget__send" type="submit">${label("发送", "Send")}</button>
    </form>
    <footer class="advisor-widget__foot">${label("对话不会提交给 Lumino，也不会进入线索库；仅保存在本次浏览器标签页。正式咨询请走联系页。", "Chats are not submitted to Lumino or a lead database; they stay in this browser tab only. Use the contact page for a formal consultation.")}</footer>
    <div class="advisor-widget__status" aria-live="polite" aria-atomic="true"></div>`;
    document.body.appendChild(panel);

    panel.querySelector(".advisor-widget__close").addEventListener("click", close);
    panel.querySelector(".advisor-widget__reset").addEventListener("click", reset);
    panel.querySelector(".advisor-thread").addEventListener("click", (event) => {
      const cta = event.target.closest("[data-advisor-cta]");
      if (cta) {
        trackMetric({
          type: "cta",
          cta_type: cta.dataset.advisorCta || "link",
          answer_mode: cta.dataset.answerMode || "",
        });
      }
      const topic = event.target.closest(".advisor-topic[data-topic-id]");
      if (topic) appendExchange(topic.textContent.trim(), { topicId: topic.dataset.topicId }, { topicId: topic.dataset.topicId });
      const reply = event.target.closest("[data-reply-id]");
      if (reply) appendExchange(reply.textContent.trim(), { topicId: reply.dataset.topicId, replyId: reply.dataset.replyId, text: reply.textContent.trim() }, { topicId: reply.dataset.topicId });
    });
    const form = panel.querySelector("form");
    const textarea = panel.querySelector("textarea");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = textarea.value.trim();
      if (!value) return;
      textarea.value = "";
      if (containsSensitiveInfo(value)) return showSensitiveWarning();
      appendExchange(value, { text: value }, { freeText: true });
    });
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !panel.hidden) close();
    });
    return panel;
  }

  function open(options) {
    trigger = options?.trigger || document.activeElement;
    if (options?.flags && typeof options.flags === "object") runtimeFlags = { ...runtimeFlags, ...options.flags };
    const element = mount();
    element.hidden = false;
    const toolRoot = document.querySelector(".tool-float");
    if (toolRoot) toolRoot.hidden = true;
    element.querySelector("textarea").focus({ preventScroll: true });
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    const toolRoot = document.querySelector(".tool-float");
    if (toolRoot) toolRoot.hidden = false;
    if (trigger && typeof trigger.focus === "function") trigger.focus({ preventScroll: true });
  }

  root.LuminoAdvisorWidget = Object.freeze({ open, close, reset });
})(window);
