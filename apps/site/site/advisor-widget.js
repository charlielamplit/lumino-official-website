(function (root) {
  "use strict";

  const SESSION_KEY = "lumino.advisor.state.v1";
  const i18n = root.LuminoI18n || { detectLang: () => "zh" };
  let panel = null;
  let trigger = null;
  let history = [];

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
      <span class="advisor-welcome__label">${label("已发布资料 · 初步分诊", "PUBLISHED GUIDANCE · INITIAL TRIAGE")}</span>
      <h2>${label("先说明你正在解决的问题。", "Start with the problem you need to solve.")}</h2>
      <p>${label("可以直接选择话题，也可以输入问题。固定答案和已有工具优先；当前版本不收集联系方式或生产资料。", "Choose a topic or type a question. Reviewed fixed answers and existing tools come first; this version does not collect contact details or production data.")}</p>
    </section>
    <div class="advisor-topics" aria-label="${label("预选话题", "Suggested topics")}">
      ${topics.map((topic) => `<button class="advisor-topic" type="button" data-topic-id="${escapeHtml(topic.id)}">${escapeHtml(topic.label)}</button>`).join("")}
    </div>`;
  }

  function answerMarkup(response) {
    const mode = response.answer_mode === "tool_route"
      ? label("已匹配现有工具", "Existing tool matched")
      : response.answer_mode === "fixed"
        ? label("已审核固定答案", "Reviewed fixed answer")
        : label("当前无法确认", "Unable to confirm");
    const replies = (response.suggested_replies || []).map((item) =>
      `<button class="advisor-reply" type="button" data-topic-id="${escapeHtml(response.topic_id || "")}" data-reply-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`
    ).join("");
    const links = (response.links || []).map((item, index) =>
      `<a class="advisor-link ${index === 0 ? "advisor-link--primary" : ""}" href="${escapeHtml(safeUrl(item.url))}">${escapeHtml(item.label)}</a>`
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
        ${sources ? `<div class="advisor-sources"><span>${label("来源", "Sources")}</span>${sources}</div>` : ""}
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

  function appendExchange(userLabel, request, options) {
    const thread = panel.querySelector(".advisor-thread");
    if (userLabel) thread.insertAdjacentHTML("beforeend", `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(userLabel)}</p></article>`);
    const response = root.LuminoAdvisor.route({ ...request, lang: lang() });
    thread.insertAdjacentHTML("beforeend", answerMarkup(response));
    history.push({ topicId: options?.topicId || request.topicId || "", userLabel, response });
    saveState();
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
      <div><strong id="advisor-title">${label("Lumino 服务顾问", "Lumino Service Guide")}</strong><p>${label("初步判断，不替代正式合规结论", "Initial guidance, not a formal compliance conclusion")}</p></div>
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
    <div class="advisor-widget__status" aria-live="polite" aria-atomic="true"></div>`;
    document.body.appendChild(panel);

    panel.querySelector(".advisor-widget__close").addEventListener("click", close);
    panel.querySelector(".advisor-widget__reset").addEventListener("click", reset);
    panel.querySelector(".advisor-thread").addEventListener("click", (event) => {
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
