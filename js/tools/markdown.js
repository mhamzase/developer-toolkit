/**
 * File: js/tools/markdown.js
 * Module: Tool — Markdown Preview
 * Purpose: Live preview for the everyday Markdown subset, plus a
 *          Copy HTML action. Raw HTML in the source is always
 *          escaped first, so the preview can never inject markup.
 * Notes: Supports headings, bold/italic/strike, inline code and code
 *        blocks, links and images (http/https/mailto only), lists,
 *        blockquotes, horizontal rules and pipe tables. All local.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function safeUrl(url) {
    const u = String(url || "").trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^#/.test(u)) return u;
    return "#";
  }

  /** Inline formatting on already-escaped text. Generated fragments
   *  (code spans, images, links) are parked as placeholders first, so
   *  the emphasis rules can never mangle their HTML (an attribute
   *  like target="_blank" contains underscores, for example). */
  function inline(escaped) {
    const frags = [];
    function park(html) {
      frags.push(html);
      return "\u0001" + (frags.length - 1) + "\u0002";
    }
    let s = escaped.replace(/`([^`]+)`/g, function (_, code) {
      return park("<code>" + code + "</code>");
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, src) {
      return park('<img alt="' + alt + '" src="' + safeUrl(src) + '">');
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, href) {
      return park(
        '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener noreferrer">' +
          inlineEmphasis(text) +
          "</a>",
      );
    });
    s = inlineEmphasis(s);
    s = s.replace(/\u0001(\d+)\u0002/g, function (_, i) {
      return frags[Number(i)];
    });
    return s;
  }

  function inlineEmphasis(s) {
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return s;
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map(function (c) {
      return c.trim();
    });
  }

  function renderMarkdown(src) {
    const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code block
      if (/^\s*```/.test(line)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        i++; // closing fence
        out.push("<pre><code>" + escapeHtml(buf.join("\n")) + "</code></pre>");
        continue;
      }

      if (!line.trim()) { i++; continue; }

      // Heading
      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        const level = h[1].length;
        out.push("<h" + level + ">" + inline(escapeHtml(h[2])) + "</h" + level + ">");
        i++;
        continue;
      }

      // Horizontal rule
      if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
        out.push("<hr>");
        i++;
        continue;
      }

      // Table: header row + separator row
      if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const head = tableCells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
          rows.push(tableCells(lines[i]));
          i++;
        }
        let html = "<table><thead><tr>";
        head.forEach(function (c) { html += "<th>" + inline(escapeHtml(c)) + "</th>"; });
        html += "</tr></thead><tbody>";
        rows.forEach(function (r) {
          html += "<tr>";
          head.forEach(function (_, ci) {
            html += "<td>" + inline(escapeHtml(r[ci] || "")) + "</td>";
          });
          html += "</tr>";
        });
        out.push(html + "</tbody></table>");
        continue;
      }

      // Blockquote: consecutive > lines
      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        out.push("<blockquote><p>" + inline(escapeHtml(buf.join(" "))) + "</p></blockquote>");
        continue;
      }

      // Lists: consecutive items of one kind
      const ulMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
      const olMatch = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ulMatch || olMatch) {
        const ordered = !!olMatch;
        const itemRe = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
        const items = [];
        while (i < lines.length) {
          const m = itemRe.exec(lines[i]);
          if (!m) break;
          items.push(m[1]);
          i++;
        }
        const tag = ordered ? "ol" : "ul";
        out.push("<" + tag + ">" + items.map(function (t) {
          return "<li>" + inline(escapeHtml(t)) + "</li>";
        }).join("") + "</" + tag + ">");
        continue;
      }

      // Paragraph: consecutive plain lines
      const buf = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,6})\s/.test(lines[i]) &&
        !/^\s*```/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i]) &&
        !/^\s*[-*+]\s+/.test(lines[i]) &&
        !/^\s*\d+[.)]\s+/.test(lines[i]) &&
        !/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
      ) {
        buf.push(lines[i]);
        i++;
      }
      out.push("<p>" + inline(escapeHtml(buf.join(" "))) + "</p>");
    }

    return out.join("\n");
  }

  DT.tools.markdown = {
    id: "markdown",
    name: "Markdown Preview",
    category: "Text",
    icon: "eye",
    description: "Write Markdown, see the rendered result, copy the HTML.",

    keywords: "markdown md preview render html readme markup gfm",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const btnSample = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Sample" });
      const btnCopyHtml = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy HTML" });
      const btnClear = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [btnCopyHtml, btnSample]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-md-input",
        rows: "9",
        spellcheck: "false",
        placeholder: "# Write Markdown here…",
      });
      const inputStats = DT.ui.panel.stats();
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Markdown", [DT.ui.panel.pasteBtn(input, function () { render(); })]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats]),
      ]);

      const preview = dom.el("div", {
        class: "dt-md",
        id: "dt-md-preview",
        style: { padding: "14px 18px" },
      });
      const previewPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Preview" }),
        ]),
        preview,
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(previewPanel);
      container.appendChild(workspace);

      refs = { input, preview, inputStats };

      let lastHtml = "";
      function render() {
        DT.ui.panel.paintStats(inputStats, input.value);
        lastHtml = renderMarkdown(input.value);
        if (!input.value.trim()) {
          preview.innerHTML = "";
          preview.appendChild(dom.el("div", {
            class: "dt-help",
            text: "The preview appears here as you type.",
          }));
          return;
        }
        preview.innerHTML = lastHtml;
      }

      on(input, "input", render);
      on(btnCopyHtml, "click", function () {
        if (!lastHtml) { DT.ui.toast.info("Nothing to copy yet"); return; }
        DT.utils.clipboard.copy(lastHtml)
          .then(() => DT.ui.toast.success("HTML copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      on(btnSample, "click", function () {
        input.value = [
          "# Release notes",
          "",
          "This build adds **bold** features and *small* fixes.",
          "",
          "- Faster startup",
          "- New `markdown` tool",
          "- See [the docs](https://example.com) for details",
          "",
          "> Everything runs locally.",
          "",
          "| Part | Status |",
          "| --- | --- |",
          "| UI | Done |",
          "",
          "```",
          "const x = 42;",
          "```",
        ].join("\n");
        render();
      });
      on(btnClear, "click", function () {
        const snap = input.value;
        if (!snap) { input.focus(); return; }
        input.value = "";
        render();
        input.focus();
        DT.ui.toast.undo("Cleared", function () {
          input.value = snap;
          render();
        });
      });

      DT.utils.persist.bind("markdown", input, { onRestore: render });
      render();
      input.focus();
    },

    unmount() {
      while (listeners.length) {
        const entry = listeners.pop();
        entry[0].removeEventListener(entry[1], entry[2]);
      }
      refs = null;
    },
  };
})();
