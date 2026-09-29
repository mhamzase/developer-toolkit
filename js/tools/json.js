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
    const chars = text ? text.length : 0;
    const lines = text ? countLines(text) : 0;
    el.textContent = chars + " chars · " + lines + " lines";
  }

  function showError(info) {
    const slot = refs.errorSlot;
    DT.ui.dom.clear(slot);
    if (!info) return;

    const kids = [
      DT.ui.dom.el("div", {
        style: { fontWeight: "600" },
        text: "Invalid JSON",
      }),
      DT.ui.dom.el("div", { text: info.error }),
    ];
    if (info.line != null) {
      kids.push(
        DT.ui.dom.el("div", {
          style: { marginTop: "2px", opacity: "0.9" },
          text:
            "Line " +
            info.line +
            (info.col != null ? ", column " + info.col : ""),
        }),
      );
    }
    slot.appendChild(
      DT.ui.dom.el("div", { class: "dt-alert dt-alert--error" }, kids),
    );
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
    description: "Format, validate, and minify JSON.",

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
        btnClear,
      ]);

      /* --- Input panel --- */
      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-json-input",
        rows: "6",
        spellcheck: "false",
        placeholder: "Paste JSON here…  (Ctrl+Enter to format)",
      });
      const inputStats = dom.el("div", {
        class: "dt-help",
        text: "0 chars · 0 lines",
      });

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Input" }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats]),
      ]);

      /* --- Error slot --- */
      const errorSlot = dom.el("div", { id: "dt-json-error" });

      /* --- Output panel --- */
      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-json-output",
        rows: "6",
        readonly: "readonly",
        spellcheck: "false",
        placeholder: "Result appears here…",
      });
      const outputStats = dom.el("div", {
        class: "dt-help",
        text: "0 chars · 0 lines",
      });
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
              btnCopy,
              btnDownload,
            ]),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [output]),
          dom.el("div", { class: "dt-panel__foot" }, [outputStats]),
        ],
      );

      /* --- Assemble --- */
      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(errorSlot);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input, output, indent, errorSlot, inputStats, outputStats };

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
