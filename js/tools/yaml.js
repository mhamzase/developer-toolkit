/**
 * File: js/tools/yaml.js
 * Module: Tool — YAML Formatter & Converter
 * Purpose: Format and validate YAML, and convert between YAML
 *          and JSON in both directions, with a small hand written
 *          parser and serializer for the everyday YAML subset:
 *          block mappings and sequences, flow collections, quoted
 *          and plain scalars, comments and block scalars.
 * Notes: JSON is valid input for every action (it is a subset of
 *        YAML flow style). Errors carry a line number. Anchors,
 *        tags and multi document streams are out of scope and are
 *        reported as errors instead of being silently mangled.
 *        All processing local.
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

  function fail(lineNo, msg) {
    throw new Error("Line " + lineNo + ": " + msg);
  }

  /* ---------------- Scalar typing ---------------- */

  function parsePlainScalar(raw) {
    const s = raw.trim();
    if (s === "" || s === "~" || /^(null|Null|NULL)$/.test(s)) return null;
    if (/^(true|True|TRUE)$/.test(s)) return true;
    if (/^(false|False|FALSE)$/.test(s)) return false;
    if (/^[-+]?\d+$/.test(s)) {
      const n = Number(s);
      return Number.isSafeInteger(n) ? n : s;
    }
    if (/^[-+]?(\d+\.\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) || /^[-+]?\d+[eE][-+]?\d+$/.test(s)) {
      return Number(s);
    }
    if (s === ".inf" || s === ".Inf" || s === ".INF") return Infinity;
    if (s === "-.inf" || s === "-.Inf" || s === "-.INF") return -Infinity;
    if (s === ".nan" || s === ".NaN" || s === ".NAN") return NaN;
    return s;
  }

  /* ---------------- Flow values ----------------
     One line flow style: [a, b], {k: v}, quoted strings and
     plain scalars, arbitrarily nested. */

  function parseFlow(str, lineNo) {
    let i = 0;
    const n = str.length;

    function skipWs() { while (i < n && str[i] === " ") i++; }

    function parseValue() {
      skipWs();
      if (i >= n) fail(lineNo, "unexpected end of flow value.");
      const c = str[i];
      if (c === "[") return parseSeq();
      if (c === "{") return parseMap();
      if (c === '"' || c === "'") return parseQuoted();
      let j = i;
      let depth = 0;
      while (j < n) {
        const d = str[j];
        if (d === "[" || d === "{") depth++;
        if (d === "]" || d === "}") { if (depth === 0) break; depth--; }
        if (d === "," && depth === 0) break;
        j++;
      }
      const raw = str.slice(i, j);
      i = j;
      return parsePlainScalar(raw);
    }

    function parseSeq() {
      const out = [];
      i++; // [
      skipWs();
      if (str[i] === "]") { i++; return out; }
      while (i < n) {
        out.push(parseValue());
        skipWs();
        if (str[i] === ",") { i++; continue; }
        if (str[i] === "]") { i++; return out; }
        fail(lineNo, "expected ',' or ']' in flow sequence.");
      }
      fail(lineNo, "unterminated flow sequence.");
    }

    function parseMap() {
      const out = {};
      i++; // {
      skipWs();
      if (str[i] === "}") { i++; return out; }
      while (i < n) {
        skipWs();
        let key;
        if (str[i] === '"' || str[i] === "'") {
          key = parseQuoted();
        } else {
          let j = i;
          while (j < n && str[j] !== ":" && str[j] !== "," && str[j] !== "}") j++;
          key = String(parsePlainScalar(str.slice(i, j)));
          i = j;
        }
        skipWs();
        if (str[i] !== ":") fail(lineNo, "expected ':' in flow mapping.");
        i++;
        out[String(key)] = parseValue();
        skipWs();
        if (str[i] === ",") { i++; continue; }
        if (str[i] === "}") { i++; return out; }
        fail(lineNo, "expected ',' or '}' in flow mapping.");
      }
      fail(lineNo, "unterminated flow mapping.");
    }

    function parseQuoted() {
      const quote = str[i];
      let out = "";
      i++;
      while (i < n) {
        const c = str[i];
        if (quote === "'") {
          if (c === "'") {
            if (str[i + 1] === "'") { out += "'"; i += 2; continue; }
            i++;
            return out;
          }
          out += c; i++; continue;
        }
        if (c === "\\") {
          const e = str[i + 1];
          const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "0": "\0", "/": "/" };
          if (e === "u") { out += String.fromCharCode(parseInt(str.substr(i + 2, 4), 16)); i += 6; continue; }
          if (map[e] === undefined) fail(lineNo, "unknown escape '\\" + e + "'.");
          out += map[e]; i += 2; continue;
        }
        if (c === '"') { i++; return out; }
        out += c; i++;
      }
      fail(lineNo, "unterminated quoted string.");
    }

    const value = parseValue();
    skipWs();
    if (i < n) fail(lineNo, "trailing characters after flow value.");
    return value;
  }

  /* ---------------- Line preparation ----------------
     Strip comments (quote aware), drop blank lines and the
     document markers, record indentation per line. */

  function stripComment(line) {
    let inS = false, inD = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inD) { if (c === "\\") i++; else if (c === '"') inD = false; continue; }
      if (inS) { if (c === "'") inS = false; continue; }
      if (c === '"') inD = true;
      else if (c === "'") inS = true;
      else if (c === "#" && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
        return line.slice(0, i);
      }
    }
    return line;
  }

  function prepareLines(text) {
    const raw = text.replace(/\r\n?/g, "\n").split("\n");
    const lines = [];
    raw.forEach(function (line, idx) {
      const no = idx + 1;
      const lead = line.match(/^[ \t]*/)[0];
      if (lead.indexOf("\t") !== -1 && line.trim() !== "") {
        fail(no, "tabs cannot be used for indentation.");
      }
      const clean = stripComment(line).replace(/\s+$/, "");
      const trimmed = clean.trim();
      if (trimmed === "" || trimmed === "---" || trimmed === "...") return;
      if (trimmed.indexOf("%") === 0) return; // %YAML directive
      lines.push({ indent: clean.match(/^ */)[0].length, text: trimmed, no: no });
    });
    return lines;
  }

  /* ---------------- Block parser ---------------- */

  function splitKey(text, lineNo) {
    // Find the ": " or trailing ":" that ends the key, quote aware.
    let inS = false, inD = false, depth = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inD) { if (c === "\\") i++; else if (c === '"') inD = false; continue; }
      if (inS) { if (c === "'") inS = false; continue; }
      if (c === '"') { inD = true; continue; }
      if (c === "'") { inS = true; continue; }
      if (c === "[" || c === "{") depth++;
      if (c === "]" || c === "}") depth--;
      if (c === ":" && depth === 0 && (i === text.length - 1 || text[i + 1] === " ")) {
        const keyRaw = text.slice(0, i).trim();
        const rest = text.slice(i + 1).trim();
        if (keyRaw === "") fail(lineNo, "empty mapping key.");
        let key;
        if (keyRaw[0] === '"' || keyRaw[0] === "'") key = String(parseFlow(keyRaw, lineNo));
        else key = keyRaw;
        return { key: key, rest: rest };
      }
    }
    return null;
  }

  function parseBlockScalar(lines, start, parentIndent, style, lineNo) {
    // Literal | keeps newlines, folded > joins lines with spaces.
    const chunks = [];
    let i = start;
    let blockIndent = -1;
    while (i < lines.length && lines[i].indent > parentIndent) {
      if (blockIndent === -1) blockIndent = lines[i].indent;
      chunks.push(" ".repeat(Math.max(0, lines[i].indent - blockIndent)) + lines[i].text);
      i++;
    }
    if (!chunks.length) return ["", i];
    const joined = style === ">" ? chunks.join(" ") : chunks.join("\n");
    return [joined + "\n", i];
  }

  function parseBlock(lines, start, indent) {
    if (start >= lines.length) return [null, start];
    const first = lines[start];
    if (first.text === "-" || first.text.indexOf("- ") === 0) {
      return parseSequence(lines, start, indent);
    }
    if (splitKey(first.text, first.no)) {
      return parseMapping(lines, start, indent);
    }
    // A lone scalar document.
    return [parseInline(first.text, first.no), start + 1];
  }

  function parseNested(lines, idx, parentIndent, lineNo) {
    // Value of a key (or dash) with nothing on its own line.
    if (idx >= lines.length) return [null, idx];
    const next = lines[idx];
    if (next.indent > parentIndent) return parseBlock(lines, idx, next.indent);
    // A sequence may sit at the same indent as its parent key.
    if (next.indent === parentIndent && (next.text === "-" || next.text.indexOf("- ") === 0)) {
      return parseSequence(lines, idx, next.indent);
    }
    void lineNo;
    return [null, idx];
  }

  function parseInline(text, lineNo) {
    const s = text.trim();
    if (s === "") return null;
    const c = s[0];
    if (c === "[" || c === "{" || c === '"' || c === "'") return parseFlow(s, lineNo);
    if (c === "&" || c === "*" || c === "!") {
      fail(lineNo, "anchors, aliases and tags are not supported.");
    }
    return parsePlainScalar(s);
  }

  function parseMapping(lines, start, indent) {
    const out = {};
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.indent < indent) break;
      if (line.indent > indent) fail(line.no, "unexpected indentation.");
      if (line.text === "-" || line.text.indexOf("- ") === 0) break;
      const parts = splitKey(line.text, line.no);
      if (!parts) fail(line.no, "expected a 'key: value' mapping entry.");
      i++;
      if (parts.rest === "|" || parts.rest === ">" || parts.rest === "|-" || parts.rest === ">-") {
        const res = parseBlockScalar(lines, i, indent, parts.rest[0], line.no);
        out[parts.key] = parts.rest.endsWith("-") ? res[0].replace(/\n$/, "") : res[0];
        i = res[1];
      } else if (parts.rest !== "") {
        out[parts.key] = parseInline(parts.rest, line.no);
      } else {
        const res = parseNested(lines, i, indent, line.no);
        out[parts.key] = res[0];
        i = res[1];
      }
    }
    return [out, i];
  }

  function parseSequence(lines, start, indent) {
    const out = [];
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (line.indent !== indent) break;
      if (!(line.text === "-" || line.text.indexOf("- ") === 0)) break;
      const rest = line.text === "-" ? "" : line.text.slice(2).trim();
      i++;
      if (rest === "") {
        const res = parseNested(lines, i, indent, line.no);
        out.push(res[0]);
        i = res[1];
        continue;
      }
      if (rest === "|" || rest === ">" || rest === "|-" || rest === ">-") {
        const res = parseBlockScalar(lines, i, indent, rest[0], line.no);
        out.push(rest.endsWith("-") ? res[0].replace(/\n$/, "") : res[0]);
        i = res[1];
        continue;
      }
      const asKey = splitKey(rest, line.no);
      if (asKey) {
        // "- key: value" opens a mapping whose entries align
        // with the first key, two columns past the dash.
        const virtual = { indent: indent + 2, text: rest, no: line.no };
        const seqLines = [virtual];
        let j = i;
        while (j < lines.length && lines[j].indent >= indent + 2) { seqLines.push(lines[j]); j++; }
        const res = parseMapping(seqLines, 0, indent + 2);
        out.push(res[0]);
        i = i + (res[1] - 1);
        continue;
      }
      out.push(parseInline(rest, line.no));
    }
    return [out, i];
  }

  function parseYaml(text) {
    const lines = prepareLines(text);
    if (!lines.length) return null;
    const res = parseBlock(lines, 0, lines[0].indent);
    if (res[1] < lines.length) {
      fail(lines[res[1]].no, "content after the document end, check indentation.");
    }
    return res[0];
  }

  /* ---------------- Serializer ---------------- */

  function needsQuoting(s) {
    if (s === "") return true;
    if (s !== s.trim()) return true;
    if (/[\n\r\t]/.test(s)) return true;
    if (/^(null|Null|NULL|~|true|True|TRUE|false|False|FALSE)$/.test(s)) return true;
    if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return true;
    if (s.indexOf(": ") !== -1 || s.endsWith(":") || s.indexOf(" #") !== -1) return true;
    if (/^[!&*\[\]{},#|>@`"'%\-?:]/.test(s) && s.length > 1 || s === "-" || s === "?" || s === ":") return true;
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) return true;
    return false;
  }

  function scalarToYaml(v) {
    if (v === null || v === undefined) return "null";
    if (v === true) return "true";
    if (v === false) return "false";
    if (typeof v === "number") {
      if (Number.isNaN(v)) return ".nan";
      if (v === Infinity) return ".inf";
      if (v === -Infinity) return "-.inf";
      return String(v);
    }
    const s = String(v);
    if (s.indexOf("\n") !== -1) return JSON.stringify(s); // single line, escaped
    return needsQuoting(s) ? JSON.stringify(s) : s;
  }

  function emit(value, indent, lines) {
    const pad = "  ".repeat(indent);
    if (Array.isArray(value)) {
      if (!value.length) { lines.push(pad + "[]"); return; }
      value.forEach(function (item) {
        if (item !== null && typeof item === "object") {
          if (Array.isArray(item) && !item.length) { lines.push(pad + "- []"); return; }
          if (!Array.isArray(item) && !Object.keys(item).length) { lines.push(pad + "- {}"); return; }
          const sub = [];
          emit(item, indent + 1, sub);
          // Pull the first child line up beside the dash.
          sub[0] = pad + "- " + sub[0].slice((indent + 1) * 2);
          sub.forEach(function (l) { lines.push(l); });
        } else {
          lines.push(pad + "- " + scalarToYaml(item));
        }
      });
      return;
    }
    if (value !== null && typeof value === "object") {
      const keys = Object.keys(value);
      if (!keys.length) { lines.push(pad + "{}"); return; }
      keys.forEach(function (key) {
        const v = value[key];
        const k = needsQuoting(key) ? JSON.stringify(key) : key;
        if (v !== null && typeof v === "object") {
          if (Array.isArray(v) && !v.length) { lines.push(pad + k + ": []"); return; }
          if (!Array.isArray(v) && !Object.keys(v).length) { lines.push(pad + k + ": {}"); return; }
          lines.push(pad + k + ":");
          emit(v, Array.isArray(v) ? indent : indent + 1, lines);
        } else {
          lines.push(pad + k + ": " + scalarToYaml(v));
        }
      });
      return;
    }
    lines.push(pad + scalarToYaml(value));
  }

  function toYaml(value) {
    const lines = [];
    emit(value, 0, lines);
    return lines.join("\n") + "\n";
  }

  /* ---------------- Tool ---------------- */

  DT.tools.yaml = {
    id: "yaml",
    name: "YAML Formatter & Converter",
    category: "Data",
    icon: "fileText",
    description: "Format and validate YAML, or convert between YAML and JSON.",
    keywords: "yaml yml format beautify validate convert json config lint",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Input */
      const input = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-yaml-input",
        rows: "12",
        spellcheck: "false",
        placeholder: "Paste YAML (or JSON) here…",
      });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" });
      const inputError = DT.ui.panel.error(inputPanel);
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      inputPanel.appendChild(DT.ui.panel.head("Input", [DT.ui.panel.pasteBtn(input), clearBtn]));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body" }, [input]));
      const inputStats = DT.ui.panel.bindStats(input);
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [
        inputStats.el,
        DT.ui.panel.hint("Ctrl+Enter to format"),
      ]));
      inputPanel.appendChild(inputError.el);

      /* Actions */
      const btnFormat = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Format" });
      const btnToJson = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "YAML to JSON" });
      const btnToYaml = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "JSON to YAML" });
      const actions = dom.el("div", { class: "dt-yaml-actions" }, [btnFormat, btnToJson, btnToYaml]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-yaml-output",
        rows: "12",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      let lastOp = "format";
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const btnDownload = DT.ui.dlButton({
        getText: () => output.value,
        filename: () => (lastOp === "tojson" ? "data.json" : "data.yaml"),
        mime: "text/plain;charset=utf-8",
        label: "Download",
      });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Output", [DT.ui.panel.wrapBtn(output), btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);
      const outputStats = DT.ui.panel.stats();
      outputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [outputStats]));

      workspace.appendChild(inputPanel);
      workspace.appendChild(actions);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input: input, output: output };
      DT.utils.persist.bind("yaml", input);

      function readValue() {
        const src = input.value;
        const trimmed = src.trim();
        if (trimmed[0] === "{" || trimmed[0] === "[") {
          try { return JSON.parse(src); } catch (e) { /* fall through to YAML */ }
        }
        return parseYaml(src);
      }

      function run(op) {
        lastOp = op;
        const src = input.value;
        inputError.clear();
        if (!src.trim()) {
          output.value = "";
          DT.ui.panel.paintStats(outputStats, "");
          return;
        }
        try {
          if (op === "toyaml") {
            let value;
            try { value = JSON.parse(src); }
            catch (e) { throw new Error("Input is not valid JSON: " + e.message); }
            output.value = toYaml(value);
          } else {
            const value = readValue();
            output.value = op === "tojson" ? JSON.stringify(value, null, 2) + "\n" : toYaml(value);
          }
          DT.ui.panel.paintStats(outputStats, output.value);
          DT.ui.toast.success(op === "format" ? "YAML is valid" : "Converted");
        } catch (err) {
          inputError.show("YAML could not be processed", err.message);
        }
      }

      on(btnFormat, "click", function () { run("format"); });
      on(btnToJson, "click", function () { run("tojson"); });
      on(btnToYaml, "click", function () { run("toyaml"); });
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        inputError.clear();
        input.focus();
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(output.value)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });
      on(input, "keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          run("format");
        }
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
