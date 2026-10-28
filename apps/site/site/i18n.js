(function (root) {
  "use strict";
  const STORAGE_KEY = "lumino.lang";

  function detectLang() {
    const params = new URLSearchParams(location.search);
    if (params.get("lang") === "en" || params.get("lang") === "zh") return params.get("lang");
    if (location.pathname.includes("/en/") || location.pathname.endsWith("/en")) return "en";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "zh") return stored;
    } catch (_) {}
    return document.documentElement.lang === "en" ? "en" : "zh";
  }

  function setLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    location.href = url.toString();
  }

  function t(dict, key) {
    const lang = detectLang();
    const row = dict[key];
    if (!row) return key;
    return row[lang] || row.zh || key;
  }

  function applyDataI18n(rootEl = document) {
    const lang = detectLang();
    rootEl.querySelectorAll("[data-i18n-zh]").forEach((el) => {
      const zh = el.getAttribute("data-i18n-zh");
      const en = el.getAttribute("data-i18n-en") || zh;
      el.textContent = lang === "en" ? en : zh;
    });
    rootEl.querySelectorAll("[data-i18n-html-zh]").forEach((el) => {
      const zh = el.getAttribute("data-i18n-html-zh");
      const en = el.getAttribute("data-i18n-html-en") || zh;
      el.innerHTML = lang === "en" ? en : zh;
    });
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
  }

  root.LuminoI18n = { detectLang, setLang, t, applyDataI18n };
})(typeof window !== "undefined" ? window : globalThis);
