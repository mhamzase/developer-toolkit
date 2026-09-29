/**
 * File: js/tools/hash.js
 * Module: Tool — Hash Generator
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];
  let hashToken = 0;

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }

  function bytesToHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++)
      out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }
  function bytesToBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function digest(algo, text) {
    const data = new TextEncoder().encode(String(text));
    return crypto.subtle.digest(algo, data).then((buf) => new Uint8Array(buf));
  }
  function format(bytes) {
    return refs.format.value === "base64"
      ? bytesToBase64(bytes)
      : bytesToHex(bytes);
  }

  function paintStats(text) {
    if (!refs) return;
    const bytes = text ? new TextEncoder().encode(text).length : 0;
    refs.inputStats.textContent =
      (text ? text.length : 0) + " chars · " + bytes + " bytes";
  }

  function clearOutput() {
    refs.output.value = "";
    refs.outputStats.textContent = "0 chars";
    refs.meta.textContent = "";
  }

  function compute() {
    if (!refs) return;
    const raw = refs.input.value;
    if (!raw) {
      clearOutput();
      return;
    }
    const algo = refs.algo.value;
    const token = ++hashToken;
    digest(algo, raw)
      .then((bytes) => {
        if (!refs || token !== hashToken) return;
        const out = format(bytes);
        refs.output.value = out;
        refs.outputStats.textContent = out.length + " chars";
        refs.meta.textContent =
          algo + " · " + (refs.format.value === "base64" ? "base64" : "hex");
      })
      .catch((e) => {
        if (!refs || token !== hashToken) return;
        refs.output.value = "";
        refs.outputStats.textContent = "0 chars";
        refs.meta.textContent = "error";
        DT.ui.toast.error("Hash failed");
      });
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
    const snap = {
      input: refs.input.value,
      output: refs.output.value,
      meta: refs.meta.textContent,
    };
    if (!snap.input && !snap.output) {
      refs.input.focus();
      return;
    }

    refs.input.value = "";
    clearOutput();
    paintStats("");
    refs.input.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.input.value = snap.input;
      refs.output.value = snap.output;
      refs.meta.textContent = snap.meta;
      paintStats(snap.input);
    });
  }
  DT.tools.hash = {
    id: "hash",
    name: "Hash Generator",
    category: "Security",
    icon: "key",
    description: "SHA-256, SHA-384, SHA-512.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const notice = dom.el("div", { class: "dt-alert dt-alert--info" }, [
        dom.el("div", { style: { fontWeight: "600" }, text: "Local hashing" }),
        dom.el("div", {
          text: "Your input never leaves the browser. Uses Web Crypto (crypto.subtle).",
        }),
      ]);

      const algo = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-hash-algo" },
        [
          dom.el("option", { value: "SHA-256", text: "SHA-256" }),
          dom.el("option", { value: "SHA-384", text: "SHA-384" }),
          dom.el("option", { value: "SHA-512", text: "SHA-512" }),
        ],
      );
      algo.style.width = "120px";

      const format = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-hash-format" },
        [
          dom.el("option", { value: "hex", text: "Hex" }),
          dom.el("option", { value: "base64", text: "Base64" }),
        ],
      );
      format.style.width = "110px";

      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Algorithm" }),
          algo,
          dom.el("span", { class: "dt-toolbar__label", text: "Format" }),
          format,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-hash-input",
        rows: "6",
        spellcheck: "false",
        placeholder: "Type or paste text…  (Ctrl+Enter to hash now)",
      });
      input.style.whiteSpace = "pre-wrap";
      input.style.fontFamily = "var(--font-sans)";
      input.style.fontSize = "var(--fs-sm)";

      const inputStats = dom.el("div", {
        class: "dt-help",
        text: "0 chars · 0 bytes",
      });

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Input" }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-hash-output",
        rows: "3",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Hash appears here…",
      });
      output.style.whiteSpace = "pre-wrap";
      output.style.wordBreak = "break-all";
      output.style.fontFamily = "var(--font-mono)";
      output.style.fontSize = "var(--fs-xs)";

      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("hash", "txt"),
        mime: "text/plain;charset=utf-8",
        label: "Download",
      });
      const outputStats = dom.el("div", { class: "dt-help", text: "0 chars" });
      const meta = dom.el("div", { class: "dt-help", text: "" });

      const outputPanel = dom.el(
        "div",
        { class: "dt-panel dt-panel--editor" },
        [
          dom.el("div", { class: "dt-panel__head" }, [
            dom.el("div", { class: "dt-panel__title", text: "Hash" }),
            dom.el("div", { class: "dt-panel__actions" }, [
              btnCopy,
              btnDownload,
            ]),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [output]),
          dom.el("div", { class: "dt-panel__foot" }, [outputStats, meta]),
        ],
      );

      workspace.appendChild(notice);
      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input, output, algo, format, inputStats, outputStats, meta };

      const computeDebounced = DT.utils.debounce(compute, 180);
      on(input, "input", () => {
        paintStats(input.value);
        computeDebounced();
      });
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          compute();
        }
      });
      on(algo, "change", compute);
      on(format, "change", compute);
      on(btnCopy, "click", copyOutput);
      on(btnClear, "click", clearAll);

      paintStats("");
      input.focus();
    },

    unmount() {
      while (listeners.length) {
        const entry = listeners.pop();
        entry[0].removeEventListener(entry[1], entry[2]);
      }
      refs = null;
      hashToken = 0;
    },
  };
})();
