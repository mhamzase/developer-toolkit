/**
 * File: js/tools/url.js
 * Module: Tool — URL Encoder / Decoder
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
  function mode() {
    return refs.mode.value;
  }

  function encodeNow() {
    const raw = refs.input.value;
    if (!raw) {
      DT.ui.toast.info("Input is empty");
      return;
    }
    try {
      const out =
        mode() === "component" ? encodeURIComponent(raw) : encodeURI(raw);
      refs.output.value = out;
      clearAnalysis();
      paintStats(raw, out);
      DT.ui.toast.success("Encoded");
    } catch (e) {
      refs.output.value = "";
      paintStats(raw, "");
      DT.ui.toast.error("Encode failed");
    }
  }

  function decodeNow() {
    const raw = refs.input.value;
    if (!raw) {
      DT.ui.toast.info("Input is empty");
      return;
    }
    try {
      const out =
        mode() === "component" ? decodeURIComponent(raw) : decodeURI(raw);
      refs.output.value = out;
      paintStats(raw, out);
      analyze(raw);
      DT.ui.toast.success("Decoded");
    } catch (e) {
      refs.output.value = "";
      clearAnalysis();
      paintStats(raw, "");
      DT.ui.toast.error("Malformed URI sequence");
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
    clearAnalysis();
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
    clearAnalysis();
    refs.input.focus();
  }

  function paintStats(inText, outText) {
    DT.ui.panel.paintStats(refs.inputStats, inText ? String(inText) : "");
    DT.ui.panel.paintStats(refs.outputStats, outText ? String(outText) : "");
  }

  function clearAnalysis() {
    DT.ui.dom.clear(refs.analysisSlot);
  }

  function analyze(raw) {
    clearAnalysis();
    const dom = DT.ui.dom;
    let url;
    try {
      url = new URL(raw);
    } catch (e) {
      return;
    }

    const rows = [];
    rows.push(["Protocol", url.protocol.replace(":", "")]);
    rows.push(["Host", url.host]);
    if (url.pathname && url.pathname !== "/") rows.push(["Path", url.pathname]);
    if (url.search) rows.push(["Query", url.search.slice(1)]);
    if (url.hash) rows.push(["Hash", url.hash.slice(1)]);

    const body = dom.el("div", {
      class: "dt-panel__body",
      style: { padding: "12px 16px" },
    });
    rows.forEach((r) => {
      body.appendChild(
        dom.el(
          "div",
          {
            class: "dt-row",
            style: { gap: "10px", alignItems: "baseline", padding: "4px 0" },
          },
          [
            dom.el("span", { class: "dt-badge", text: r[0] }),
            dom.el("span", {
              class: "dt-help",
              style: { wordBreak: "break-all" },
              text: r[1],
            }),
          ],
        ),
      );
    });

    /* Query params are editable: change a value or remove a row and
       the rebuilt URL below updates (the original input is untouched). */
    const entries = [];
    url.searchParams.forEach((v, k) => entries.push({ key: k, value: v }));
    if (entries.length) {
      body.appendChild(
        dom.el("div", {
          class: "dt-label",
          text: "Query params (editable)",
          style: { marginTop: "10px", marginBottom: "4px" },
        }),
      );
      const rebuiltValue = dom.el("span", {
        class: "dt-help",
        style: { wordBreak: "break-all" },
        text: "",
      });
      function rebuild() {
        const qs = entries
          .filter((e) => e.key !== "")
          .map((e) => encodeURIComponent(e.key) + "=" + encodeURIComponent(e.value))
          .join("&");
        const out =
          url.origin + url.pathname + (qs ? "?" + qs : "") + url.hash;
        rebuiltValue.textContent = out;
        return out;
      }
      const rowsSlot = dom.el("div", {});
      function renderEntryRows() {
        DT.ui.dom.clear(rowsSlot);
        entries.forEach((entry, idx) => {
          const valInput = dom.el("input", {
            type: "text",
            class: "dt-input dt-input--mono",
            value: entry.value,
            "aria-label": "Value of " + entry.key,
          });
          valInput.style.flex = "1 1 auto";
          valInput.addEventListener("change", function () {
            entry.value = valInput.value;
            rebuild();
          });
          const btnRemove = dom.el("button", {
            type: "button",
            class: "dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm",
            text: "\u00d7",
            title: "Remove " + entry.key,
            "aria-label": "Remove " + entry.key,
          });
          btnRemove.addEventListener("click", function () {
            entries.splice(idx, 1);
            renderEntryRows();
            rebuild();
          });
          rowsSlot.appendChild(
            dom.el(
              "div",
              {
                class: "dt-row",
                style: { gap: "10px", alignItems: "center", padding: "4px 0" },
              },
              [
                dom.el("span", { class: "dt-badge dt-badge--accent", text: entry.key }),
                valInput,
                btnRemove,
              ],
            ),
          );
        });
      }
      renderEntryRows();
      body.appendChild(rowsSlot);

      /* Add-a-param row */
      const addKey = dom.el("input", {
        type: "text",
        class: "dt-input",
        placeholder: "new key",
      });
      addKey.style.width = "130px";
      const addVal = dom.el("input", {
        type: "text",
        class: "dt-input",
        placeholder: "value",
      });
      addVal.style.flex = "1 1 auto";
      const btnAdd = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Add param",
      });
      btnAdd.addEventListener("click", function () {
        const k = addKey.value.trim();
        if (!k) return;
        entries.push({ key: k, value: addVal.value });
        addKey.value = "";
        addVal.value = "";
        renderEntryRows();
        rebuild();
      });
      body.appendChild(
        dom.el(
          "div",
          { class: "dt-row", style: { gap: "10px", alignItems: "center", padding: "6px 0" } },
          [addKey, addVal, btnAdd],
        ),
      );

      /* Rebuilt URL row */
      const btnCopyRebuilt = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy URL",
      });
      btnCopyRebuilt.addEventListener("click", function () {
        DT.utils.clipboard
          .copy(rebuild())
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      body.appendChild(
        dom.el(
          "div",
          {
            class: "dt-row",
            style: { gap: "10px", alignItems: "center", padding: "8px 0 2px" },
          },
          [
            dom.el("span", { class: "dt-badge", text: "Rebuilt" }),
            rebuiltValue,
            btnCopyRebuilt,
          ],
        ),
      );
      rebuild();
    }

    refs.analysisSlot.appendChild(
      dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "URL breakdown" }),
        ]),
        body,
      ]),
    );
  }

  DT.tools.url = {
    id: "url",
    name: "URL Encoder",
    category: "Encoding",
    icon: "link",
    description: "Encode or decode URLs. Edit query params in the breakdown.",

    keywords: "uri encode decode percent encoding query params link component parse edit",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const modeSel = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-url-mode" },
        [
          dom.el("option", { value: "component", text: "Component" }),
          dom.el("option", { value: "full", text: "Full URL" }),
        ],
      );
      modeSel.style.width = "130px";

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
          dom.el("span", { class: "dt-toolbar__label", text: "Mode" }),
          modeSel,
          btnEncode,
          btnDecode,
          btnSwap,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-url-input",
        rows: "6",
        spellcheck: "false",
        placeholder:
          "Paste URL or text…  (Ctrl+Enter = Encode, Ctrl+Shift+Enter = Decode)",
      });
      input.style.whiteSpace = "pre-wrap";
      input.style.wordBreak = "break-all";

      const inputStats = DT.ui.panel.stats();

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Input", [
          DT.ui.panel.pasteBtn(input, function () {
            paintStats(input.value, output.value);
          }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [
          inputStats,
          DT.ui.panel.hint("Ctrl+Enter to encode"),
        ]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-url-output",
        rows: "6",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Result appears here…",
      });
      output.style.whiteSpace = "pre-wrap";
      output.style.wordBreak = "break-all";

      const outputStats = DT.ui.panel.stats();
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("url", "txt"),
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

      const analysisSlot = dom.el("div", {
        style: { display: "flex", flexDirection: "column", gap: "16px" },
      });

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      workspace.appendChild(analysisSlot);
      container.appendChild(workspace);

      refs = {
        input,
        output,
        mode: modeSel,
        inputStats,
        outputStats,
        analysisSlot,
      };

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

      DT.utils.persist.bind("url", input, {
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
