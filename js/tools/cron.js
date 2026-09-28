/**
 * File: js/tools/cron.js
 * Module: Tool — Cron Parser
 * Purpose: Parse cron expressions, describe them, and predict next runs.
 * Notes:
 *   - Supports standard 5-field cron (minute hour day month weekday).
 *   - Supports wildcards, ranges, steps, and comma lists.
 *   - Step syntax uses a slash, e.g. "star-slash-5" means every 5 units.
 *   - Common aliases: @yearly, @monthly, @weekly, @daily, @hourly.
 *   - Does NOT handle seconds, @reboot, or L/W/# extensions.
 *   - All processing local.
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

  /* ---------------- Aliases ---------------- */

  const ALIASES = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@hourly": "0 * * * *",
  };

  /* ---------------- Field definitions ---------------- */

  const FIELDS = [
    { key: "minute", name: "Minute", min: 0, max: 59 },
    { key: "hour", name: "Hour", min: 0, max: 23 },
    { key: "day", name: "Day", min: 1, max: 31 },
    { key: "month", name: "Month", min: 1, max: 12 },
    {
      key: "weekday",
      name: "Weekday",
      min: 0,
      max: 6,
      alias: { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 },
    },
  ];

  const MONTH_NAMES = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  /* ---------------- Parsing ---------------- */

  /**
   * Parse one cron field into a sorted array of valid integers.
   * @param {string} token
   * @param {{min:number, max:number, alias?:Object}} field
   * @returns {{ok:true, values:number[]} | {ok:false, error:string}}
   */
  function parseField(token, field) {
    const values = new Set();
    const parts = String(token).split(",");

    for (let p = 0; p < parts.length; p++) {
      const part = parts[p].trim();
      if (!part) return { ok: false, error: "Empty list item." };

      // Step: "*/n", "a-b/n", "a/n"
      let step = 1;
      let body = part;
      const slash = part.indexOf("/");
      if (slash !== -1) {
        body = part.slice(0, slash);
        const stepStr = part.slice(slash + 1);
        step = parseInt(stepStr, 10);
        if (isNaN(step) || step < 1)
          return { ok: false, error: 'Invalid step "' + stepStr + '".' };
      }

      let lo, hi;

      if (body === "*") {
        lo = field.min;
        hi = field.max;
      } else if (body.indexOf("-") !== -1) {
        const seg = body.split("-");
        if (seg.length !== 2)
          return { ok: false, error: 'Invalid range "' + body + '".' };
        lo = parseValue(seg[0], field);
        hi = parseValue(seg[1], field);
        if (lo == null || hi == null)
          return { ok: false, error: 'Invalid range value in "' + part + '".' };
        if (lo > hi) {
          const t = lo;
          lo = hi;
          hi = t;
        }
      } else {
        lo = parseValue(body, field);
        hi = lo;
        if (lo == null)
          return { ok: false, error: 'Invalid value "' + body + '".' };
      }

      if (lo < field.min || hi > field.max) {
        return {
          ok: false,
          error:
            "Value out of range " +
            field.min +
            "-" +
            field.max +
            ' in "' +
            part +
            '".',
        };
      }

      for (let v = lo; v <= hi; v += step) values.add(v);
    }

    return { ok: true, values: Array.from(values).sort((a, b) => a - b) };
  }

  function parseValue(str, field) {
    const s = String(str).trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (field.alias) {
      const key = s.toLowerCase();
      if (key in field.alias) return field.alias[key];
    }
    // Month names
    if (field.key === "month") {
      const short = s.slice(0, 3).toLowerCase();
      const idx = MONTH_NAMES.findIndex(
        (m) => m.toLowerCase().indexOf(short) === 0,
      );
      if (idx > 0) return idx;
    }
    return null;
  }

  /**
   * Parse a full cron expression.
   * @param {string} expr
   * @returns {{ok:true, fields:Object, expr:string} | {ok:false, error:string}}
   */
  function parseCron(expr) {
    let src = String(expr || "").trim();
    if (!src) return { ok: false, error: "Expression is empty." };

    if (src.charAt(0) === "@") {
      const alias = ALIASES[src.toLowerCase()];
      if (!alias) return { ok: false, error: 'Unknown alias "' + src + '".' };
      src = alias;
    }

    const tokens = src.split(/\s+/);
    if (tokens.length !== 5) {
      return {
        ok: false,
        error:
          "Expected 5 fields (minute hour day month weekday), got " +
          tokens.length +
          ".",
      };
    }

    const out = {};
    for (let i = 0; i < FIELDS.length; i++) {
      const field = FIELDS[i];
      const token = tokens[i];
      const parsed = parseField(token, field);
      if (!parsed.ok)
        return { ok: false, error: field.name + ": " + parsed.error };
      out[field.key] = parsed.values;
    }

    return { ok: true, fields: out, expr: src };
  }

  /* ---------------- Description ---------------- */

  function describe(fields) {
    const parts = [];

    // Time part
    const minute = fields.minute;
    const hour = fields.hour;

    const minuteAll = minute.length === 60;
    const hourAll = hour.length === 24;

    if (minuteAll && hourAll) {
      parts.push("Every minute");
    } else if (minuteAll) {
      parts.push(
        "Every minute during hour" +
          (hour.length === 1 ? " " + hour[0] : "s " + compactList(hour)),
      );
    } else if (minute.length === 1 && hour.length === 1) {
      parts.push("At " + pad(hour[0]) + ":" + pad(minute[0]));
    } else if (minute.length === 1 && hourAll) {
      parts.push("At minute " + minute[0] + " of every hour");
    } else if (hour.length === 1 && minuteAll) {
      parts.push("Every minute during hour " + hour[0]);
    } else {
      parts.push(
        "At minute " + compactList(minute) + " past hour " + compactList(hour),
      );
    }

    // Day of month
    const domAll = fields.day.length === 31;
    if (!domAll) {
      if (fields.day.length === 1) parts.push("on day " + fields.day[0]);
      else parts.push("on days " + compactList(fields.day));
    }

    // Month
    const monthAll = fields.month.length === 12;
    if (!monthAll) {
      if (fields.month.length === 1)
        parts.push("in " + MONTH_NAMES[fields.month[0]]);
      else
        parts.push(
          "in " +
            fields.month.map((m) => MONTH_NAMES[m].slice(0, 3)).join(", "),
        );
    }

    // Weekday
    const dowAll = fields.weekday.length === 7;
    if (!dowAll) {
      if (fields.weekday.length === 1)
        parts.push("on " + DAY_NAMES[fields.weekday[0]]);
      else
        parts.push(
          "on " +
            fields.weekday.map((d) => DAY_NAMES[d].slice(0, 3)).join(", "),
        );
    }

    if (
      parts.length === 1 &&
      domAll &&
      monthAll &&
      dowAll &&
      !minuteAll &&
      !hourAll
    ) {
      // e.g. "At 05:00" — add "every day"
      parts.push("every day");
    }

    return parts.join(" ").replace(/^./, (c) => c.toUpperCase()) + ".";
  }

  function compactList(arr) {
    return arr.join(", ");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /* ---------------- Next runs ---------------- */

  /**
   * Compute the next N matching dates from a start time.
   * Brute-force minute stepping — safe for the small N we use.
   * @param {Object} fields
   * @param {number} count
   * @returns {Date[]}
   */
  function nextRuns(fields, count) {
    const results = [];
    const maxIterations = 60 * 24 * 366 * 4; // 4 years of minutes, hard cap

    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(start.getMinutes() + 1);

    const cur = new Date(start);
    let iterations = 0;

    while (results.length < count && iterations < maxIterations) {
      iterations++;
      if (matches(fields, cur)) results.push(new Date(cur));
      cur.setMinutes(cur.getMinutes() + 1);
    }

    return results;
  }

  function matches(fields, d) {
    if (fields.minute.indexOf(d.getMinutes()) === -1) return false;
    if (fields.hour.indexOf(d.getHours()) === -1) return false;
    if (fields.month.indexOf(d.getMonth() + 1) === -1) return false;

    // Cron: if BOTH day-of-month and day-of-week are restricted, match if EITHER matches.
    // Otherwise require the restricted one to match.
    const domRestricted = fields.day.length !== 31;
    const dowRestricted = fields.weekday.length !== 7;

    const domMatch = fields.day.indexOf(d.getDate()) !== -1;
    const dowMatch = fields.weekday.indexOf(d.getDay()) !== -1;

    if (domRestricted && dowRestricted) return domMatch || dowMatch;
    if (domRestricted) return domMatch;
    if (dowRestricted) return dowMatch;
    return true;
  }

  /* ---------------- Formatting ---------------- */

  function formatDate(d) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return (
      days[d.getDay()] +
      ", " +
      months[d.getMonth()] +
      " " +
      d.getDate() +
      ", " +
      d.getFullYear() +
      "  " +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function humanize(d) {
    const now = Date.now();
    const diff = Math.round((d.getTime() - now) / 1000);
    if (diff < 60) return "in " + diff + "s";
    if (diff < 3600) return "in " + Math.round(diff / 60) + "m";
    if (diff < 86400) return "in " + Math.round(diff / 3600) + "h";
    return "in " + Math.round(diff / 86400) + "d";
  }

  /* ---------------- Rendering ---------------- */

  function render() {
    const dom = DT.ui.dom;
    const raw = refs.input.value.trim();

    dom.clear(refs.resultSlot);

    if (!raw) {
      refs.resultSlot.appendChild(
        dom.el("div", { class: "dt-empty" }, [
          dom.el("div", {
            class: "dt-empty__title",
            text: "Enter a cron expression",
          }),
          dom.el("div", {
            class: "dt-empty__text",
            text: "Try 0 9 * * 1-5  or  */15 * * * *",
          }),
        ]),
      );
      return;
    }

    const parsed = parseCron(raw);

    if (!parsed.ok) {
      refs.resultSlot.appendChild(
        dom.el("div", { class: "dt-alert dt-alert--error" }, [
          dom.el("div", {
            style: { fontWeight: "600" },
            text: "Invalid cron expression",
          }),
          dom.el("div", { text: parsed.error }),
        ]),
      );
      return;
    }

    const fields = parsed.fields;

    /* --- Human-readable description --- */
    const descPanel = dom.el("div", { class: "dt-panel" }, [
      dom.el("div", { class: "dt-panel__head" }, [
        dom.el("div", { class: "dt-panel__title", text: "Meaning" }),
      ]),
      dom.el(
        "div",
        { class: "dt-panel__body", style: { padding: "14px 16px" } },
        [dom.el("div", { class: "dt-cron-desc", text: describe(fields) })],
      ),
    ]);

    refs.resultSlot.appendChild(descPanel);

    /* --- Field breakdown --- */
    const breakdown = dom.el("div", { class: "dt-cron-fields" });
    const tokens = parsed.expr.split(/\s+/);

    FIELDS.forEach((f, i) => {
      breakdown.appendChild(
        dom.el("div", { class: "dt-cron-field" }, [
          dom.el("div", { class: "dt-cron-field__name", text: f.name }),
          dom.el("code", { class: "dt-cron-field__token", text: tokens[i] }),
          dom.el("div", {
            class: "dt-cron-field__values",
            text: summarizeValues(f, fields[f.key]),
          }),
        ]),
      );
    });

    refs.resultSlot.appendChild(
      dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Fields" }),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "8px 12px" } },
          [breakdown],
        ),
      ]),
    );

    /* --- Next runs --- */
    const count = clampCount(parseInt(refs.count.value, 10) || 5);
    const runs = nextRuns(fields, count);

    const runsBody = dom.el("div", {
      class: "dt-cron-runs",
      style: { padding: "4px 0" },
    });

    if (!runs.length) {
      runsBody.appendChild(
        dom.el("div", {
          class: "dt-help",
          style: { padding: "12px 16px" },
          text: "No upcoming runs found within 4 years.",
        }),
      );
    } else {
      runs.forEach((d, i) => {
        runsBody.appendChild(
          dom.el("div", { class: "dt-cron-run" }, [
            dom.el("span", {
              class: "dt-cron-run__index",
              text: String(i + 1),
            }),
            dom.el("span", { class: "dt-cron-run__date", text: formatDate(d) }),
            dom.el("span", { class: "dt-cron-run__rel", text: humanize(d) }),
          ]),
        );
      });
    }

    refs.resultSlot.appendChild(
      dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", {
            class: "dt-panel__title",
            text: "Next " + count + " run" + (count === 1 ? "" : "s"),
          }),
        ]),
        runsBody,
      ]),
    );
  }

  function summarizeValues(field, values) {
    if (field.key === "minute" && values.length === 60) return "every minute";
    if (field.key === "hour" && values.length === 24) return "every hour";
    if (field.key === "day" && values.length === 31) return "every day";
    if (field.key === "month" && values.length === 12) return "every month";
    if (field.key === "weekday" && values.length === 7) return "every day";

    if (values.length <= 10) return values.join(", ");

    // Compact a long list into ranges
    const sorted = values.slice().sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i <= sorted.length; i++) {
      const cur = sorted[i];
      if (cur === prev + 1) {
        prev = cur;
        continue;
      }
      ranges.push(start === prev ? String(start) : start + "–" + prev);
      start = cur;
      prev = cur;
    }

    return ranges.join(", ");
  }

  function clampCount(n) {
    if (isNaN(n)) return 5;
    if (n < 1) return 1;
    if (n > 50) return 50;
    return n;
  }

  /* ---------------- Actions ---------------- */

  function clearAll() {
    refs.input.value = "";
    render();
    refs.input.focus();
  }

  function loadPreset(expr) {
    refs.input.value = expr;
    render();
  }

  function copyExpression() {
    const v = refs.input.value.trim();
    if (!v) {
      DT.ui.toast.info("Nothing to copy");
      return;
    }
    DT.utils.clipboard
      .copy(v)
      .then(() => DT.ui.toast.success("Copied"))
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  /* ---------------- Presets ---------------- */

  const PRESETS = [
    { label: "Every minute", expr: "* * * * *" },
    { label: "Every 5 minutes", expr: "*/5 * * * *" },
    { label: "Every 15 minutes", expr: "*/15 * * * *" },
    { label: "Hourly", expr: "0 * * * *" },
    { label: "Daily at 9am", expr: "0 9 * * *" },
    { label: "Weekdays at 9am", expr: "0 9 * * 1-5" },
    { label: "Weekly (Sun 00)", expr: "0 0 * * 0" },
    { label: "Monthly (1st 00)", expr: "0 0 1 * *" },
    { label: "Yearly (Jan 1)", expr: "0 0 1 1 *" },
  ];

  /* ---------------- Tool registration ---------------- */

  DT.tools.cron = {
    id: "cron",
    name: "Cron Parser",
    category: "Reference",
    icon: "cron",
    description: "Parse cron expressions into human-readable form.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* --- Input row --- */
      const input = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-cron-input",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "e.g. 0 9 * * 1-5",
      });

      const countLabel = dom.el("span", {
        class: "dt-toolbar__label",
        text: "Show next",
      });
      const count = dom.el("input", {
        type: "number",
        class: "dt-input",
        id: "dt-cron-count",
        min: "1",
        max: "50",
        value: "5",
        inputmode: "numeric",
      });
      count.style.width = "60px";

      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          countLabel,
          count,
          btnCopy,
        ]),
        btnClear,
      ]);

      const inputPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Expression" }),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "12px 16px" } },
          [input],
        ),
      ]);

      /* --- Presets row --- */
      const presetsWrap = dom.el("div", { class: "dt-chips" });
      PRESETS.forEach((p) => {
        const chip = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm",
          text: p.label,
        });
        chip.addEventListener("click", () => loadPreset(p.expr));
        presetsWrap.appendChild(chip);
      });

      const presetsPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Common patterns" }),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "12px 16px" } },
          [presetsWrap],
        ),
      ]);

      /* --- Result slot --- */
      const resultSlot = dom.el("div", {
        class: "dt-stack",
        id: "dt-cron-result",
        style: { display: "flex", flexDirection: "column", gap: "16px" },
      });

      /* --- Assemble --- */
      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(presetsPanel);
      workspace.appendChild(resultSlot);
      container.appendChild(workspace);

      refs = { input, count, resultSlot };

      /* --- Events --- */
      const updateDebounced = DT.utils.debounce(render, 150);

      on(input, "input", updateDebounced);
      on(input, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          render();
        }
      });
      on(count, "input", () => {
        if (refs.input.value.trim()) render();
      });
      on(btnCopy, "click", copyExpression);
      on(btnClear, "click", clearAll);

      input.value = "0 9 * * 1-5";
      render();

      DT.utils.persist.bind("cron", input, {
        onRestore: function () {
          render();
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
