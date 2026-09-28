/**
 * File: js/tools/timestamp.js
 * Module: Tool — Timestamp Converter
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
  function pad(n, w) {
    return String(n).padStart(w || 2, "0");
  }

  function formatLocal(d) {
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      " " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes()) +
      ":" +
      pad(d.getSeconds())
    );
  }
  function formatUTC(d) {
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate()) +
      " " +
      pad(d.getUTCHours()) +
      ":" +
      pad(d.getUTCMinutes()) +
      ":" +
      pad(d.getUTCSeconds()) +
      " UTC"
    );
  }
  function dayOfWeekLocal(d) {
    return [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][d.getDay()];
  }
  function tzName() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
    } catch (e) {
      return "Local";
    }
  }
  function tzOffset(d) {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? "+" : "-";
    const abs = Math.abs(off);
    return "UTC" + sign + pad(Math.floor(abs / 60)) + ":" + pad(abs % 60);
  }

  function relFromNow(ms) {
    const now = Date.now();
    let diff = Math.floor((now - ms) / 1000);
    const past = diff >= 0;
    diff = Math.abs(diff);
    if (diff < 2) return "just now";
    const y = Math.floor(diff / 31536000);
    const d = Math.floor((diff % 31536000) / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    const parts = [];
    if (y) parts.push(y + "y");
    if (d && !y) parts.push(d + "d");
    if (h && !y && !d) parts.push(h + "h");
    if (m && !y && !d && !h) parts.push(m + "m");
    if (s && !y && !d && !h && !m) parts.push(s + "s");
    if (!parts.length) parts.push(s + "s");
    return (
      (past ? "" : "in ") + parts.slice(0, 2).join(" ") + (past ? " ago" : "")
    );
  }

  function detectUnit(raw) {
    const s = String(raw).trim().replace("-", "");
    if (!/^\d+$/.test(s)) return null;
    if (s.length <= 10) return "seconds";
    if (s.length <= 13) return "milliseconds";
    return null;
  }

  function resultRow(label, value, copyable) {
    const dom = DT.ui.dom;
    const row = dom.el("div", { class: "dt-result__row" }, [
      dom.el("div", { class: "dt-result__label", text: label }),
      dom.el("div", { class: "dt-result__value", text: value }),
    ]);
    if (copyable) {
      const btn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm",
        "aria-label": "Copy " + label,
        title: "Copy",
      });
      const icon = dom.svg(
        '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      );
      if (icon) btn.appendChild(icon);
      btn.addEventListener("click", () => {
        DT.utils.clipboard
          .copy(value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      row.appendChild(btn);
    }
    return row;
  }

  function renderResultCard(container, rows, title) {
    const dom = DT.ui.dom;
    DT.ui.dom.clear(container);
    const body = dom.el("div", {
      class: "dt-panel__body",
      style: { padding: "8px 16px" },
    });
    rows.forEach((r) =>
      body.appendChild(resultRow(r[0], r[1], r[2] !== false)),
    );
    container.appendChild(
      dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: title || "Result" }),
        ]),
        body,
      ]),
    );
  }

  function renderError(container, title, message) {
    const dom = DT.ui.dom;
    DT.ui.dom.clear(container);
    container.appendChild(
      dom.el("div", { class: "dt-alert dt-alert--error" }, [
        dom.el("div", { style: { fontWeight: "600" }, text: title }),
        dom.el("div", { text: message }),
      ]),
    );
  }

  function buildTsToDate() {
    const dom = DT.ui.dom;
    const wrap = dom.el("div", {
      class: "dt-workspace",
      style: { padding: 0 },
    });

    const tsInput = dom.el("input", {
      type: "text",
      class: "dt-input",
      id: "dt-ts-input",
      inputmode: "numeric",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: "e.g. 1727272600  or  1727272600000",
    });

    const unitGroup = dom.el("div", {
      class: "dt-segmented",
      role: "group",
      "aria-label": "Unit",
    });
    const units = [
      { id: "auto", label: "Auto" },
      { id: "seconds", label: "sec" },
      { id: "milliseconds", label: "ms" },
    ];
    let unit = "auto";
    units.forEach((u) => {
      const btn = dom.el("button", {
        type: "button",
        "data-unit": u.id,
        "aria-pressed": u.id === unit ? "true" : "false",
        text: u.label,
      });
      btn.addEventListener("click", () => {
        unit = u.id;
        DT.ui.dom.qsa("button", unitGroup).forEach((b) => {
          b.setAttribute(
            "aria-pressed",
            b.dataset.unit === unit ? "true" : "false",
          );
        });
        convert();
      });
      unitGroup.appendChild(btn);
    });

    const btnNow = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--secondary dt-btn--sm",
      text: "Now",
    });
    const btnClear = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--ghost dt-btn--sm",
      text: "Clear",
    });

    const inputRow = dom.el("div", { class: "dt-toolbar" }, [
      dom.el("div", { class: "dt-toolbar__group" }, [unitGroup, btnNow]),
      btnClear,
    ]);

    const inputPanel = dom.el("div", { class: "dt-panel" }, [
      dom.el("div", { class: "dt-panel__head" }, [
        dom.el("div", { class: "dt-panel__title", text: "Unix timestamp" }),
      ]),
      dom.el("div", { class: "dt-panel__body", style: { padding: "16px" } }, [
        tsInput,
      ]),
    ]);

    const resultSlot = dom.el("div", { id: "dt-ts-result" });

    wrap.appendChild(inputRow);
    wrap.appendChild(inputPanel);
    wrap.appendChild(resultSlot);

    function convert() {
      const raw = tsInput.value.trim();
      if (!raw) {
        DT.ui.dom.clear(resultSlot);
        return;
      }
      let useUnit = unit;
      if (unit === "auto") {
        useUnit = detectUnit(raw);
        if (!useUnit) {
          renderError(
            resultSlot,
            "Unrecognized timestamp",
            "Could not auto-detect seconds vs ms. Pick a unit manually.",
          );
          return;
        }
      }
      const n = Number(raw);
      if (!isFinite(n)) {
        renderError(resultSlot, "Invalid number", "Enter a numeric timestamp.");
        return;
      }
      const ms = useUnit === "seconds" ? n * 1000 : n;
      const d = new Date(ms);
      if (isNaN(d.getTime())) {
        renderError(
          resultSlot,
          "Out of range",
          "Date is outside the representable range.",
        );
        return;
      }

      renderResultCard(
        resultSlot,
        [
          ["Local", dayOfWeekLocal(d) + ", " + formatLocal(d)],
          ["Timezone", tzName() + " (" + tzOffset(d) + ")"],
          ["UTC", formatUTC(d)],
          ["ISO 8601", d.toISOString()],
          ["Relative", relFromNow(ms), false],
        ],
        "Result",
      );
    }

    on(tsInput, "input", convert);
    on(tsInput, "keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        convert();
      }
    });
    on(btnNow, "click", () => {
      const now = Date.now();
      if (unit === "milliseconds") tsInput.value = String(now);
      else tsInput.value = String(Math.floor(now / 1000));
      convert();
    });
      on(btnClear, 'click', () => {
      const snap = dtInput.value;
      if (!snap) { dtInput.focus(); return; }
      dtInput.value = '';
      DT.ui.dom.clear(resultSlot);
      dtInput.focus();
      DT.ui.toast.undo('Cleared', function () {
        dtInput.value = snap;
        convert();
      });
    });
    
    return wrap;
  }

  function buildDateToTs() {
    const dom = DT.ui.dom;
    const wrap = dom.el("div", {
      class: "dt-workspace",
      style: { padding: 0 },
    });

    const dtInput = dom.el("input", {
      type: "datetime-local",
      class: "dt-input",
      id: "dt-dt-input",
      step: "1",
    });
    const btnNow = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--secondary dt-btn--sm",
      text: "Now",
    });
    const btnClear = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--ghost dt-btn--sm",
      text: "Clear",
    });

    const inputRow = dom.el("div", { class: "dt-toolbar" }, [
      dom.el("div", { class: "dt-toolbar__group" }, [btnNow]),
      btnClear,
    ]);

    const inputPanel = dom.el("div", { class: "dt-panel" }, [
      dom.el("div", { class: "dt-panel__head" }, [
        dom.el("div", { class: "dt-panel__title", text: "Local date & time" }),
      ]),
      dom.el("div", { class: "dt-panel__body", style: { padding: "16px" } }, [
        dtInput,
      ]),
    ]);

    const resultSlot = dom.el("div", { id: "dt-dt-result" });

    wrap.appendChild(inputRow);
    wrap.appendChild(inputPanel);
    wrap.appendChild(resultSlot);

    function parseLocal(value) {
      if (!value) return null;
      const parts = value.split("T");
      if (parts.length !== 2) return null;
      const dParts = parts[0].split("-").map(Number);
      const tParts = parts[1].split(":").map(Number);
      if (dParts.length !== 3 || tParts.length < 2) return null;
      const [y, m, day] = dParts;
      const [hh, mm, ss] = [tParts[0], tParts[1], tParts[2] || 0];
      const d = new Date(y, m - 1, day, hh, mm, ss, 0);
      return isNaN(d.getTime()) ? null : d;
    }
    function toLocalValue(d) {
      return (
        d.getFullYear() +
        "-" +
        pad(d.getMonth() + 1) +
        "-" +
        pad(d.getDate()) +
        "T" +
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes()) +
        ":" +
        pad(d.getSeconds())
      );
    }

    function convert() {
      const d = parseLocal(dtInput.value);
      if (!d) {
        DT.ui.dom.clear(resultSlot);
        return;
      }
      const ms = d.getTime();
      const sec = Math.floor(ms / 1000);
      renderResultCard(
        resultSlot,
        [
          ["Seconds", String(sec)],
          ["Milliseconds", String(ms)],
          ["UTC", formatUTC(d)],
          ["ISO 8601", d.toISOString()],
          ["Timezone", tzName() + " (" + tzOffset(d) + ")", false],
          ["Relative", relFromNow(ms), false],
        ],
        "Result",
      );
    }

    on(dtInput, "input", convert);
    on(dtInput, "change", convert);
    on(btnNow, "click", () => {
      dtInput.value = toLocalValue(new Date());
      convert();
    });
    on(btnClear, "click", () => {
      dtInput.value = "";
      DT.ui.dom.clear(resultSlot);
      dtInput.focus();
    });

    return wrap;
  }

  DT.tools.timestamp = {
    id: "timestamp",
    name: "Timestamp Converter",
    category: "Conversion",
    icon: "calendarClock",
    description: "Convert Unix time ↔ readable dates.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });
      let mode = "ts2date";

      const tabsWrap = dom.el("div", { class: "dt-tabs", role: "tablist" });
      const tabs = [
        { id: "ts2date", label: "Timestamp → Date" },
        { id: "date2ts", label: "Date → Timestamp" },
      ];
      const buttons = {};
      tabs.forEach((t) => {
        const btn = dom.el("button", {
          type: "button",
          class: "dt-tab",
          role: "tab",
          "aria-selected": t.id === mode ? "true" : "false",
          text: t.label,
        });
        btn.addEventListener("click", () => {
          if (mode === t.id) return;
          mode = t.id;
          Object.keys(buttons).forEach((k) => {
            buttons[k].setAttribute(
              "aria-selected",
              k === mode ? "true" : "false",
            );
          });
          renderPanel();
        });
        buttons[t.id] = btn;
        tabsWrap.appendChild(btn);
      });

      const panel = dom.el("div");

      workspace.appendChild(tabsWrap);
      workspace.appendChild(panel);
      container.appendChild(workspace);

      function renderPanel() {
        DT.ui.dom.clear(panel);
        panel.appendChild(
          mode === "ts2date" ? buildTsToDate() : buildDateToTs(),
        );
      }

      renderPanel();
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
