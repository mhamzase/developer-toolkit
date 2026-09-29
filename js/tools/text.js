/**
 * File: js/tools/text.js
 * Module: Tool — Text Utilities
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

  function countWords(text) {
    if (!text) return 0;
    const m = text.match(/[\p{L}\p{N}\p{M}]+/gu);
    return m ? m.length : 0;
  }
  function countLines(text) {
    if (!text) return 0;
    return text.split("\n").length;
  }
  function splitLines(text) {
    const lines = String(text || "").split(/\r?\n/);
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }

  const OPERATIONS = {
    sortAsc: {
      label: "Sort A→Z",
      fn: (t) =>
        splitLines(t)
          .slice()
          .sort((a, b) => a.localeCompare(b))
          .join("\n"),
    },
    sortDesc: {
      label: "Sort Z→A",
      fn: (t) =>
        splitLines(t)
          .slice()
          .sort((a, b) => b.localeCompare(a))
          .join("\n"),
    },
    dedupe: {
      label: "Remove duplicates",
      fn: (t) => {
        const s = Object.create(null);
        const o = [];
        splitLines(t).forEach((l) => {
          if (!s[l]) {
            s[l] = true;
            o.push(l);
          }
        });
        return o.join("\n");
      },
    },
    removeEmpty: {
      label: "Remove empty lines",
      fn: (t) =>
        splitLines(t)
          .filter((l) => l.trim() !== "")
          .join("\n"),
    },
    trimEach: {
      label: "Trim each line",
      fn: (t) =>
        splitLines(t)
          .map((l) => l.trim())
          .join("\n"),
    },
    trimAll: { label: "Trim whole text", fn: (t) => String(t || "").trim() },
    collapseSpaces: {
      label: "Collapse spaces",
      fn: (t) => String(t || "").replace(/[ \t]+/g, " "),
    },
    reverseLines: {
      label: "Reverse lines",
      fn: (t) => splitLines(t).reverse().join("\n"),
    },
    numberLines: {
      label: "Number lines",
      fn: (t) => {
        const l = splitLines(t);
        const w = String(l.length).length;
        return l
          .map((x, i) => String(i + 1).padStart(w, " ") + ". " + x)
          .join("\n");
      },
    },
    removeNumbering: {
      label: "Strip line numbers",
      fn: (t) =>
        splitLines(t)
          .map((l) => l.replace(/^\s*\d+[.)]\s+/, ""))
          .join("\n"),
    },
  };

  function paintStats(el, text) {
    const dom = DT.ui.dom;
    DT.ui.dom.clear(el);
    const chars = text ? text.length : 0;
    const words = countWords(text);
    const lines = countLines(text);
    const bytes = text ? new TextEncoder().encode(text).length : 0;
    [
      ["Chars", chars],
      ["Words", words],
      ["Lines", lines],
      ["Bytes", bytes],
    ].forEach((pair) => {
      el.appendChild(
        dom.el("span", { class: "dt-stat" }, [
          dom.txt(pair[0] + " "),
          dom.el("span", { class: "dt-stat__value", text: String(pair[1]) }),
        ]),
      );
    });
  }

  function applyOperation(opKey) {
    const op = OPERATIONS[opKey];
    if (!op) return;
    const input = refs.input.value;
    if (!input) {
      DT.ui.toast.info("Input is empty");
      return;
    }
    try {
      const out = op.fn(input);
      refs.output.value = out;
      paintStats(refs.outputStats, out);
      DT.ui.toast.success(op.label);
    } catch (e) {
      DT.ui.toast.error("Operation failed");
    }
  }

  function useOutputAsInput() {
    if (!refs.output.value) {
      DT.ui.toast.info("Output is empty");
      return;
    }
    refs.input.value = refs.output.value;
    paintStats(refs.inputStats, refs.input.value);
    refs.output.value = "";
    paintStats(refs.outputStats, "");
    refs.input.focus();
    DT.ui.toast.success("Moved");
  }

  function copyOutput() {
    const v = refs.output.value;
    if (!v) {
      DT.ui.toast.info("Nothing to copy");
      return;
    }
    DT.utils.clipboard
      .copy(v)
      .then(() => DT.ui.toast.success("Copied"))
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  function clearAll() {
    const snap = { input: refs.input.value, output: refs.output.value };
    if (!snap.input && !snap.output) {
      refs.input.focus();
      return;
    }

    refs.input.value = "";
    refs.output.value = "";
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

  DT.tools.text = {
    id: "text",
    name: "Text Utilities",
    category: "Text",
    icon: "text",
    description: "Counts, sort lines, dedupe, trim whitespace.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const btnUse = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "↑ Use output as input",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [btnUse]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-text-input",
        rows: "8",
        spellcheck: "false",
        placeholder: "Paste or type text here…",
      });
      input.style.whiteSpace = "pre-wrap";
      input.style.fontFamily = "var(--font-mono)";
      input.style.fontSize = "var(--fs-sm)";

      const inputStats = dom.el("div", { class: "dt-stats" });
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Input" }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats]),
      ]);

      const chips = dom.el("div", { class: "dt-chips" });
      Object.keys(OPERATIONS).forEach((key) => {
        const op = OPERATIONS[key];
        const chip = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm",
          text: op.label,
        });
        chip.addEventListener("click", () => applyOperation(key));
        chips.appendChild(chip);
      });

      const opsPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Operations" }),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "12px 16px" } },
          [chips],
        ),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-text-output",
        rows: "8",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      output.style.whiteSpace = "pre-wrap";
      output.style.fontFamily = "var(--font-mono)";
      output.style.fontSize = "var(--fs-sm)";

      const outputStats = dom.el("div", { class: "dt-stats" });
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("text", "txt"),
        mime: "text/plain;charset=utf-8",
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

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(opsPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input, output, inputStats, outputStats };

      on(input, "input", () => paintStats(inputStats, input.value));
      on(btnUse, "click", useOutputAsInput);
      on(btnCopy, "click", copyOutput);
      on(btnClear, "click", clearAll);

      paintStats(inputStats, "");
      paintStats(outputStats, "");

      DT.utils.persist.bind("text", input, {
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
