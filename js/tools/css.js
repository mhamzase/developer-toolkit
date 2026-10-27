/**
 * File: js/tools/css.js
 * Module: Tool — CSS Formatter & Minifier
 * Purpose: Beautify CSS with consistent indentation (nested
 *          at-rules included) or minify it by removing comments
 *          and whitespace, with a small token based engine.
 * Notes: The tokenizer keeps strings and comments atomic, so
 *        data URIs, content strings and escapes are never
 *        mangled. Minifying drops comments except /*! ... * /
 *        license banners. All processing local.
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

  /* ---------------- Tokenizer ----------------
     Tokens: word runs, strings ('str'), comments ('comment'),
     whitespace ('ws') and single structural characters. */

  const STRUCT = "{}:;,>+~()[]=";

  function tokenize(css) {
    const tokens = [];
    let i = 0;
    const n = css.length;
    while (i < n) {
      const c = css[i];
      if (c === "/" && css[i + 1] === "*") {
        let j = css.indexOf("*/", i + 2);
        j = j === -1 ? n : j + 2;
        tokens.push({ t: "comment", v: css.slice(i, j) });
        i = j;
        continue;
      }
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n) {
          if (css[j] === "\\") { j += 2; continue; }
          if (css[j] === c) { j++; break; }
          j++;
        }
        tokens.push({ t: "str", v: css.slice(i, j) });
        i = j;
        continue;
      }
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(css[i])) i++;
        tokens.push({ t: "ws", v: " " });
        continue;
      }
      if (STRUCT.indexOf(c) !== -1) {
        tokens.push({ t: c, v: c });
        i++;
        continue;
      }
      let j = i;
      while (j < n) {
        const d = css[j];
        if (/\s/.test(d) || STRUCT.indexOf(d) !== -1 || d === '"' || d === "'") break;
        if (d === "/" && css[j + 1] === "*") break;
        j++;
      }
      tokens.push({ t: "word", v: css.slice(i, j) });
      i = j;
    }
    return tokens;
  }

  /* ---------------- Shared join helpers ---------------- */

  function isWordy(tok) {
    return tok && (tok.t === "word" || tok.t === "str");
  }

  /* Join a selector / at-rule prelude for the formatter. */
  function renderPrelude(tokens) {
    let out = "";
    let depth = 0;
    let prev = null;
    let prevPrev = null;
    let spaceBefore = false; // a ws token was seen in the source
    tokens.forEach(function (tok) {
      if (tok.t === "ws") { spaceBefore = true; return; }
      if (prev) {
        let space = false;
        if (tok.t === "(") {
          space = isWordy(prev) && prevPrev && prevPrev.t !== ":" &&
            prev.v.toLowerCase() !== "url";
          if (prev && prev.t === "word" && !prevPrev) space = true; // @media (...)
        } else if (tok.t === ")") {
          space = false;
        } else if (tok.t === ",") {
          space = false;
        } else if (prev.t === ",") {
          space = true;
        } else if (tok.t === ":") {
          space = false;
        } else if (prev.t === ":") {
          space = depth > 0; // media features: (max-width: 600px)
        } else if (tok.t === ">" || tok.t === "+" || tok.t === "~") {
          space = depth === 0;
        } else if (prev.t === ">" || prev.t === "+" || prev.t === "~") {
          space = depth === 0;
        } else if (tok.t === "[") {
          space = spaceBefore; // a [x] descendant vs a[x] compound
        } else if (prev.t === "]") {
          space = spaceBefore;
        } else if (tok.t === "=" || prev.t === "=") {
          space = false;
        } else if (prev.t === "(") {
          space = false;
        } else if (isWordy(prev) && isWordy(tok)) {
          space = true;
        } else if (prev.t === ")" && isWordy(tok)) {
          space = true;
        }
        if (space) out += " ";
      }
      out += tok.v;
      if (tok.t === "(") depth++;
      if (tok.t === ")") depth = Math.max(0, depth - 1);
      prevPrev = prev;
      prev = tok;
      spaceBefore = false;
    });
    return out;
  }

  /* Join a declaration value for the formatter. */
  function renderValue(tokens) {
    let out = "";
    let depth = 0;
    let prev = null;
    let spaceBefore = false;
    tokens.forEach(function (tok) {
      if (tok.t === "ws") { spaceBefore = true; return; }
      if (prev) {
        let space = false;
        if (tok.t === ")") space = false;
        else if (prev.t === "(") space = false;
        else if (tok.t === "(") space = false; // function call
        else if (tok.t === ",") space = false;
        // Inside parens keep the source spacing (data URIs have
        // comma-joined parts that must stay byte-identical);
        // at the top level a value list gets ", ".
        else if (prev.t === ",") space = depth > 0 ? spaceBefore : true;
        else if (tok.t === ":" || prev.t === ":") space = false;
        else if (prev.t === ")" && isWordy(tok)) space = true;
        else if (tok.t === ";") space = false;
        else if (prev.t === ";") space = false; // data URIs stay intact
        else if (tok.t === "+" && depth > 0) space = true;  // calc()
        else if (prev.t === "+" && depth > 0) space = true;
        else if (tok.t === "/") space = true;  // font shorthand spacing is cosmetic
        else if (prev.t === "/") space = true;
        else if (isWordy(prev) && isWordy(tok)) space = true;
        if (space) out += " ";
      }
      out += tok.v;
      if (tok.t === "(") depth++;
      if (tok.t === ")") depth = Math.max(0, depth - 1);
      prev = tok;
      spaceBefore = false;
    });
    return out;
  }

  /* ---------------- Formatter ----------------
     Recursive chunk parser: a chunk ends at ';' (declaration or
     statement), '{' (nested rule) or '}' (final declaration). */

  function formatCss(css, indentStr) {
    const tokens = tokenize(css);
    let idx = 0;

    function skipWs() {
      while (idx < tokens.length && tokens[idx].t === "ws") idx++;
    }

    function parseItems(depth, inBlock) {
      const lines = [];
      while (true) {
        skipWs();
        if (idx >= tokens.length) {
          if (inBlock) throw new Error("Unbalanced braces: a block is not closed.");
          return lines;
        }
        if (tokens[idx].t === "}") {
          if (!inBlock) throw new Error("Unbalanced braces: unexpected }.");
          idx++;
          return lines;
        }
        // Leading comments get their own line
        while (idx < tokens.length && tokens[idx].t === "comment") {
          lines.push({ depth: depth, text: tokens[idx].v });
          idx++;
          skipWs();
        }
        if (idx >= tokens.length || tokens[idx].t === "}") continue;

        // Read one chunk
        const chunk = [];
        let parens = 0;
        let term = null;
        while (idx < tokens.length) {
          const tok = tokens[idx];
          if (tok.t === "(") parens++;
          if (tok.t === ")") parens = Math.max(0, parens - 1);
          if (parens === 0 && (tok.t === ";" || tok.t === "{" || tok.t === "}")) {
            term = tok.t;
            idx++;
            break;
          }
          chunk.push(tok);
          idx++;
        }
        const meaningful = chunk.filter(function (t) { return t.t !== "ws"; });
        if (!meaningful.length) {
          if (term === "}") {
            if (!inBlock) throw new Error("Unbalanced braces: unexpected }.");
            return lines;
          }
          continue;
        }

        if (term === "{") {
          const prelude = renderPrelude(chunk);
          const inner = parseItems(depth + 1, true);
          if (!inner.length) {
            lines.push({ depth: depth, text: prelude + " {}" });
          } else {
            lines.push({ depth: depth, text: prelude + " {" });
            inner.forEach(function (l) { lines.push(l); });
            lines.push({ depth: depth, text: "}" });
          }
          continue;
        }

        // Declaration or statement
        const first = meaningful[0];
        let colonAt = -1;
        let p2 = 0;
        for (let k = 0; k < chunk.length; k++) {
          const tk = chunk[k];
          if (tk.t === "(") p2++;
          else if (tk.t === ")") p2 = Math.max(0, p2 - 1);
          else if (tk.t === ":" && p2 === 0) { colonAt = k; break; }
        }
        const isDecl = colonAt > 0 && !(first.t === "word" && first.v.charAt(0) === "@");
        if (isDecl) {
          const prop = renderValue(chunk.slice(0, colonAt)).trim();
          const value = renderValue(chunk.slice(colonAt + 1)).trim();
          lines.push({ depth: depth, text: prop + ": " + value + ";" });
        } else {
          lines.push({ depth: depth, text: renderPrelude(chunk) + ";" });
        }
        if (term === "}") {
          if (!inBlock) throw new Error("Unbalanced braces: unexpected }.");
          return lines;
        }
        if (term === null && inBlock) {
          throw new Error("Unbalanced braces: a block is not closed.");
        }
      }
    }

    const lines = parseItems(0, false);
    return lines.map(function (l) {
      return indentStr.repeat(l.depth) + l.text;
    }).join("\n");
  }

  /* ---------------- Minifier ---------------- */

  function minifyCss(css) {
    const tokens = tokenize(css);
    let out = "";
    let prev = null; // last emitted token
    let spaceBefore = false;
    const MEDIA_WORDS = { and: 1, or: 1, not: 1, only: 1 };

    tokens.forEach(function (tok, i) {
      if (tok.t === "ws") { spaceBefore = true; return; }
      if (tok.t === "comment") {
        if (tok.v.indexOf("/*!") === 0) {
          out += tok.v;
          prev = { t: "comment", v: "" };
        }
        return;
      }
      // Drop a ; that sits right before }
      if (tok.t === "}") {
        if (out.charAt(out.length - 1) === ";") out = out.slice(0, -1);
      }
      if (prev) {
        let space = false;
        if (isWordy(prev) && isWordy(tok)) space = true;
        else if (tok.t === "(" && prev.t === "word" && MEDIA_WORDS[prev.v.toLowerCase()]) space = true;
        else if (prev.t === ")" && isWordy(tok)) space = true;
        else if (tok.t === "[" && spaceBefore) space = true;
        else if (prev.t === "]" && spaceBefore && (isWordy(tok) || tok.t === "[")) space = true;
        if (space) out += " ";
      }
      out += tok.v;
      prev = tok;
      spaceBefore = false;
      void i;
    });
    return out.trim();
  }

  /* ---------------- Tool ---------------- */

  DT.tools.css = {
    id: "css",
    name: "CSS Formatter & Minifier",
    category: "Data",
    icon: "pencil",
    description: "Format CSS with clean indentation, or minify it for production.",
    keywords: "css format beautify minify compress stylesheet indent prettify",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Input */
      const input = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-css-input",
        rows: "12",
        spellcheck: "false",
        placeholder: "Paste CSS here, then Format or Minify…",
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
      const indentSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-css-indent" }, [
        dom.el("option", { value: "2", text: "2 spaces" }),
        dom.el("option", { value: "4", text: "4 spaces" }),
        dom.el("option", { value: "tab", text: "Tab" }),
      ]);
      const btnFormat = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Format" });
      const btnMinify = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Minify" });
      const actions = dom.el("div", { class: "dt-css-actions" }, [
        btnFormat,
        btnMinify,
        dom.el("span", { class: "dt-toolbar__label", text: "Indent" }),
        indentSel,
      ]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-css-output",
        rows: "12",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      let lastOp = "format";
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const btnDownload = DT.ui.dlButton({
        getText: () => output.value,
        filename: () => (lastOp === "minify" ? "styles.min.css" : "styles.css"),
        mime: "text/css;charset=utf-8",
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
      DT.utils.persist.bind("css", input);

      function indentString() {
        return indentSel.value === "tab" ? "\t" : " ".repeat(Number(indentSel.value));
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
          const out = op === "minify" ? minifyCss(src) : formatCss(src, indentString());
          output.value = out;
          DT.ui.panel.paintStats(outputStats, out);
          if (op === "minify" && src.length) {
            const saved = src.length - out.length;
            const pct = Math.max(0, Math.round((saved / src.length) * 100));
            outputStats.textContent += " · saved " + saved + " chars (" + pct + "%)";
          }
        } catch (err) {
          inputError.show("CSS could not be processed", err.message);
        }
      }

      on(btnFormat, "click", function () { run("format"); });
      on(btnMinify, "click", function () { run("minify"); });
      on(indentSel, "change", function () { if (lastOp === "format") run("format"); });
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

