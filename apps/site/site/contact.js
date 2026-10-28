(function () {
  const form = document.getElementById("contactForm");
  const message = document.getElementById("formMessage");
  const params = new URLSearchParams(location.search);
  const requested = params.get("serviceId");
  const select = document.getElementById("serviceSelect");
  const industrySelect = document.getElementById("industrySelect");
  const timelineField = document.getElementById("timelineField");
  if (requested && [...select.options].some((option) => option.value === requested)) select.value = requested;
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
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!form.checkValidity()) {
      form.reportValidity();
      show("请先补齐所有必填信息。", "error");
      return;
    }
    if (!String(data.get("email")).trim() && !String(data.get("phone")).trim()) {
      show("请至少填写工作邮箱或电话 / 微信。", "error");
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
    button.disabled = true;
    button.textContent = "提交中…";
    window.setTimeout(() => {
      sessionStorage.setItem("lumino-contact-last", fingerprint);
      const ticket =
        "LM-" +
        new Date().toISOString().slice(0, 10).replaceAll("-", "") +
        "-" +
        Math.floor(1000 + Math.random() * 9000);
      show(`需求已在本地原型中登记，编号 ${ticket}。本地演示不会向外部系统发送数据。`, "success");
      button.disabled = false;
      button.textContent = "提交";
    }, 500);
  });
})();
