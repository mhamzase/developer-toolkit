/**
 * File: js/tools/slug.js
 * Module: Tool — Slug Generator
 * Purpose: Turn titles and headings into clean URL slugs, one
 *          line at a time, with separator, case and length
 *          options.
 * Notes: Accented characters are transliterated (NFD strip plus
 *        a small map for letters NFD cannot split, like ß and ø)
 *        so "Café Über" becomes "cafe-uber", never "caf-ber".
 *        Conversion is live as you type. All processing local.
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

  /* Letters that Unicode NFD does not decompose. */
  const EXTRA = {
    "ß": "ss", "æ": "ae", "Æ": "Ae", "œ": "oe", "Œ": "Oe",
    "ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "ł": "l", "Ł": "L",
    "þ": "th", "Þ": "Th", "ð": "d", "Ð": "D", "ı": "i",
  };

  function slugify(text, opts) {
    let s = String(text).replace(/[ßæÆœŒøØđĐłŁþÞðÐı]/g, function (c) { return EXTRA[c] || c; });
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/&/g, " and ");
    if (opts.lower) s = s.toLowerCase();
    s = s.replace(/[^a-zA-Z0-9]+/g, opts.sep);
    // Trim separators from both ends (separator may be multi char safe: single char only)
    while (s.indexOf(opts.sep) === 0) s = s.slice(opts.sep.length);
    while (s.endsWith(opts.sep)) s = s.slice(0, -opts.sep.length);
    if (opts.max > 0 && s.length > opts.max) {
      let cut = s.slice(0, opts.max);
      const lastSep = cut.lastIndexOf(opts.sep);
      if (lastSep > 0) cut = cut.slice(0, lastSep);
      s = cut;
    }
    return s;
  }

  /* ---------------- Tool ---------------- */

  DT.tools.slug = {
    id: "slug",
    name: "Slug Generator",
    category: "Text",
    icon: "pilcrow",
    description: "Turn titles and headings into clean, URL friendly slugs.",
    keywords: "slug url permalink seo title heading friendly kebab",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Input */
      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-slug-input",
        rows: "8",
        spellcheck: "false",
        placeholder: "One title per line, e.g. Café Über: A Beginner's Guide!",
      });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" });
      const clearBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      inputPanel.appendChild(DT.ui.panel.head("Titles", [DT.ui.panel.pasteBtn(input), clearBtn]));
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__body" }, [input]));
      const inputStats = DT.ui.panel.bindStats(input);
      inputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [inputStats.el]));
      const inputError = DT.ui.panel.error(inputPanel);
      inputPanel.appendChild(inputError.el);

      /* Options */
      const sepSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-slug-sep" }, [
        dom.el("option", { value: "-", text: "Hyphen -" }),
        dom.el("option", { value: "_", text: "Underscore _" }),
        dom.el("option", { value: ".", text: "Dot ." }),
      ]);
      const lowerChk = dom.el("input", { type: "checkbox", id: "dt-slug-lower" });
      lowerChk.checked = true;
      const lowerLabel = dom.el("label", { class: "dt-toolbar__label dt-slug-check" }, [
        lowerChk,
        dom.el("span", { text: "Lowercase" }),
      ]);
      const maxInput = dom.el("input", {
        type: "number",
        class: "dt-input dt-input--sm",
        id: "dt-slug-max",
        min: "0",
        value: "0",
        title: "Maximum length, 0 means no limit",
      });
      const options = dom.el("div", { class: "dt-slug-options" }, [
        dom.el("span", { class: "dt-toolbar__label", text: "Separator" }),
        sepSel,
        lowerLabel,
        dom.el("span", { class: "dt-toolbar__label", text: "Max length" }),
        maxInput,
      ]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-slug-output",
        rows: "8",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Slugs appear here as you type…",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Slugs", [DT.ui.panel.wrapBtn(output), btnCopy]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);
      const outputStats = DT.ui.panel.stats();
      outputPanel.appendChild(dom.el("div", { class: "dt-panel__foot" }, [outputStats]));

      workspace.appendChild(inputPanel);
      workspace.appendChild(options);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input: input, output: output };
      DT.utils.persist.bind("slug", input, { onRestore: function () { run(); } });

      function run() {
        const opts = {
          sep: sepSel.value,
          lower: lowerChk.checked,
          max: Math.max(0, parseInt(maxInput.value, 10) || 0),
        };
        const lines = input.value.split("\n");
        output.value = lines.map(function (line) {
          return line.trim() === "" ? "" : slugify(line, opts);
        }).join("\n");
        DT.ui.panel.paintStats(outputStats, output.value);
      }

      on(input, "input", run);
      on(sepSel, "change", run);
      on(lowerChk, "change", run);
      on(maxInput, "input", run);
      on(clearBtn, "click", function () {
        input.value = "";
        input.dispatchEvent(new window.Event("input", { bubbles: true }));
        input.focus();
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(output.value)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });
      run();
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
