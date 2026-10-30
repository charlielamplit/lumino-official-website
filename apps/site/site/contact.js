(function () {
  const form = document.getElementById("contactForm");
  const message = document.getElementById("formMessage");
  const params = new URLSearchParams(location.search);
  const requested = params.get("serviceId");
  const select = document.getElementById("serviceSelect");
  const industrySelect = document.getElementById("industrySelect");
  const timelineField = document.getElementById("timelineField");
  if (requested && select) {
    if (select.options) {
      if ([...select.options].some((option) => option.value === requested)) select.value = requested;
    } else {
      select.value = requested;
    }
  }
  if (industrySelect && params.get("industry")) {
    const ind = params.get("industry");
    if ([...industrySelect.options].some((o) => o.value === ind)) industrySelect.value = ind;
  }
  if (timelineField && params.get("timeline")) timelineField.value = params.get("timeline");
  document.getElementById("sourceField").value = params.get("source") || document.referrer || "public-contact";

  const show = (text, tone) => {
    message.textContent = text;
    message.dataset.tone = tone;
    message.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!form.checkValidity()) {
      form.reportValidity();
      show("请先补齐所有必填信息。", "error");
      return;
    }
    if (!String(data.get("email") || "").trim() && !String(data.get("phone") || "").trim()) {
      show("请至少填写工作邮箱或电话 / 微信。", "error");
      return;
    }
    if (!data.get("consent")) {
      show("请先勾选联系授权。", "error");
      return;
    }
    if (!navigator.onLine) {
      show("当前处于离线状态。内容仍保留在页面中，请恢复网络后重试。", "error");
      return;
    }

    const fingerprint = [data.get("company"), data.get("serviceId"), data.get("note")].join("|");
    if (sessionStorage.getItem("lumino-contact-last") === fingerprint) {
      show("这项需求刚刚已经登记，请勿重复提交。", "error");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "提交中…";

    const payload = {
      company: String(data.get("company") || "").trim(),
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      industry: String(data.get("industry") || "").trim(),
      timeline: String(data.get("timeline") || "").trim(),
      serviceId: String(data.get("serviceId") || "").trim(),
      note: String(data.get("note") || "").trim(),
      source: String(data.get("source") || "public-contact"),
      requestType: String(data.get("requestType") || "service-consultation"),
      consent: true,
    };

    const client = window.LuminoLeadsClient;
    if (!client) {
      show("线索客户端未加载，请刷新后重试。输入内容已保留。", "error");
      button.disabled = false;
      button.textContent = originalLabel;
      return;
    }

    const result = await client.submitLead(payload);
    if (!result.ok) {
      show(result.error || "提交失败，请检查信息后重试。输入内容已保留。", "error");
      button.disabled = false;
      button.textContent = originalLabel;
      return;
    }

    sessionStorage.setItem("lumino-contact-last", fingerprint);
    if (result.channel === "api") {
      const notifyHint = result.notified ? "对接人已收到通知。" : "已写入线索库；通知通道若未配置，商务可在 Portal 线索箱查看。";
      show(`已提交（编号 ${result.leadId}）。${notifyHint}`, "success");
    } else {
      show(
        `已登记（编号 ${result.leadId}）。${result.warning || "当前环境写入本机 Portal 线索箱"}。正式环境将送达服务端线索库。`,
        "success"
      );
    }
    button.disabled = false;
    button.textContent = originalLabel;
  });
})();
