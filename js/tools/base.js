/**
 * File: js/tools/base.js
 * Module: Tool — Number Base Converter
 * Purpose: Convert integers between bases 2 and 36 without precision
 *          loss (BigInt), with a live table for the common bases.
 * Notes: All processing local. No network.
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

  const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /**
   * Parse a digit string in the given base into a BigInt.
   * Returns null when a digit is invalid for the base.
   */
  function parseInBase(str, base) {
    let s = String(str).trim().toUpperCase();
    let negative = false;
    if (s.startsWith("-")) { negative = true; s = s.slice(1); }
    if (s.startsWith("+")) s = s.slice(1);
    // Accept the matching prefix for the common bases.
    if (base === 16 && s.startsWith("0X")) s = s.slice(2);
    if (base === 2 && s.startsWith("0B")) s = s.slice(2);
    if (base === 8 && s.startsWith("0O")) s = s.slice(2);
    if (!s) return null;
    let value = 0n;
    const B = BigInt(base);
    for (let i = 0; i < s.length; i++) {
      const d = DIGITS.indexOf(s[i]);
      if (d === -1 || d >= base) return null;
      value = value * B + BigInt(d);
    }
    return negative ? -value : value;
  }

  function groupDigits(str, size) {
    let sign = "";
    let s = str;
    if (s.startsWith("-")) { sign = "-"; s = s.slice(1); }
    const parts = [];
    for (let i = s.length; i > 0; i -= size) {
      parts.unshift(s.slice(Math.max(0, i - size), i));
    }
    return sign + parts.join(" ");
  }

  DT.tools.base = {
    id: "base",
    name: "Number Base Converter",
    category: "Data",
    icon: "calculator",
    description: "Convert integers between binary, octal, decimal, hex and more.",

    keywords: "binary octal decimal hex hexadecimal base radix bigint convert number",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const fromSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-base-from" }, [
        dom.el("option", { value: "2", text: "Binary (2)" }),
        dom.el("option", { value: "8", text: "Octal (8)" }),
        dom.el("option", { value: "10", text: "Decimal (10)" }),
        dom.el("option", { value: "16", text: "Hex (16)" }),
        dom.el("option", { value: "36", text: "Base 36" }),
      ]);
      fromSel.value = "10";
      fromSel.style.width = "150px";

      const input = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-base-input",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "Type a number, e.g. 255 or FF",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "From base" }),
          fromSel,
        ]),
      ]);

      const inputPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Value", [DT.ui.panel.pasteBtn(input, function () { convert(); })]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [input]),
      ]);

      const resultSlot = dom.el("div", { id: "dt-base-result" });

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(resultSlot);
      container.appendChild(workspace);

      refs = { input, fromSel, resultSlot };

      function resultRow(label, value) {
        const row = dom.el("div", { class: "dt-result__row" }, [
          dom.el("div", { class: "dt-result__label", text: label }),
          dom.el("div", { class: "dt-result__value", text: value }),
        ]);
        const btn = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--ghost dt-btn--sm",
          text: "Copy",
        });
        btn.addEventListener("click", function () {
          DT.utils.clipboard.copy(value)
            .then(() => DT.ui.toast.success("Copied"))
            .catch(() => DT.ui.toast.error("Copy failed"));
        });
        row.appendChild(btn);
        return row;
      }

      function convert() {
        DT.ui.dom.clear(resultSlot);
        const raw = input.value;
        if (!raw.trim()) return;
        const base = parseInt(fromSel.value, 10);
        const value = parseInBase(raw, base);
        if (value === null) {
          resultSlot.appendChild(
            dom.el("div", { class: "dt-alert dt-alert--error" }, [
              dom.el("div", { style: { fontWeight: "600" }, text: "Not a valid base-" + base + " number" }),
              dom.el("div", { text: "Check the digits: base " + base + " allows " + DIGITS.slice(0, base) + "." }),
            ]),
          );
          return;
        }
        const bin = value.toString(2);
        const bits = value < 0n ? bin.length - 1 : bin.length;
        const body = dom.el("div", { class: "dt-panel__body", style: { padding: "8px 16px" } }, [
          resultRow("Binary (2)", groupDigits(value.toString(2), 4)),
          resultRow("Octal (8)", value.toString(8)),
          resultRow("Decimal (10)", value.toString(10)),
          resultRow("Hex (16)", value.toString(16).toUpperCase()),
          resultRow("Base 36", value.toString(36).toUpperCase()),
          resultRow("Bits", String(bits) + (value < 0n ? " (magnitude, sign excluded)" : "")),
        ]);
        resultSlot.appendChild(
          dom.el("div", { class: "dt-panel" }, [
            dom.el("div", { class: "dt-panel__head" }, [
              dom.el("div", { class: "dt-panel__title", text: "Converted" }),
            ]),
            body,
          ]),
        );
      }

      on(input, "input", convert);
      on(fromSel, "change", convert);
      on(input, "keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); convert(); }
      });

      DT.utils.persist.bind("baseconv", input, { onRestore: convert });
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
