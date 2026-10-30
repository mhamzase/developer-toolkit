/**
 * File: js/tools/entities.js
 * Module: Tool — HTML Entity Encoder & Decoder
 * Purpose: Encode text to HTML entities (named, decimal or hex)
 *          and decode entities back to plain text.
 * Notes: Decoding uses a built in table of the common named
 *        entities plus full numeric (decimal and hex) support.
 *        Unknown named entities are left untouched so a decode
 *        never eats text it does not understand. All local.
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

  /* ---------------- Named tables ---------------- */

  // char -> entity name, for the named encode mode
  const TO_NAMED = {
    "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "apos",
    " ": "nbsp", "©": "copy", "®": "reg", "™": "trade",
    "…": "hellip", "—": "mdash", "–": "ndash", "‘": "lsquo",
    "’": "rsquo", "“": "ldquo", "”": "rdquo", "«": "laquo",
    "»": "raquo", "×": "times", "÷": "divide", "±": "plusmn",
    "°": "deg", "·": "middot", "•": "bull", "†": "dagger",
    "‡": "Dagger", "‰": "permil", "€": "euro", "£": "pound",
    "¥": "yen", "¢": "cent", "¤": "curren", "§": "sect",
    "¶": "para", "ß": "szlig", "à": "agrave", "á": "aacute",
    "ä": "auml", "è": "egrave", "é": "eacute", "ë": "euml",
    "í": "iacute", "ï": "iuml", "ó": "oacute", "ö": "ouml",
    "ú": "uacute", "ü": "uuml", "Ä": "Auml", "Ö": "Ouml",
    "Ü": "Uuml", "ñ": "ntilde", "ç": "ccedil",
  };

  // entity name -> char, for decoding (mirror of TO_NAMED)
  const FROM_NAMED = {};
  Object.keys(TO_NAMED).forEach(function (ch) { FROM_NAMED[TO_NAMED[ch]] = ch; });
  FROM_NAMED["apos"] = "'";

  /* ---------------- Engine ---------------- */

  function encode(text, mode) {
    let out = "";
    for (const ch of text) {
      const named = TO_NAMED[ch];
      const code = ch.codePointAt(0);
      if (mode === "named") {
        out += named ? "&" + named + ";" : ch;
      } else if (mode === "named-all") {
        if (named) out += "&" + named + ";";
        else if (code > 126 || code < 32) out += "&#" + code + ";";
        else out += ch;
      } else if (mode === "decimal") {
        if (named && (ch === "&" || ch === "<" || ch === ">" || ch === '"' || ch === "'")) out += "&" + named + ";";
        else if (code > 126 || code < 32 || ch === "&" || ch === "<" || ch === ">" || ch === '"' || ch === "'") out += "&#" + code + ";";
        else out += ch;
      } else if (mode === "hex") {
        if (code > 126 || code < 32 || ch === "&" || ch === "<" || ch === ">" || ch === '"' || ch === "'") {
          out += "&#x" + code.toString(16).toUpperCase() + ";";
        } else out += ch;
      }
    }
    return out;
  }

  function decode(text) {
    return text.replace(/&(#x[0-9a-fA-F]+|#X[0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g, function (whole, body) {
      if (body[0] === "#") {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isFinite(code) && code >= 0 && code <= 0x10FFFF) {
          try { return String.fromCodePoint(code); } catch (e) { return whole; }
        }
        return whole;
      }
      return Object.prototype.hasOwnProperty.call(FROM_NAMED, body) ? FROM_NAMED[body] : whole;
    });
  }

  /* ---------------- Tool ---------------- */

  DT.tools.entities = {
    id: "entities",
    name: "HTML Entity Encoder & Decoder",
    category: "Encoding",
    icon: "entity",
    description: "Encode text to HTML entities, or decode entities back to text.",
    keywords: "html entity entities encode decode escape unescape amp numeric character reference",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Input */
      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-entities-input",
        rows: "10",
        spellcheck: "false",
        placeholder: "Type or paste text here…",
      });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" });
      const inputError = DT.ui.panel.error(inputPanel);
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      inputPanel.appendChild(DT.ui.panel.head("Input", [DT.ui.panel.pasteBtn(input), clearBtn]));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body" }, [input]));
      const inputStats = DT.ui.panel.bindStats(input);
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [
        inputStats.el,
        DT.ui.panel.hint("Ctrl+Enter to convert"),
      ]));
      inputPanel.appendChild(inputError.el);

      /* Actions */
      const modeSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-entities-mode" }, [
        dom.el("option", { value: "named", text: "Encode: named (special chars)" }),
        dom.el("option", { value: "named-all", text: "Encode: named + numeric (non-ASCII)" }),
        dom.el("option", { value: "decimal", text: "Encode: decimal numeric" }),
        dom.el("option", { value: "hex", text: "Encode: hex numeric" }),
        dom.el("option", { value: "decode", text: "Decode entities to text" }),
      ]);
      const btnConvert = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Convert" });
      const btnSwap = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Swap" });
      const actions = dom.el("div", { class: "dt-entities-actions" }, [btnConvert, modeSel, btnSwap]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-entities-output",
        rows: "10",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Output", [DT.ui.panel.wrapBtn(output), btnCopy]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);
      const outputStats = DT.ui.panel.stats();
      outputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [outputStats]));

      workspace.appendChild(inputPanel);
      workspace.appendChild(actions);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input: input, output: output };
      DT.utils.persist.bind("entities", input);

      function run() {
        inputError.clear();
        const src = input.value;
        if (!src) {
          output.value = "";
          DT.ui.panel.paintStats(outputStats, "");
          return;
        }
        output.value = modeSel.value === "decode" ? decode(src) : encode(src, modeSel.value);
        DT.ui.panel.paintStats(outputStats, output.value);
      }

      on(btnConvert, "click", run);
      on(modeSel, "change", run);
      on(btnSwap, "click", function () {
        const tmp = input.value;
        input.value = output.value;
        output.value = tmp;
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        DT.ui.panel.paintStats(outputStats, output.value);
        input.focus();
      });
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        inputError.clear();
        output.value = "";
        DT.ui.panel.paintStats(outputStats, "");
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
          run();
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
