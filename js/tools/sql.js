/**
 * File: js/tools/sql.js
 * Module: Tool — SQL Formatter
 * Purpose: A basic, safe SQL beautifier: clause line breaks, AND/OR
 *          indentation, subquery indentation, keyword casing.
 * Notes: This is a formatter, not a parser. Strings and comments are
 *        preserved verbatim; exotic dialect syntax may need a quick
 *        manual tidy. All processing local.
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

  const KEYWORDS = new Set([
    "SELECT", "FROM", "WHERE", "GROUP", "BY", "ORDER", "HAVING", "LIMIT",
    "OFFSET", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
    "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "VIEW", "JOIN", "LEFT",
    "RIGHT", "INNER", "FULL", "OUTER", "CROSS", "ON", "AND", "OR", "NOT",
    "NULL", "IS", "IN", "LIKE", "BETWEEN", "EXISTS", "CASE", "WHEN",
    "THEN", "ELSE", "END", "AS", "DISTINCT", "UNION", "ALL", "EXCEPT",
    "INTERSECT", "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX",
    "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CONSTRAINT", "DEFAULT",
    "CHECK", "UNIQUE", "RETURNING", "WITH", "OVER", "PARTITION", "ROW_NUMBER",
  ]);

  /** New-line starts: single keywords and two-word clauses. */
  const CLAUSES = new Set([
    "SELECT", "FROM", "WHERE", "HAVING", "LIMIT", "OFFSET", "VALUES",
    "SET", "UNION", "EXCEPT", "INTERSECT", "RETURNING",
  ]);

  /**
   * Tokenize SQL into words, strings, comments, numbers and symbols.
   * Strings and comments keep their exact text.
   */
  function tokenize(sql) {
    const tokens = [];
    const s = String(sql);
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === "-" && s[i + 1] === "-") {
        let j = s.indexOf("\n", i);
        if (j === -1) j = s.length;
        tokens.push({ t: "comment", v: s.slice(i, j) });
        i = j; continue;
      }
      if (ch === "/" && s[i + 1] === "*") {
        let j = s.indexOf("*/", i + 2);
        j = j === -1 ? s.length : j + 2;
        tokens.push({ t: "comment", v: s.slice(i, j) });
        i = j; continue;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        let j = i + 1;
        while (j < s.length) {
          if (s[j] === ch) {
            if (s[j + 1] === ch) { j += 2; continue; } // '' escaped quote
            j++; break;
          }
          if (ch === "'" && s[j] === "\\") j++;
          j++;
        }
        tokens.push({ t: "string", v: s.slice(i, j) });
        i = j; continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < s.length && /[A-Za-z0-9_$]/.test(s[j])) j++;
        tokens.push({ t: "word", v: s.slice(i, j) });
        i = j; continue;
      }
      if (/[0-9]/.test(ch)) {
        let j = i;
        while (j < s.length && /[0-9.]/.test(s[j])) j++;
        tokens.push({ t: "word", v: s.slice(i, j) });
        i = j; continue;
      }
      tokens.push({ t: "symbol", v: ch });
      i++;
    }
    return tokens;
  }

  function caseWord(word, mode) {
    const up = word.toUpperCase();
    if (!KEYWORDS.has(up)) return word;
    if (mode === "lower") return up.toLowerCase();
    if (mode === "keep") return word;
    return up;
  }

  function formatSql(sql, caseMode) {
    const tokens = tokenize(sql);
    const lines = [];
    let line = "";
    let indent = 0;      // subquery depth
    let extra = 0;       // one-off extra indent (AND / OR lines)
    const parens = [];   // true when the paren opened a subquery

    function flush() {
      if (line.trim()) lines.push("  ".repeat(indent + extra) + line.trim());
      line = "";
      extra = 0;
    }
    function add(text) {
      if (!line) line = text;
      else if (text === "," || text === ")" || text === "." || text === ";") line += text;
      else if (line.endsWith("(") || line.endsWith(".")) line += text;
      else line += " " + text;
    }

    for (let idx = 0; idx < tokens.length; idx++) {
      const tok = tokens[idx];
      if (tok.t === "word") {
        const up = tok.v.toUpperCase();
        const next = tokens[idx + 1];
        const nextUp = next && next.t === "word" ? next.v.toUpperCase() : "";

        // Two-word clauses: GROUP BY / ORDER BY / DELETE FROM
        if ((up === "GROUP" || up === "ORDER") && nextUp === "BY") {
          flush();
          add(caseWord(tok.v, caseMode) + " " + caseWord(next.v, caseMode));
          idx++;
          continue;
        }
        if (CLAUSES.has(up) || up === "INSERT" || up === "UPDATE" || up === "DELETE" || up === "CREATE" || up === "WITH") {
          flush();
          add(caseWord(tok.v, caseMode));
          continue;
        }
        // Joins start a new line at the current depth; compound
        // forms (LEFT OUTER JOIN and friends) stay on one line.
        if (up === "JOIN") {
          flush();
          add(caseWord(tok.v, caseMode));
          continue;
        }
        if (up === "LEFT" || up === "RIGHT" || up === "INNER" || up === "FULL" || up === "CROSS") {
          let phrase = caseWord(tok.v, caseMode);
          let consumed = 0;
          const after1 = tokens[idx + 1];
          const after2 = tokens[idx + 2];
          if (after1 && after1.t === "word" && after1.v.toUpperCase() === "OUTER") {
            phrase += " " + caseWord(after1.v, caseMode);
            consumed = 1;
            if (after2 && after2.t === "word" && after2.v.toUpperCase() === "JOIN") {
              phrase += " " + caseWord(after2.v, caseMode);
              consumed = 2;
            }
          } else if (after1 && after1.t === "word" && after1.v.toUpperCase() === "JOIN") {
            phrase += " " + caseWord(after1.v, caseMode);
            consumed = 1;
          }
          if (consumed) {
            flush();
            add(phrase);
            idx += consumed;
            continue;
          }
        }
        // AND / OR continue on their own indented line inside WHERE etc.
        if (up === "AND" || up === "OR") {
          flush();
          extra = 1;
          line = caseWord(tok.v, caseMode);
          continue;
        }
        add(caseWord(tok.v, caseMode));
        continue;
      }
      if (tok.t === "symbol" && tok.v === "(") {
        const next = tokens[idx + 1];
        const isSub = next && next.t === "word" && next.v.toUpperCase() === "SELECT";
        add("(");
        if (isSub) {
          flush();
          indent++;
          parens.push(true);
        } else {
          parens.push(false);
        }
        continue;
      }
      if (tok.t === "symbol" && tok.v === ")") {
        if (parens.pop()) {
          // Flush the pending inner line at the subquery depth first,
          // then step back out and place the closing paren.
          flush();
          indent = Math.max(0, indent - 1);
        }
        add(")");
        continue;
      }
      if (tok.t === "symbol" && tok.v === ";") {
        add(";");
        flush();
        continue;
      }
      add(tok.v);
    }
    flush();
    return lines.join("\n");
  }

  function minifySql(sql) {
    return tokenize(sql)
      .map(function (t) { return t.v; })
      .join(" ")
      .replace(/\s+([,.;)])/g, "$1")
      .replace(/([(])\s+/g, "$1")
      .trim();
  }

  DT.tools.sql = {
    id: "sql",
    name: "SQL Formatter",
    category: "Data",
    icon: "database",
    description: "Format SQL with clause breaks and keyword casing.",

    keywords: "sql query format beautify mysql postgres sqlite statement select",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const caseSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-sql-case" }, [
        dom.el("option", { value: "upper", text: "UPPER keywords" }),
        dom.el("option", { value: "lower", text: "lower keywords" }),
        dom.el("option", { value: "keep", text: "Keep as typed" }),
      ]);
      caseSel.style.width = "150px";

      const btnFormat = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Format" });
      const btnMinify = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Minify" });
      const btnSample = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Sample" });
      const btnClear = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Keywords" }),
          caseSel,
          btnFormat,
          btnMinify,
          btnSample,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-sql-input",
        rows: "7",
        spellcheck: "false",
        placeholder: "Paste SQL here…  (Ctrl+Enter to format)",
      });
      const inputStats = DT.ui.panel.stats();
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("SQL", [DT.ui.panel.pasteBtn(input, function () {
          DT.ui.panel.paintStats(inputStats, input.value);
        })]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [
          inputStats,
          DT.ui.panel.hint("Ctrl+Enter to format"),
        ]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-sql-output",
        rows: "7",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Formatted SQL appears here…",
      });
      const outputStats = DT.ui.panel.stats();
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("query", "sql"),
        mime: "text/sql;charset=utf-8",
        label: "Download",
      });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Formatted", [DT.ui.panel.wrapBtn(output), btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
        dom.el("div", { class: "dt-panel__foot" }, [outputStats]),
      ]);

      const note = dom.el("div", {
        class: "dt-help",
        text: "Basic formatter for everyday queries. Strings and comments are preserved exactly.",
      });

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      workspace.appendChild(note);
      container.appendChild(workspace);

      refs = { input, output, caseSel, inputStats, outputStats };

      function paintBoth() {
        DT.ui.panel.paintStats(inputStats, input.value);
        DT.ui.panel.paintStats(outputStats, output.value);
      }
      function doFormat() {
        if (!input.value.trim()) { DT.ui.toast.info("Input is empty"); return; }
        output.value = formatSql(input.value, caseSel.value);
        paintBoth();
        DT.ui.toast.success("Formatted");
      }
      function doMinify() {
        if (!input.value.trim()) { DT.ui.toast.info("Input is empty"); return; }
        output.value = minifySql(input.value);
        paintBoth();
        DT.ui.toast.success("Minified");
      }

      on(input, "input", paintBoth);
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); doFormat(); }
      });
      on(btnFormat, "click", doFormat);
      on(btnMinify, "click", doMinify);
      on(btnSample, "click", function () {
        input.value = "select id, name, city from users u left join orders o on o.user_id = u.id where u.age > 30 and u.city = 'New York' group by u.city order by name limit 10;";
        paintBoth();
        doFormat();
      });
      on(btnCopy, "click", function () {
        if (!output.value) { DT.ui.toast.info("Nothing to copy"); return; }
        DT.utils.clipboard.copy(output.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      on(btnClear, "click", function () {
        const snap = { i: input.value, o: output.value };
        if (!snap.i && !snap.o) { input.focus(); return; }
        input.value = ""; output.value = ""; paintBoth(); input.focus();
        DT.ui.toast.undo("Cleared", function () {
          input.value = snap.i; output.value = snap.o; paintBoth();
        });
      });

      DT.utils.persist.bind("sql", input, { onRestore: paintBoth });
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
