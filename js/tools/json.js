/**
 * File: js/tools/json.js
 * Module: Tool — JSON Formatter
 * Purpose: Format, validate, and minify JSON.
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

  function countLines(str) {
    if (!str) return 0;
    let n = 1;
    for (let i = 0; i < str.length; i++) if (str.charCodeAt(i) === 10) n++;
    return n;
  }

  function locate(raw, pos) {
    let line = 1,
      col = 1;
    const end = Math.min(pos, raw.length);
    for (let i = 0; i < end; i++) {
      if (raw.charCodeAt(i) === 10) {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    return { line, col };
  }

  function parse(raw) {
    if (!raw || !raw.trim()) return { ok: false, error: "Input is empty." };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (e) {
      const msg = e && e.message ? e.message : "Invalid JSON.";
      let line = null,
        col = null,
        pos = null;
      const lm = /line\s+(\d+)/i.exec(msg);
      const cm = /column\s+(\d+)/i.exec(msg);
      const pm = /position\s+(\d+)/i.exec(msg);
      if (lm) line = parseInt(lm[1], 10);
      if (cm) col = parseInt(cm[1], 10);
      if (pm) pos = parseInt(pm[1], 10);
      if ((line == null || col == null) && pos != null) {
        const loc = locate(raw, pos);
        if (line == null) line = loc.line;
        if (col == null) col = loc.col;
      }
      return { ok: false, error: msg, line, col };
    }
  }

  function indentOf(value) {
    if (value === "4") return 4;
    if (value === "tab") return "\t";
    return 2;
  }

  function paintStats(el, text) {
    DT.ui.panel.paintStats(el, text);
  }

  function showError(info) {
    if (!refs.errorBox) return;
    if (!info) {
      refs.errorBox.clear();
      return;
    }
    let msg = info.error;
    if (info.line != null) {
      msg += " (Line " + info.line + (info.col != null ? ", column " + info.col : "") + ")";
    }
    refs.errorBox.show("Invalid JSON", msg);
  }

  function applyResult(result, transform, toastMsg) {
    if (!result.ok) {
      showError(result);
      refs.output.value = "";
      paintStats(refs.outputStats, "");
      return;
    }
    showError(null);
    const text = transform(result.value);
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    if (toastMsg) DT.ui.toast.success(toastMsg);
  }

  function format() {
    const result = parse(refs.input.value);
    applyResult(
      result,
      (v) => JSON.stringify(v, null, indentOf(refs.indent.value)),
      "Formatted",
    );
  }

  function minify() {
    const result = parse(refs.input.value);
    applyResult(result, (v) => JSON.stringify(v), "Minified");
  }

  function validate() {
    const result = parse(refs.input.value);
    if (result.ok) {
      showError(null);
      DT.ui.toast.success("Valid JSON");
    } else {
      showError(result);
      DT.ui.toast.error("Invalid JSON");
    }
  }

  function clearAll() {
    const snap = {
      input: refs.input.value,
      output: refs.output.value,
      inputStats: refs.inputStats.textContent,
      outputStats: refs.outputStats.textContent,
    };
    if (!snap.input && !snap.output) {
      refs.input.focus();
      return;
    }

    refs.input.value = "";
    refs.output.value = "";
    showError(null);
    paintStats(refs.inputStats, "");
    paintStats(refs.outputStats, "");
    refs.input.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.input.value = snap.input;
      refs.output.value = snap.output;
      paintStats(refs.inputStats, snap.input);
      paintStats(refs.outputStats, snap.output);
    });
  }

/* ------------------------------------------------------------
   * Phase 2B: conversions
   * ------------------------------------------------------------ */

  /** Recursively sort object keys (arrays keep their order). */
  function sortKeysDeep(value) {
    if (Array.isArray(value)) return value.map(sortKeysDeep);
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).sort().forEach(function (k) {
        out[k] = sortKeysDeep(value[k]);
      });
      return out;
    }
    return value;
  }

  function csvCell(v) {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Array of flat objects (or a single object) to CSV text. */
  function toCsv(value) {
    let rows = value;
    if (!Array.isArray(rows)) {
      if (rows && typeof rows === "object") rows = [rows];
      else return { ok: false, error: "CSV needs an array of objects (or one object)." };
    }
    if (!rows.length) return { ok: false, error: "The array is empty, nothing to convert." };
    if (rows.every((r) => Array.isArray(r))) {
      return { ok: true, text: rows.map((r) => r.map(csvCell).join(",")).join("\n") };
    }
    if (!rows.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      return { ok: false, error: "CSV needs an array of objects; mixed rows are not supported." };
    }
    const keys = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
    const lines = [keys.map(csvCell).join(",")];
    rows.forEach((r) => lines.push(keys.map((k) => csvCell(r[k])).join(",")));
    return { ok: true, text: lines.join("\n") };
  }

  /** Minimal CSV parser (quotes, escaped quotes, commas, CRLF). */
  function parseCsv(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    const s = String(text);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inQuotes) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field); field = "";
      } else if (ch === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (ch !== "\r") {
        field += ch;
      }
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => !(r.length === 1 && r[0] === ""));
  }

  function csvTyped(v) {
    if (v === "") return "";
    if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(v)) return Number(v);
    if (v === "true") return true;
    if (v === "false") return false;
    if (v === "null") return null;
    return v;
  }

  function csvToJson(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { ok: false, error: "CSV needs a header row plus at least one data row." };
    const headers = rows[0];
    const out = rows.slice(1).map(function (r) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = csvTyped(r[i] === undefined ? "" : r[i]); });
      return obj;
    });
    return { ok: true, value: out };
  }

  /** Plain-data YAML serializer (objects, arrays, scalars). */
  function yamlScalar(v) {
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    const s = String(v);
    if (s === "") return '""';
    if (/[:#\[\]{}&*!|>'"%@`,]/.test(s) || /^\s|\s$/.test(s) || /^(true|false|null|~|[-+.]?\d)/.test(s) || s.includes("\n")) {
      return JSON.stringify(s);
    }
    return s;
  }
  function toYaml(value, indent) {
    const pad = "  ".repeat(indent);
    if (Array.isArray(value)) {
      if (!value.length) return pad + "[]";
      return value.map(function (item) {
        if (item && typeof item === "object") {
          const inner = toYaml(item, indent + 1);
          // Move the first line of the nested block onto the "- " line.
          return pad + "- " + inner.slice(pad.length + 2);
        }
        return pad + "- " + yamlScalar(item);
      }).join("\n");
    }
    if (value && typeof value === "object") {
      const keys = Object.keys(value);
      if (!keys.length) return pad + "{}";
      return keys.map(function (k) {
        const v = value[k];
        if (v && typeof v === "object" && (Array.isArray(v) ? v.length : Object.keys(v).length)) {
          return pad + yamlScalar(k) + ":\n" + toYaml(v, indent + 1);
        }
        if (v && typeof v === "object") return pad + yamlScalar(k) + ": " + (Array.isArray(v) ? "[]" : "{}");
        return pad + yamlScalar(k) + ": " + yamlScalar(v);
      }).join("\n");
    }
    return pad + yamlScalar(value);
  }

  /* ------------------------------------------------------------
   * Tree view: collapsible rendering of the parsed value
   * ------------------------------------------------------------ */
  let treeNodeCount = 0;
  function buildTreeNode(key, value) {
    const dom = DT.ui.dom;
    treeNodeCount++;
    const node = dom.el("div", { class: "dt-json-node" });
    const rowKids = [];
    const isBranch = value && typeof value === "object";
    if (isBranch) {
      const toggle = dom.el("button", {
        type: "button",
        class: "dt-json-toggle",
        text: "▾",
        "aria-label": "Collapse",
      });
      rowKids.push(toggle);
      const kids = dom.el("div", { class: "dt-json-kids" });
      toggle.addEventListener("click", function () {
        const closed = kids.style.display === "none";
        kids.style.display = closed ? "" : "none";
        toggle.textContent = closed ? "▾" : "▸";
        toggle.setAttribute("aria-label", closed ? "Collapse" : "Expand");
        node._dtKids = kids; node._dtToggle = toggle;
      });
      node._dtKids = kids; node._dtToggle = toggle;
      const label = Array.isArray(value)
        ? "Array(" + value.length + ")"
        : "Object(" + Object.keys(value).length + ")";
      if (key !== null) rowKids.push(dom.el("span", { class: "dt-json-key", text: key + ": " }));
      rowKids.push(dom.el("span", { class: "dt-json-type", text: label }));
      node.appendChild(dom.el("div", { class: "dt-json-row" }, rowKids));
      if (treeNodeCount < 2000) {
        const entries = Array.isArray(value)
          ? value.map((v, i) => [String(i), v])
          : Object.keys(value).map((k) => [k, value[k]]);
        entries.forEach(function (pair) { kids.appendChild(buildTreeNode(pair[0], pair[1])); });
      }
      node.appendChild(kids);
    } else {
      rowKids.push(dom.el("span", { class: "dt-json-toggle-spacer" }));
      if (key !== null) rowKids.push(dom.el("span", { class: "dt-json-key", text: key + ": " }));
      const type = value === null ? "null" : typeof value;
      rowKids.push(dom.el("span", {
        class: "dt-json-value dt-json-value--" + type,
        text: type === "string" ? '"' + value + '"' : String(value),
      }));
      node.appendChild(dom.el("div", { class: "dt-json-row" }, rowKids));
    }
    return node;
  }
  function setTreeOpen(root, open) {
    root.querySelectorAll(".dt-json-node").forEach(function (n) {
      if (n._dtKids) {
        n._dtKids.style.display = open ? "" : "none";
        n._dtToggle.textContent = open ? "▾" : "▸";
      }
    });
  }

/* --- XML conversion (Phase 3) --- */
  function escapeXmlText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function xmlName(key) {
    const name = String(key).replace(/[^A-Za-z0-9_.-]/g, "_");
    return /^[A-Za-z_]/.test(name) ? name : "_" + name;
  }
  function toXml(value, name, depth) {
    const pad = "  ".repeat(depth);
    const tag = xmlName(name);
    if (value === null || value === undefined) {
      return pad + "<" + tag + "/>";
    }
    if (Array.isArray(value)) {
      if (!value.length) return pad + "<" + tag + "/>";
      return value.map(function (item) { return toXml(item, tag, depth); }).join("\n");
    }
    if (typeof value === "object") {
      const kids = Object.keys(value);
      if (!kids.length) return pad + "<" + tag + "/>";
      const inner = kids.map(function (k) { return toXml(value[k], k, depth + 1); }).join("\n");
      return pad + "<" + tag + ">\n" + inner + "\n" + pad + "</" + tag + ">";
    }
    return pad + "<" + tag + ">" + escapeXmlText(value) + "</" + tag + ">";
  }

  /** DOM element to plain JSON: attributes under "@attrs", text under "#text". */
  function elementToJson(el) {
    const obj = {};
    if (el.attributes && el.attributes.length) {
      const attrs = {};
      for (let i = 0; i < el.attributes.length; i++) {
        attrs[el.attributes[i].name] = el.attributes[i].value;
      }
      obj["@attrs"] = attrs;
    }
    const childEls = [];
    let text = "";
    el.childNodes.forEach(function (node) {
      if (node.nodeType === 1) childEls.push(node);
      else if (node.nodeType === 3) text += node.nodeValue;
    });
    text = text.trim();
    if (!childEls.length) {
      if (text) obj["#text"] = /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : text;
      if (Object.keys(obj).length === 1 && obj["@attrs"]) return obj;
      if (!Object.keys(obj).length) return "";
      if (Object.keys(obj).length === 1 && "#text" in obj && !obj["@attrs"]) return obj["#text"];
      return obj;
    }
    childEls.forEach(function (child) {
      const key = child.tagName;
      const val = elementToJson(child);
      if (obj[key] === undefined) obj[key] = val;
      else if (Array.isArray(obj[key])) obj[key].push(val);
      else obj[key] = [obj[key], val];
    });
    if (text) obj["#text"] = text;
    return obj;
  }
  function convertToXml() {
    const result = parse(refs.input.value);
    if (!result.ok) { showError(result); return; }
    showError(null);
    const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(result.value, "root", 0);
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    DT.ui.toast.success("Converted to XML");
  }

  function convertFromXml() {
    const raw = refs.input.value;
    if (!raw || !raw.trim()) { showError({ error: "Input is empty." }); return; }
    const doc = new DOMParser().parseFromString(raw, "text/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) {
      showError({ error: "Invalid XML: " + parseError.textContent.trim().split("\n")[0] });
      DT.ui.toast.error("Cannot parse XML");
      return;
    }
    showError(null);
    const rootEl = doc.documentElement;
    const wrapped = {};
    wrapped[rootEl.tagName] = elementToJson(rootEl);
    const text = JSON.stringify(wrapped, null, indentOf(refs.indent.value));
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    renderTree(wrapped);
    DT.ui.toast.success("Converted to JSON");
  }

/* --- Phase 2B conversion actions --- */
  function sortKeys() {
    const result = parse(refs.input.value);
    applyResult(
      result,
      (v) => JSON.stringify(sortKeysDeep(v), null, indentOf(refs.indent.value)),
      "Keys sorted",
    );
    if (result.ok) renderTree(result.value);
  }

  function convertCsv() {
    const result = parse(refs.input.value);
    if (!result.ok) { showError(result); return; }
    const out = toCsv(result.value);
    if (!out.ok) { showError({ error: out.error }); DT.ui.toast.error("Cannot convert to CSV"); return; }
    showError(null);
    refs.output.value = out.text;
    paintStats(refs.outputStats, out.text);
    DT.ui.toast.success("Converted to CSV");
  }

  function convertYaml() {
    const result = parse(refs.input.value);
    if (!result.ok) { showError(result); return; }
    showError(null);
    const text = toYaml(result.value, 0);
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    DT.ui.toast.success("Converted to YAML");
  }

  function convertFromCsv() {
    const raw = refs.input.value;
    if (!raw || !raw.trim()) { showError({ error: "Input is empty." }); return; }
    const out = csvToJson(raw);
    if (!out.ok) { showError({ error: out.error }); DT.ui.toast.error("Cannot parse CSV"); return; }
    showError(null);
    const text = JSON.stringify(out.value, null, indentOf(refs.indent.value));
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    renderTree(out.value);
    DT.ui.toast.success("Converted to JSON");
  }

  function escapeString() {
    const raw = refs.input.value;
    showError(null);
    const text = JSON.stringify(raw);
    refs.output.value = text;
    paintStats(refs.outputStats, text);
    DT.ui.toast.success("Escaped as a JSON string");
  }

  function unescapeString() {
    const raw = refs.input.value.trim();
    if (!raw) { showError({ error: "Input is empty." }); return; }
    try {
      const value = raw.startsWith('"') ? JSON.parse(raw) : JSON.parse('"' + raw + '"');
      if (typeof value !== "string") throw new Error("not a string");
      showError(null);
      refs.output.value = value;
      paintStats(refs.outputStats, value);
      DT.ui.toast.success("Unescaped");
    } catch (e) {
      showError({ error: "Input is not a valid escaped JSON string." });
      DT.ui.toast.error("Cannot unescape");
    }
  }

  function renderTree(value) {
    if (!refs || !refs.treeSlot) return;
    treeNodeCount = 0;
    DT.ui.dom.clear(refs.treeSlot);
    refs.treeSlot.appendChild(buildTreeNode(null, value));
    if (treeNodeCount >= 2000) {
      refs.treeSlot.appendChild(
        DT.ui.dom.el("div", { class: "dt-help", text: "Tree truncated at 2000 nodes." }),
      );
    }
  }

  function toggleTree() {
    const panel = refs.treePanel;
    const open = panel.style.display !== "none";
    if (open) {
      panel.style.display = "none";
      return;
    }
    const result = parse(refs.input.value);
    if (!result.ok) { showError(result); return; }
    renderTree(result.value);
    panel.style.display = "";
  }

  function copyOutput() {
    const text = refs.output.value;
    if (!text) {
      DT.ui.toast.info("Nothing to copy");
      return;
    }
    DT.utils.clipboard
      .copy(text)
      .then(() => DT.ui.toast.success("Copied"))
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  DT.tools.json = {
    id: "json",
    name: "JSON Formatter",
    category: "Data",
    icon: "braces",
    description: "Format, validate, minify, sort, tree view and convert JSON.",

    keywords: "format validate minify beautify pretty parse lint object array data sort tree csv yaml escape unescape",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* --- Toolbar --- */
      const indent = dom.el(
        "select",
        {
          class: "dt-select dt-select--sm",
          id: "dt-json-indent",
        },
        [
          dom.el("option", { value: "2", text: "2 spaces" }),
          dom.el("option", { value: "4", text: "4 spaces" }),
          dom.el("option", { value: "tab", text: "Tab" }),
        ],
      );
      indent.style.width = "120px";

      const btnFormat = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Format",
      });
      const btnMinify = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Minify",
      });
      const btnValidate = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Validate",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Indent" }),
          indent,
          btnFormat,
          btnMinify,
          btnValidate,
        ]),
      ]);

      /* --- Convert toolbar (Phase 2B) --- */
      function convBtn(label) {
        return dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm",
          text: label,
        });
      }
      const btnSort = convBtn("Sort keys");
      const btnTree = convBtn("Tree view");
      const btnToCsv = convBtn("To CSV");
      const btnToYaml = convBtn("To YAML");
      const btnFromCsv = convBtn("CSV to JSON");
      const btnToXml = convBtn("To XML");
      const btnFromXml = convBtn("XML to JSON");
      const btnEscape = convBtn("Escape");
      const btnUnescape = convBtn("Unescape");
      const convertBar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Convert" }),
          btnSort,
          btnTree,
          btnToCsv,
          btnToYaml,
          btnFromCsv,
          btnToXml,
          btnFromXml,
          btnEscape,
          btnUnescape,
        ]),
      ]);

      /* --- Input panel --- */
      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-json-input",
        rows: "6",
        spellcheck: "false",
        placeholder: "Paste JSON here…  (Ctrl+Enter to format)",
      });
      const inputStats = DT.ui.panel.stats();

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Input", [
          DT.ui.panel.pasteBtn(input, function () {
            paintStats(inputStats, input.value);
          }),
          btnClear,
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [
          inputStats,
          DT.ui.panel.hint("Ctrl+Enter to format"),
        ]),
      ]);

      /* --- Error box (shared panel kit) --- */
      const errorBox = DT.ui.panel.error(inputPanel);
      errorBox.el.id = "dt-json-error";
      const errorSlot = errorBox.el;

      /* --- Output panel --- */
      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-json-output",
        rows: "6",
        readonly: "readonly",
        spellcheck: "false",
        placeholder: "Result appears here…",
      });
      const outputStats = DT.ui.panel.stats();
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("json", "json"),
        mime: "application/json;charset=utf-8",
        label: "Download",
      });

      const outputPanel = dom.el(
        "div",
        { class: "dt-panel dt-panel--editor" },
        [
          dom.el("div", { class: "dt-panel__head" }, [
            dom.el("div", { class: "dt-panel__title", text: "Output" }),
            dom.el("div", { class: "dt-panel__actions" }, [
              DT.ui.panel.wrapBtn(output),
              btnCopy,
              btnDownload,
            ]),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [output]),
          dom.el("div", { class: "dt-panel__foot" }, [outputStats]),
        ],
      );

      /* --- Tree panel (hidden until Tree view is clicked) --- */
      const treeSlot = dom.el("div", {
        class: "dt-json-tree",
        style: { padding: "8px 12px" },
      });
      const btnExpandAll = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Expand all",
      });
      const btnCollapseAll = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Collapse all",
      });
      const treePanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Tree", [btnExpandAll, btnCollapseAll]),
        treeSlot,
      ]);
      treePanel.style.display = "none";

      /* --- Assemble --- */
      workspace.appendChild(toolbar);
      workspace.appendChild(convertBar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(errorSlot);
      workspace.appendChild(outputPanel);
      workspace.appendChild(treePanel);
      container.appendChild(workspace);

      refs = { input, output, indent, errorSlot, errorBox, inputStats, outputStats, treeSlot, treePanel };

      /* --- Events --- */
      on(input, "input", () => paintStats(inputStats, input.value));
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          format();
        }
      });
      on(btnFormat, "click", format);
      on(btnMinify, "click", minify);
      on(btnValidate, "click", validate);
      on(btnSort, "click", sortKeys);
      on(btnTree, "click", toggleTree);
      on(btnToCsv, "click", convertCsv);
      on(btnToYaml, "click", convertYaml);
      on(btnFromCsv, "click", convertFromCsv);
      on(btnToXml, "click", convertToXml);
      on(btnFromXml, "click", convertFromXml);
      on(btnEscape, "click", escapeString);
      on(btnUnescape, "click", unescapeString);
      on(btnExpandAll, "click", () => setTreeOpen(treeSlot, true));
      on(btnCollapseAll, "click", () => setTreeOpen(treeSlot, false));
      on(btnClear, "click", clearAll);
      on(btnCopy, "click", copyOutput);

      DT.utils.persist.bind("json", input, {
        onRestore: function () {
          paintStats(inputStats, input.value);
        },
      });
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
