(function (root) {
  "use strict";

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return out;
  }

  function isTableSep(line) {
    return /^\|?[\s:-]+\|[\s|:-]*$/.test(line.trim());
  }

  function parseTable(lines, start) {
    const rows = [];
    let i = start;
    while (i < lines.length && lines[i].includes("|")) {
      if (!isTableSep(lines[i])) {
        const cells = lines[i].replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        rows.push(cells);
      }
      i += 1;
      if (i < lines.length && !lines[i].includes("|")) break;
    }
    if (rows.length < 1) return { html: "", next: start + 1 };
    const head = rows[0];
    const body = rows.slice(1);
    let html = '<div class="kb-table-wrap"><table class="kb-table"><thead><tr>';
    html += head.map((c) => `<th>${inline(c)}</th>`).join("");
    html += "</tr></thead><tbody>";
    body.forEach((row) => {
      html += `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`;
    });
    html += "</tbody></table></div>";
    return { html, next: i };
  }

  function renderMarkdown(src) {
    const lines = String(src || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let i = 0;
    let para = [];
    let listType = null;
    let listItems = [];

    const flushPara = () => {
      if (!para.length) return;
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    };
    const flushList = () => {
      if (!listType) return;
      const tag = listType === "ol" ? "ol" : "ul";
      const cls = listType === "ol" ? ' class="kb-steps"' : "";
      out.push(`<${tag}${cls}>${listItems.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
      listType = null;
      listItems = [];
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        flushPara();
        flushList();
        i += 1;
        continue;
      }

      if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        flushPara();
        flushList();
        const table = parseTable(lines, i);
        out.push(table.html);
        i = table.next;
        continue;
      }

      const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (h) {
        flushPara();
        flushList();
        const level = h[1].length;
        out.push(`<h${level}>${inline(h[2])}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^>\s?/.test(trimmed)) {
        flushPara();
        flushList();
        out.push(`<p class="kb-callout">${inline(trimmed.replace(/^>\s?/, ""))}</p>`);
        i += 1;
        continue;
      }

      const ol = /^(\d+)\.\s+(.+)$/.exec(trimmed);
      if (ol) {
        flushPara();
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(ol[2]);
        i += 1;
        continue;
      }

      const ul = /^[-*]\s+(.+)$/.exec(trimmed);
      if (ul) {
        flushPara();
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(ul[1]);
        i += 1;
        continue;
      }

      flushList();
      para.push(trimmed);
      i += 1;
    }
    flushPara();
    flushList();
    return out.join("\n");
  }

  root.LuminoMarkdown = { renderMarkdown, escapeHtml };
})(typeof window !== "undefined" ? window : globalThis);

if (typeof module === "object" && module.exports) {
  module.exports = globalThis.LuminoMarkdown;
}
