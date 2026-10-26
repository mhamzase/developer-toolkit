/**
 * File: js/tools/chmod.js
 * Module: Tool — chmod Calculator
 * Purpose: Build Unix file permissions from rwx checkboxes or an octal
 *          value, showing the octal, symbolic and meaning together.
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

  const GROUPS = [
    { key: "owner", name: "Owner", who: "u" },
    { key: "group", name: "Group", who: "g" },
    { key: "others", name: "Others", who: "o" },
  ];
  const PERMS = [
    { key: "r", name: "Read", bit: 4 },
    { key: "w", name: "Write", bit: 2 },
    { key: "x", name: "Execute", bit: 1 },
  ];

  const PRESETS = [
    { octal: "755", label: "755 · Folders & executables" },
    { octal: "644", label: "644 · Regular files" },
    { octal: "600", label: "600 · Private file" },
    { octal: "700", label: "700 · Private folder" },
    { octal: "444", label: "444 · Read-only for all" },
    { octal: "777", label: "777 · Everyone, everything (risky)" },
  ];

  DT.tools.chmod = {
    id: "chmod",
    name: "chmod Calculator",
    category: "Reference",
    icon: "shield",
    description: "Build Unix permissions: checkboxes, octal and symbolic views.",

    keywords: "unix linux permissions chmod octal rwx file mode 755 644 symbolic",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Checkbox grid: one row per group, one column per permission. */
      const boxes = {};
      const gridKids = [];
      gridKids.push(dom.el("div", { class: "dt-chmod-cell dt-chmod-cell--head", text: "" }));
      PERMS.forEach(function (p) {
        gridKids.push(dom.el("div", { class: "dt-chmod-cell dt-chmod-cell--head", text: p.name }));
      });
      GROUPS.forEach(function (g) {
        boxes[g.key] = {};
        gridKids.push(dom.el("div", { class: "dt-chmod-cell dt-chmod-cell--rowhead", text: g.name }));
        PERMS.forEach(function (p) {
          const cb = dom.el("input", {
            type: "checkbox",
            id: "dt-chmod-" + g.key + "-" + p.key,
            "aria-label": g.name + " " + p.name,
          });
          boxes[g.key][p.key] = cb;
          gridKids.push(dom.el("div", { class: "dt-chmod-cell" }, [
            dom.el("label", { class: "dt-chmod-check", for: cb.id }, [cb]),
          ]));
        });
      });
      const grid = dom.el("div", { class: "dt-chmod-grid" }, gridKids);
      const permsPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Permissions" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [grid]),
      ]);

      /* Octal input: typing a value checks the matching boxes. */
      const octalInput = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-chmod-octal",
        inputmode: "numeric",
        autocomplete: "off",
        spellcheck: "false",
        maxlength: "3",
        placeholder: "755",
      });
      octalInput.style.width = "100px";
      const octalRow = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Octal" }),
          octalInput,
        ]),
      ]);

      /* Presets */
      const chips = dom.el("div", { class: "dt-chips" });
      PRESETS.forEach(function (preset) {
        const chip = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm",
          text: preset.label,
        });
        chip.addEventListener("click", function () { applyOctal(preset.octal); });
        chips.appendChild(chip);
      });
      const presetsPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Common presets" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [chips]),
      ]);

      /* Result */
      const resultSlot = dom.el("div", { id: "dt-chmod-result" });

      workspace.appendChild(permsPanel);
      workspace.appendChild(octalRow);
      workspace.appendChild(presetsPanel);
      workspace.appendChild(resultSlot);
      container.appendChild(workspace);

      refs = { boxes, octalInput, resultSlot };

      function currentOctal() {
        return GROUPS.map(function (g) {
          let digit = 0;
          PERMS.forEach(function (p) {
            if (boxes[g.key][p.key].checked) digit += p.bit;
          });
          return String(digit);
        }).join("");
      }
      function currentSymbolic() {
        return GROUPS.map(function (g) {
          return PERMS.map(function (p) {
            return boxes[g.key][p.key].checked ? p.key : "-";
          }).join("");
        }).join("");
      }
      function meaning() {
        return GROUPS.map(function (g) {
          const names = PERMS.filter(function (p) {
            return boxes[g.key][p.key].checked;
          }).map(function (p) { return p.name.toLowerCase(); });
          return g.name + ": " + (names.length ? names.join(", ") : "no access");
        }).join(" · ");
      }

      function render(fromOctal) {
        const octal = currentOctal();
        if (!fromOctal) octalInput.value = octal;
        DT.ui.dom.clear(resultSlot);
        const command = "chmod " + octal + " <file>";
        const body = dom.el("div", { class: "dt-panel__body", style: { padding: "8px 16px" } }, [
          rowOf("Octal", octal),
          rowOf("Symbolic", currentSymbolic()),
          rowOf("Command", command),
          rowOf("Meaning", meaning()),
        ]);
        resultSlot.appendChild(
          dom.el("div", { class: "dt-panel" }, [
            dom.el("div", { class: "dt-panel__head" }, [
              dom.el("div", { class: "dt-panel__title", text: "Result" }),
            ]),
            body,
          ]),
        );
      }
      function rowOf(label, value) {
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

      function applyOctal(str) {
        const s = String(str || "").trim();
        if (!/^[0-7]{3}$/.test(s)) return false;
        GROUPS.forEach(function (g, i) {
          const digit = parseInt(s[i], 10);
          PERMS.forEach(function (p) {
            boxes[g.key][p.key].checked = (digit & p.bit) !== 0;
          });
        });
        octalInput.value = s;
        render(true);
        return true;
      }

      GROUPS.forEach(function (g) {
        PERMS.forEach(function (p) {
          on(boxes[g.key][p.key], "change", function () { render(false); });
        });
      });
      on(octalInput, "input", function () {
        if (/^[0-7]{3}$/.test(octalInput.value.trim())) applyOctal(octalInput.value);
      });

      applyOctal("755");
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
