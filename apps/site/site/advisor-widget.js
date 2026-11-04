(function (root) {
  "use strict";

  const SESSION_KEY = "lumino.advisor.state.v1";
  const CLIENT_TIMEOUT_MS = 12000;
  const CHUNK_MS = 28;
  const i18n = root.LuminoI18n || { detectLang: () => "zh" };
  let panel = null;
  let trigger = null;
  let history = [];
  let runtimeFlags = { public_beta: true, lead_capture: false };
  let busy = false;
  let activeAbort = null;
  let printTimer = null;
  let lastRequest = null;
  let lastUserLabel = null;

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
  function prefersReducedMotion() {
    return root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  function modeLabel(response) {
    const ui = response.ui_state || response.runtime?.ui_state;
    if (ui === "unavailable") return label("服务暂时不可用", "Service temporarily unavailable");
    if (ui === "basic_mode") return label("已切换到基础问答", "Switched to basic guidance");
    if (ui === "no_sources" || (response.answer_mode === "fallback" && !response.sources?.length && !ui)) {
      return label("没有足够依据", "Not enough published basis");
    }
    if (response.answer_mode === "tool_route") return label("推荐工具", "Suggested tool");
    if (response.answer_mode === "fixed") return label("服务说明", "Guidance");
    if (response.answer_mode === "retrieval_model") return label("初步判断", "Preliminary view");
    return label("暂无法确认", "Unable to confirm");
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

  function extrasMarkup(response) {
    const replies = (response.suggested_replies || []).map((item) =>
      `<button class="advisor-reply" type="button" data-topic-id="${escapeHtml(response.topic_id || "")}" data-reply-id="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`
    ).join("");
    const links = (response.links || []).map((item, index) =>
      `<a class="advisor-link ${index === 0 ? "advisor-link--primary" : ""}" href="${escapeHtml(safeUrl(item.url))}" data-advisor-cta="${escapeHtml(item.type || "link")}" data-answer-mode="${escapeHtml(response.answer_mode || "")}">${escapeHtml(item.label)}</a>`
    ).join("");
    const sources = (response.sources || []).map((item) =>
      `<a href="${escapeHtml(safeUrl(item.url))}">${escapeHtml(item.title)} ↗</a>`
    ).join("");
    const retry = response.ui_state === "unavailable"
      ? `<button type="button" class="advisor-retry" data-advisor-retry>${label("重试", "Retry")}</button>`
      : "";
    return `
      ${response.next_question ? `<p class="advisor-answer__question">${escapeHtml(response.next_question)}</p>` : ""}
      ${replies ? `<div class="advisor-replies">${replies}</div>` : ""}
      ${links ? `<div class="advisor-links">${links}</div>` : ""}
      ${sources ? `<div class="advisor-sources"><span>${label("相关资料", "Related reading")}</span>${sources}</div>` : ""}
      ${retry}`;
  }

  function answerShell(response, options = {}) {
    const printing = options.printing;
    const full = options.fullText != null ? options.fullText : (response.answer || "");
    return `<article class="advisor-turn advisor-turn--assistant" data-printing="${printing ? "1" : "0"}">
      <div class="advisor-answer">
        <span class="advisor-answer__mode">${modeLabel(response)}</span>
        <p class="advisor-answer__text">${escapeHtml(options.visibleText != null ? options.visibleText : full)}</p>
        <div class="advisor-answer__actions">
          ${printing ? `<button type="button" class="advisor-stop" data-advisor-stop>${label("停止", "Stop")}</button>` : ""}
          ${(!printing && full && options.canExpand) ? `<button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>` : ""}
        </div>
        <div class="advisor-answer__extras">${printing ? "" : extrasMarkup(response)}</div>
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

  function setBusy(next) {
    busy = next;
    if (!panel) return;
    panel.classList.toggle("is-busy", next);
    const send = panel.querySelector(".advisor-widget__send");
    const stop = panel.querySelector(".advisor-widget__stop");
    const textarea = panel.querySelector("textarea");
    if (send) send.disabled = next;
    if (textarea) textarea.disabled = next;
    if (stop) stop.hidden = !next;
    panel.querySelectorAll(".advisor-topic, .advisor-reply").forEach((node) => {
      node.disabled = next;
    });
  }

  function clearPrintTimer() {
    if (printTimer) {
      clearTimeout(printTimer);
      printTimer = null;
    }
  }

  function stopActive(reason = "user_stop") {
    clearPrintTimer();
    if (activeAbort) {
      try { activeAbort.abort(reason); } catch (_) {}
      activeAbort = null;
    }
  }

  function unavailableLocal(reason) {
    const response = root.LuminoAdvisor.route({ text: "", lang: lang() });
    response.answer_mode = "fallback";
    response.intent = "service_unavailable";
    response.ui_state = "unavailable";
    response.degradation_reason = reason;
    response.sources = [];
    response.suggested_replies = [];
    response.next_question = null;
    response.confidence = "low";
    response.handoff = "contact";
    response.answer = reason === "timeout"
      ? label("请求超时。这通常是网络或服务暂时繁忙，不代表没有相关资料。你可以重试。", "The request timed out. This usually means the network or service is busy — not that Lumino has no guidance. You can retry.")
      : label("暂时无法连接顾问服务。已保留你的问题，你可以重试，或改用下方话题 / 联系页。", "Could not reach the advisor service. Your question is kept — retry, choose a topic, or use the contact page.");
    response.links = [{
      type: "contact",
      label: label("联系 Lumino", "Contact Lumino"),
      url: "/apps/site/Lumino%20联系.dc.html?source=homepage-advisor&topic=unavailable",
    }];
    response.cta = response.links[0];
    response.runtime = { source: "client_fallback", ui_state: "unavailable", degradation_reason: reason };
    return response;
  }

  function basicModeLocal(payloadReason) {
    const response = root.LuminoAdvisor.route({ text: lastRequest?.text || "", topicId: lastRequest?.topicId || "", lang: lang() });
    if (response.answer_mode === "fallback") {
      const unavailable = unavailableLocal(payloadReason || "network");
      unavailable.ui_state = "basic_mode";
      unavailable.answer = label(
        "已切换到基础问答模式（本地固定说明）。在线服务暂时不可用，你可以重试获取完整结果。",
        "Switched to basic guidance (local fixed answers). Online service is temporarily unavailable — retry for the full path."
      );
      return unavailable;
    }
    response.ui_state = "basic_mode";
    response.degradation_reason = payloadReason || "network";
    return response;
  }

  async function readSse(response, handlers) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n");
        let eventName = "message";
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        let data = {};
        try { data = JSON.parse(dataLines.join("\n")); } catch (_) { data = { text: dataLines.join("\n") }; }
        if (handlers[eventName]) handlers[eventName](data);
      }
    }
  }

  function printAnswer(article, fullText, onDone) {
    const textNode = article.querySelector(".advisor-answer__text");
    const actions = article.querySelector(".advisor-answer__actions");
    if (prefersReducedMotion()) {
      textNode.textContent = fullText;
      article.dataset.printing = "0";
      actions.innerHTML = "";
      onDone(true);
      return;
    }
    let index = 0;
    const step = () => {
      index = Math.min(fullText.length, index + 12);
      textNode.textContent = fullText.slice(0, index);
      scrollToLatest();
      if (index >= fullText.length) {
        article.dataset.printing = "0";
        actions.innerHTML = "";
        onDone(true);
        return;
      }
      printTimer = setTimeout(step, CHUNK_MS);
    };
    actions.innerHTML = `<button type="button" class="advisor-stop" data-advisor-stop>${label("停止", "Stop")}</button>
      <button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>`;
    article.dataset.fullText = fullText;
    step();
  }

  async function resolveResponse(request, article) {
    const payload = { ...request, lang: lang() };
    const controller = new AbortController();
    activeAbort = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), CLIENT_TIMEOUT_MS);
    try {
      const upstream = await fetch("/api/advisor?stream=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!upstream.ok) {
        const reason = upstream.status === 429 ? "rate_limited" : `http_${upstream.status}`;
        trackMetric({ type: "client", ok: false, timeout: false, answer_mode: "fallback", source: "error", degradation_reason: reason });
        return unavailableLocal(reason);
      }
      const contentType = String(upstream.headers.get("content-type") || "");
      if (contentType.includes("text/event-stream") && upstream.body) {
        let finalPayload = null;
        let printed = "";
        const textNode = article.querySelector(".advisor-answer__text");
        await readSse(upstream, {
          delta(data) {
            if (controller.signal.aborted) return;
            printed += data.text || "";
            textNode.textContent = printed;
            scrollToLatest();
          },
          advisor(data) { finalPayload = data; },
          done() {},
        });
        if (finalPayload && finalPayload.answer) {
          if (!printed || printed.length < finalPayload.answer.length) {
            // Ensure full text via local print if deltas were skipped.
            return finalPayload;
          }
          return finalPayload;
        }
        return unavailableLocal("stream_incomplete");
      }
      const data = await upstream.json();
      if (data && data.answer_mode && data.answer) return data;
      return unavailableLocal("bad_payload");
    } catch (error) {
      const timedOut = error === "timeout" || error?.name === "TimeoutError" || error?.name === "AbortError" || String(error).includes("timeout");
      const userStop = String(error).includes("user_stop") || controller.signal.reason === "user_stop";
      if (userStop) {
        trackMetric({ type: "client", ok: false, answer_mode: "fallback", source: "error", degradation_reason: "user_stop" });
        const stopped = unavailableLocal("user_stop");
        stopped.answer = label("已停止生成。你可以重试，或继续选择话题。", "Generation stopped. You can retry or choose another topic.");
        stopped.ui_state = "unavailable";
        return stopped;
      }
      trackMetric({
        type: "client",
        timeout: timedOut,
        ok: false,
        answer_mode: "fallback",
        source: "error",
        degradation_reason: timedOut ? "timeout" : "network",
      });
      // Prefer basic local mode when a topic/text can still map; else unavailable.
      if (payload.topicId || payload.text) {
        try {
          return basicModeLocal(timedOut ? "timeout" : "network");
        } catch (_) {}
      }
      return unavailableLocal(timedOut ? "timeout" : "network");
    } finally {
      clearTimeout(timeout);
      if (activeAbort === controller) activeAbort = null;
    }
  }

  async function appendExchange(userLabel, request, options) {
    if (busy) return;
    lastRequest = { ...request };
    lastUserLabel = userLabel;
    setBusy(true);
    const thread = panel.querySelector(".advisor-thread");
    if (userLabel) thread.insertAdjacentHTML("beforeend", `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(userLabel)}</p></article>`);
    const pending = {
      answer_mode: "fallback",
      answer: "",
      ui_state: "ok",
      suggested_replies: [],
      links: [],
      sources: [],
    };
    thread.insertAdjacentHTML("beforeend", answerShell(pending, {
      printing: true,
      visibleText: label("正在生成说明…", "Preparing guidance…"),
      fullText: "",
    }));
    const article = thread.querySelector(".advisor-turn--assistant:last-child");
    announce(label("正在生成说明", "Preparing guidance"));
    scrollToLatest();

    const started = performance.now();
    const response = await resolveResponse(request, article);
    const fullText = response.answer || "";
    article.querySelector(".advisor-answer__mode").textContent = modeLabel(response);
    article.dataset.fullText = fullText;

    await new Promise((resolve) => {
      let settled = false;
      const finish = (mode) => {
        if (settled) return;
        settled = true;
        clearPrintTimer();
        article.dataset.printing = "0";
        article.querySelector(".advisor-answer__extras").innerHTML = extrasMarkup(response);
        if (mode === "stopped") {
          article.querySelector(".advisor-answer__actions").innerHTML =
            `<button type="button" class="advisor-expand" data-advisor-expand>${label("显示全文", "Show full answer")}</button>
             <button type="button" class="advisor-retry" data-advisor-retry>${label("重试", "Retry")}</button>`;
        } else {
          article.querySelector(".advisor-answer__actions").innerHTML = "";
        }
        resolve();
      };
      article.addEventListener("advisor:stop-print", () => finish("stopped"), { once: true });
      const existing = article.querySelector(".advisor-answer__text").textContent || "";
      if (!fullText) {
        article.querySelector(".advisor-answer__text").textContent = "";
        finish("done");
        return;
      }
      if (prefersReducedMotion() || existing === fullText) {
        article.querySelector(".advisor-answer__text").textContent = fullText;
        finish("done");
        return;
      }
      printAnswer(article, fullText, () => finish("done"));
    });

    history.push({ topicId: options?.topicId || request.topicId || "", userLabel, response, freeText: options?.freeText });
    saveState();
    trackMetric({
      type: "client",
      answer_mode: response.answer_mode,
      source: response.runtime?.source || "",
      handoff: response.handoff,
      has_sources: Boolean(response.sources?.length),
      latency_ms: Math.round(performance.now() - started),
      degradation_reason: response.degradation_reason || response.runtime?.degradation_reason || null,
      ok: response.ui_state !== "unavailable",
    });
    announce(response.answer);
    setBusy(false);
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
    response.ui_state = "ok";
    panel.querySelector(".advisor-thread").insertAdjacentHTML("beforeend", answerShell(response));
    announce(response.answer);
    scrollToLatest();
  }

  function reset() {
    stopActive("reset");
    clearPrintTimer();
    history = [];
    lastRequest = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    panel.querySelector(".advisor-thread").innerHTML = initialMarkup();
    panel.querySelector("textarea").value = "";
    setBusy(false);
    announce(label("已重新开始", "Started over"));
  }

  function restoredMarkup() {
    if (!history.length) return initialMarkup();
    return `<section class="advisor-resumed">
      <span>${label("已恢复当前标签页中的对话", "Conversation restored in this tab")}</span>
    </section>${history.map((item) => `${item.userLabel ? `<article class="advisor-turn advisor-turn--user"><p>${escapeHtml(item.userLabel)}</p></article>` : ""}${answerShell(item.response)}`).join("")}`;
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
      <div class="advisor-widget__identity">
        <picture>
          <source type="image/webp" srcset="/apps/site/site/assets/brand/mark-128.webp">
          <img class="advisor-widget__mark" src="/apps/site/site/assets/brand/mark-128.png" width="40" height="40" alt="" decoding="async">
        </picture>
        <div class="advisor-widget__copy">
          ${runtimeFlags.public_beta === false ? "" : `<span class="advisor-widget__beta">${label("公开试用", "Public beta")}</span>`}
          <strong id="advisor-title">${label("Lumino 服务顾问", "Lumino Service Guide")}</strong>
          <p>${label("初步判断，帮助你快速定向；不替代正式合规结论，也不在此收集联系方式或客户文件。", "Preliminary guidance to get oriented — not a formal compliance conclusion, and no contact details or client files are collected here.")}</p>
        </div>
      </div>
      <div class="advisor-widget__head-actions">
        <button class="advisor-widget__reset" type="button">${label("重新开始", "Start over")}</button>
        <button class="advisor-widget__close" type="button" aria-label="${label("关闭服务顾问", "Close service guide")}">×</button>
      </div>
    </header>
    <div class="advisor-widget__body"><div class="advisor-thread">${restoredMarkup()}</div></div>
    <form class="advisor-widget__composer">
      <textarea name="question" rows="1" maxlength="2000" placeholder="${label("输入你的问题……", "Type your question…")}" aria-label="${label("输入你的问题", "Type your question")}"></textarea>
      <button class="advisor-widget__stop" type="button" hidden>${label("停止", "Stop")}</button>
      <button class="advisor-widget__send" type="submit">${label("发送", "Send")}</button>
    </form>
    <footer class="advisor-widget__foot">${label("对话不会提交给 Lumino，也不会进入线索库；仅保存在本次浏览器标签页。正式咨询请走联系页。", "Chats are not submitted to Lumino or a lead database; they stay in this browser tab only. Use the contact page for a formal consultation.")}</footer>
    <div class="advisor-widget__status" aria-live="polite" aria-atomic="true"></div>`;
    document.body.appendChild(panel);

    panel.querySelector(".advisor-widget__close").addEventListener("click", close);
    panel.querySelector(".advisor-widget__reset").addEventListener("click", reset);
    panel.querySelector(".advisor-widget__stop").addEventListener("click", () => stopActive("user_stop"));
    panel.querySelector(".advisor-thread").addEventListener("click", (event) => {
      const stopBtn = event.target.closest("[data-advisor-stop]");
      if (stopBtn) {
        const article = stopBtn.closest(".advisor-turn--assistant");
        stopActive("user_stop");
        clearPrintTimer();
        if (article) article.dispatchEvent(new Event("advisor:stop-print"));
        return;
      }
      const expand = event.target.closest("[data-advisor-expand]");
      if (expand) {
        const article = expand.closest(".advisor-turn--assistant");
        clearPrintTimer();
        const full = article?.dataset.fullText || article?.querySelector(".advisor-answer__text")?.textContent || "";
        const textNode = article.querySelector(".advisor-answer__text");
        if (textNode) textNode.textContent = full;
        article.dataset.printing = "0";
        expand.remove();
        return;
      }
      const retry = event.target.closest("[data-advisor-retry]");
      if (retry && lastRequest) {
        appendExchange(lastUserLabel || label("重试", "Retry"), lastRequest, { topicId: lastRequest.topicId, freeText: !lastRequest.topicId });
        return;
      }
      const cta = event.target.closest("[data-advisor-cta]");
      if (cta) {
        trackMetric({
          type: "cta",
          cta_type: cta.dataset.advisorCta || "link",
          answer_mode: cta.dataset.answerMode || "",
        });
      }
      if (busy) return;
      const topic = event.target.closest(".advisor-topic[data-topic-id]");
      if (topic) appendExchange(topic.textContent.trim(), { topicId: topic.dataset.topicId }, { topicId: topic.dataset.topicId });
      const reply = event.target.closest("[data-reply-id]");
      if (reply) appendExchange(reply.textContent.trim(), { topicId: reply.dataset.topicId, replyId: reply.dataset.replyId, text: reply.textContent.trim() }, { topicId: reply.dataset.topicId });
    });
    const form = panel.querySelector("form");
    const textarea = panel.querySelector("textarea");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (busy) return;
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
      if (event.key === "Escape" && !panel.hidden) {
        if (busy) stopActive("user_stop");
        else close();
      }
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
    if (busy) stopActive("close");
    panel.hidden = true;
    const toolRoot = document.querySelector(".tool-float");
    if (toolRoot) toolRoot.hidden = false;
    if (trigger && typeof trigger.focus === "function") trigger.focus({ preventScroll: true });
  }

  root.LuminoAdvisorWidget = Object.freeze({ open, close, reset });
})(window);
