/**
 * File: js/tools/base64.js
 * Module: Tool — Base64
 * Purpose: Encode/decode Base64 (UTF-8 safe). Optional URL-safe.
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

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(String(str));
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  }

  function toUrlSafe(b64) {
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromUrlSafe(b64) {
    let s = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    return s;
  }
  function pad(b64) {
    let s = b64;
    while (s.length % 4 !== 0) s += "=";
    return s;
  }

  function encodeNow() {
    const raw = refs.input.value;
    if (!raw) {
      DT.ui.toast.info("Input is empty");
      return;
    }
    try {
      let out = utf8ToBase64(raw);
      if (refs.urlSafe.checked) out = toUrlSafe(out);
      refs.output.value = out;
      paintStats(raw, out);
      DT.ui.toast.success("Encoded");
    } catch (e) {
      refs.output.value = "";
      paintStats(raw, "");
      DT.ui.toast.error("Encode failed");
    }
  }

  function decodeNow() {
    const raw = refs.input.value.trim();
    if (!raw) {
      DT.ui.toast.info("Input is empty");
      return;
    }
    const cleaned = raw.replace(/\s+/g, "");
    const standard = refs.urlSafe.checked
      ? pad(fromUrlSafe(cleaned))
      : pad(cleaned);
    if (!/^[A-Za-z0-9+/=]+$/.test(standard)) {
      refs.output.value = "";
      paintStats(raw, "");
      DT.ui.toast.error("Not valid Base64");
      return;
    }
    try {
      const out = base64ToUtf8(standard);
      refs.output.value = out;
      paintStats(raw, out);
      DT.ui.toast.success("Decoded");
    } catch (e) {
      refs.output.value = "";
      paintStats(raw, "");
      DT.ui.toast.error("Decoded bytes are not valid UTF-8");
    }
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
    paintStats("", "");
    refs.input.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.input.value = snap.input;
      refs.output.value = snap.output;
      paintStats(snap.input, snap.output);
    });
  }

  function swap() {
    if (!refs.output.value) {
      DT.ui.toast.info("Output is empty");
      return;
    }
    refs.input.value = refs.output.value;
    refs.output.value = "";
    paintStats(refs.input.value, "");
    refs.input.focus();
  }

  function paintStats(inText, outText) {
    refs.inputStats.textContent =
      (inText ? String(inText).length : 0) + " chars";
    refs.outputStats.textContent =
      (outText ? String(outText).length : 0) + " chars";
  }

  DT.tools.base64 = {
    id: "base64",
    name: "Base64",
    category: "Encoding",
    icon: "code",
    description: "Encode and decode Base64 (UTF-8 safe).",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const urlSafe = dom.el("input", {
        type: "checkbox",
        id: "dt-b64-urlsafe",
      });
      const urlSafeLabel = dom.el(
        "label",
        {
          class: "dt-toolbar__label",
          for: "dt-b64-urlsafe",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            textTransform: "none",
            letterSpacing: "0",
          },
        },
        [urlSafe, dom.txt("URL-safe")],
      );

      const btnEncode = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Encode",
      });
      const btnDecode = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Decode",
      });
      const btnSwap = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "↑ Send to input",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          btnEncode,
          btnDecode,
          btnSwap,
          urlSafeLabel,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-b64-input",
        rows: "6",
        spellcheck: "false",
        placeholder:
          "Text or Base64…  (Ctrl+Enter = Encode, Ctrl+Shift+Enter = Decode)",
      });
      const inputStats = dom.el("div", { class: "dt-help", text: "0 chars" });

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Input" }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [inputStats]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-b64-output",
        rows: "6",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      const outputStats = dom.el("div", { class: "dt-help", text: "0 chars" });
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });

      const outputPanel = dom.el(
        "div",
        { class: "dt-panel dt-panel--editor" },
        [
          dom.el("div", { class: "dt-panel__head" }, [
            dom.el("div", { class: "dt-panel__title", text: "Output" }),
            dom.el("div", { class: "dt-panel__actions" }, [btnCopy]),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [output]),
          dom.el("div", { class: "dt-panel__foot" }, [outputStats]),
        ],
      );

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { input, output, urlSafe, inputStats, outputStats };

      on(input, "input", () => paintStats(input.value, output.value));
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (e.shiftKey) decodeNow();
          else encodeNow();
        }
      });
      on(btnEncode, "click", encodeNow);
      on(btnDecode, "click", decodeNow);
      on(btnSwap, "click", swap);
      on(btnClear, "click", clearAll);
      on(btnCopy, "click", copyOutput);

      DT.utils.persist.bind("base64", input, {
        onRestore: function () {
          paintStats(input.value, output.value);
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
