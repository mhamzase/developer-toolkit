/**
 * File: js/tools/jsonpath.js
 * Module: Tool — JSONPath Tester
 * Purpose: Run a JSONPath expression against a JSON document and
 *          list every match with its concrete path and value.
 * Notes: Supports the everyday subset: $ root, .child, ['child'],
 *        [n] indexes (negative counts from the end), [*]
 *        wildcards, .. recursive descent and simple filters
 *        [?(@.field op value)] with ==, !=, >, >=, <, <= or a
 *        plain existence check. All processing local.
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

  /* ---------------- Path parser ---------------- */

  function parsePath(src) {
    const tokens = [];
    let i = 0;
    const n = src.length;
    if (src[0] !== "$") throw new Error("A JSONPath must start with $ (the root).");
    i = 1;

    function readQuoted() {
      const q = src[i];
      let out = "";
      i++;
      while (i < n) {
        const c = src[i];
        if (c === "\\" && i + 1 < n) { out += src[i + 1]; i += 2; continue; }
        if (c === q) { i++; return out; }
        out += c; i++;
      }
      throw new Error("Unterminated string in the path.");
    }

    function readFilter() {
      // src[i] is '(' of (?...)
      let depth = 0;
      let j = i;
      let inS = null;
      while (j < n) {
        const c = src[j];
        if (inS) { if (c === inS) inS = null; j++; continue; }
        if (c === "'" || c === '"') { inS = c; j++; continue; }
        if (c === "(") depth++;
        if (c === ")") { depth--; if (depth === 0) break; }
        j++;
      }
      if (j >= n) throw new Error("Unterminated filter in the path.");
      const expr = src.slice(i + 1, j).trim();
      i = j + 1;
      if (src[i] === "]") i++;
      return parseFilter(expr);
    }

    function parseFilter(expr) {
      const m = expr.match(/^@((?:\.[A-Za-z_$][\w$-]*)+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
      if (m) {
        const litRaw = m[3].trim();
        let literal;
        if (/^'[^']*'$/.test(litRaw) || /^"[^"]*"$/.test(litRaw)) literal = litRaw.slice(1, -1);
        else if (/^-?\d+(\.\d+)?$/.test(litRaw)) literal = Number(litRaw);
        else if (litRaw === "true") literal = true;
        else if (litRaw === "false") literal = false;
        else if (litRaw === "null") literal = null;
        else throw new Error("Unsupported filter value: " + litRaw);
        return { type: "filter", fields: m[1].slice(1).split("."), op: m[2], literal: literal };
      }
      const exist = expr.match(/^@((?:\.[A-Za-z_$][\w$-]*)+)$/);
      if (exist) return { type: "filter", fields: exist[1].slice(1).split("."), op: "exists", literal: null };
      throw new Error("Unsupported filter: " + expr);
    }

    while (i < n) {
      if (src[i] === "." && src[i + 1] === ".") {
        i += 2;
        if (src[i] === "*") { tokens.push({ type: "recursiveAll" }); i++; continue; }
        if (src[i] === "[") continue; // handled by the bracket branch below
        const m = src.slice(i).match(/^[A-Za-z_$][\w$-]*/);
        if (!m) throw new Error("Expected a field name after '..' at position " + i + ".");
        tokens.push({ type: "recursive", key: m[0] });
        i += m[0].length;
        continue;
      }
      if (src[i] === ".") {
        i++;
        if (src[i] === "*") { tokens.push({ type: "wildcard" }); i++; continue; }
        const m = src.slice(i).match(/^[A-Za-z_$][\w$-]*/);
        if (!m) throw new Error("Expected a field name after '.' at position " + i + ".");
        tokens.push({ type: "child", key: m[0] });
        i += m[0].length;
        continue;
      }
      if (src[i] === "[") {
        i++;
        if (src[i] === "*") {
          tokens.push({ type: "wildcard" });
          i++;
          if (src[i] === "]") i++;
          continue;
        }
        if (src[i] === "?") {
          i++;
          tokens.push(readFilter());
          continue;
        }
        if (src[i] === "'" || src[i] === '"') {
          const key = readQuoted();
          tokens.push({ type: "child", key: key });
          if (src[i] === "]") i++;
          continue;
        }
        const m = src.slice(i).match(/^-?\d+/);
        if (m) {
          tokens.push({ type: "index", index: Number(m[0]) });
          i += m[0].length;
          if (src[i] === "]") i++;
          continue;
        }
        throw new Error("Unsupported bracket content at position " + i + ".");
      }
      throw new Error("Unexpected character '" + src[i] + "' at position " + i + ".");
    }
    return tokens;
  }

  /* ---------------- Evaluation ---------------- */

  function pathOf(segments) {
    let out = "$";
    segments.forEach(function (seg) {
      if (typeof seg === "number") out += "[" + seg + "]";
      else if (/^[A-Za-z_$][\w$-]*$/.test(seg)) out += "." + seg;
      else out += "['" + seg.replace(/'/g, "\\'") + "']";
    });
    return out;
  }

  function getField(value, fields) {
    let cur = value;
    for (let k = 0; k < fields.length; k++) {
      if (cur === null || typeof cur !== "object") return { found: false, value: undefined };
      if (!Object.prototype.hasOwnProperty.call(cur, fields[k])) return { found: false, value: undefined };
      cur = cur[fields[k]];
    }
    return { found: true, value: cur };
  }

  function compare(actual, op, literal) {
    switch (op) {
      case "exists": return true;
      case "==": return actual === literal;
      case "!=": return actual !== literal;
      case ">": return actual > literal;
      case ">=": return actual >= literal;
      case "<": return actual < literal;
      case "<=": return actual <= literal;
    }
    return false;
  }

  function evaluate(root, tokens) {
    let current = [{ value: root, path: [] }];

    function expandRecursive(nodes, key) {
      const out = [];
      nodes.forEach(function (node) {
        (function walk(v, p) {
          if (v !== null && typeof v === "object") {
            if (!Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, key)) {
              out.push({ value: v[key], path: p.concat([key]) });
            }
            Object.keys(v).forEach(function (k) {
              walk(v[k], p.concat([Array.isArray(v) ? Number(k) : k]));
            });
          }
        })(node.value, node.path);
      });
      return out;
    }

    function expandRecursiveAll(nodes) {
      const out = [];
      nodes.forEach(function (node) {
        (function walk(v, p) {
          if (v !== null && typeof v === "object") {
            Object.keys(v).forEach(function (k) {
              const seg = Array.isArray(v) ? Number(k) : k;
              out.push({ value: v[k], path: p.concat([seg]) });
              walk(v[k], p.concat([seg]));
            });
          }
        })(node.value, node.path);
      });
      return out;
    }

    tokens.forEach(function (tok) {
      const next = [];
      if (tok.type === "child") {
        current.forEach(function (node) {
          const v = node.value;
          if (v !== null && typeof v === "object" && !Array.isArray(v) &&
              Object.prototype.hasOwnProperty.call(v, tok.key)) {
            next.push({ value: v[tok.key], path: node.path.concat([tok.key]) });
          }
        });
      } else if (tok.type === "index") {
        current.forEach(function (node) {
          const v = node.value;
          if (Array.isArray(v)) {
            const idx = tok.index < 0 ? v.length + tok.index : tok.index;
            if (idx >= 0 && idx < v.length) next.push({ value: v[idx], path: node.path.concat([idx]) });
          }
        });
      } else if (tok.type === "wildcard") {
        current.forEach(function (node) {
          const v = node.value;
          if (v !== null && typeof v === "object") {
            Object.keys(v).forEach(function (k) {
              const seg = Array.isArray(v) ? Number(k) : k;
              next.push({ value: v[k], path: node.path.concat([seg]) });
            });
          }
        });
      } else if (tok.type === "recursive") {
        return void (current = expandRecursive(current, tok.key));
      } else if (tok.type === "recursiveAll") {
        return void (current = expandRecursiveAll(current));
      } else if (tok.type === "filter") {
        current.forEach(function (node) {
          const v = node.value;
          const items = Array.isArray(v) ? v.map(function (item, idx) { return { item: item, seg: idx }; })
            : (v !== null && typeof v === "object" ? [{ item: v, seg: null }] : []);
          items.forEach(function (entry) {
            const got = getField(entry.item, tok.fields);
            if (got.found && compare(got.value, tok.op, tok.literal)) {
              next.push({ value: entry.item, path: entry.seg === null ? node.path : node.path.concat([entry.seg]) });
            }
          });
        });
      }
      current = next;
    });
    return current.map(function (node) {
      return { path: pathOf(node.path), value: node.value };
    });
  }

  function displayValue(v) {
    if (v === null) return "null";
    if (typeof v === "object") return JSON.stringify(v);
    if (typeof v === "string") return '"' + v + '"';
    return String(v);
  }

  /* ---------------- Tool ---------------- */

  DT.tools.jsonpath = {
    id: "jsonpath",
    name: "JSONPath Tester",
    category: "Data",
    icon: "route",
    description: "Query a JSON document with a JSONPath expression and see every match.",
    keywords: "jsonpath query json filter xpath extract path test",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* JSON input */
      const input = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-jsonpath-input",
        rows: "10",
        spellcheck: "false",
        placeholder: "Paste a JSON document here…",
      });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" });
      const inputError = DT.ui.panel.error(inputPanel);
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      inputPanel.appendChild(DT.ui.panel.head("JSON", [DT.ui.panel.pasteBtn(input), clearBtn]));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body" }, [input]));
      const inputStats = DT.ui.panel.bindStats(input);
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [inputStats.el]));
      inputPanel.appendChild(inputError.el);

      /* Query row */
      const query = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--code",
        id: "dt-jsonpath-query",
        spellcheck: "false",
        placeholder: "$.store.book[*].title",
        value: "$..*",
      });
      const btnRun = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Run query" });
      const queryPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("JSONPath"),
        dom.el("div", { class: "dt-panel__body dt-jsonpath-queryrow" }, [query, btnRun]),
      ]);

      /* Results */
      const resultsSlot = dom.el("div", { class: "dt-jsonpath-results" });
      const emptyNote = dom.el("p", { class: "dt-jsonpath-empty", text: "Run a query to see the matches here." });
      resultsSlot.appendChild(emptyNote);
      const btnCopyValues = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy values" });
      const btnCopyPaths = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Copy paths" });
      const resultsPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Matches", [btnCopyPaths, btnCopyValues]),
        dom.el("div", { class: "dt-panel__body" }, [resultsSlot]),
      ]);
      const resultsStats = DT.ui.panel.stats();
      resultsPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [resultsStats]));

      workspace.appendChild(inputPanel);
      workspace.appendChild(queryPanel);
      workspace.appendChild(resultsPanel);
      container.appendChild(workspace);

      let lastMatches = [];
      refs = { input: input, query: query };
      DT.utils.persist.bind("jsonpath", input);

      function renderMatches(matches) {
        DT.ui.dom.clear(resultsSlot);
        lastMatches = matches;
        if (!matches.length) {
          resultsSlot.appendChild(dom.el("p", { class: "dt-jsonpath-empty", text: "No matches for this path." }));
          resultsStats.textContent = "0 matches";
          return;
        }
        matches.forEach(function (m) {
          const row = dom.el("div", { class: "dt-jsonpath-row" }, [
            dom.el("span", { class: "dt-result__label dt-jsonpath-path", text: m.path }),
            dom.el("span", { class: "dt-result__value dt-jsonpath-value", text: displayValue(m.value) }),
          ]);
          resultsSlot.appendChild(row);
        });
        resultsStats.textContent = matches.length + (matches.length === 1 ? " match" : " matches");
      }

      function run() {
        inputError.clear();
        const src = input.value;
        if (!src.trim()) { renderMatches([]); return; }
        let doc;
        try { doc = JSON.parse(src); }
        catch (e) {
          inputError.show("JSON could not be parsed", e.message);
          renderMatches([]);
          return;
        }
        try {
          const tokens = parsePath(query.value.trim());
          renderMatches(evaluate(doc, tokens));
        } catch (err) {
          inputError.show("JSONPath could not be evaluated", err.message);
          renderMatches([]);
        }
      }

      on(btnRun, "click", run);
      on(query, "keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); run(); }
      });
      on(input, "keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
      });
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        inputError.clear();
        renderMatches([]);
        input.focus();
      });
      on(btnCopyValues, "click", function () {
        const values = lastMatches.map(function (m) { return m.value; });
        DT.utils.clipboard.copy(JSON.stringify(values, null, 2))
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });
      on(btnCopyPaths, "click", function () {
        const paths = lastMatches.map(function (m) { return m.path; }).join("\n");
        DT.utils.clipboard.copy(paths)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
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
