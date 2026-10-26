/**
 * File: js/tools/regex.js
 * Module: Tool — Regex Tester
 * Purpose: Test regular expressions with live matching, flags, groups, positions.
 * Notes: Uses native RegExp. No network. No eval.
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

  /* ---------------- Flags ---------------- */

  const FLAGS = [
    { id: "g", label: "g", title: "Global — find all matches" },
    { id: "i", label: "i", title: "Ignore case" },
    { id: "m", label: "m", title: "Multiline — ^ and $ match line breaks" },
    { id: "s", label: "s", title: "Dotall — . matches newlines" },
    { id: "u", label: "u", title: "Unicode" },
    { id: "y", label: "y", title: "Sticky — match from lastIndex" },
  ];

  function flagsString() {
    return FLAGS.filter((f) => refs.flags[f.id].checked)
      .map((f) => f.id)
      .join("");
  }

  /* ---------------- Matching ---------------- */

  function runMatch() {
    const pattern = refs.pattern.value;
    if (!pattern) return { ok: true, matches: [], duration: 0 };

    const flags = flagsString();
    const start = performance.now();

    let re;
    try {
      re = new RegExp(pattern, flags);
    } catch (e) {
      return { ok: false, error: e.message || "Invalid regex." };
    }

    const text = refs.text.value;
    const matches = [];
    const MAX = 5000;

    if (re.global || re.sticky) {
      let m;
      let guard = 0;
      while ((m = re.exec(text)) !== null && matches.length < MAX) {
        matches.push(snapshot(m));
        if (m[0] === "") re.lastIndex++;
        guard++;
        if (guard > MAX * 2) break;
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push(snapshot(m));
    }

    const duration = performance.now() - start;
    return { ok: true, matches, duration };
  }

  function snapshot(m) {
    const groups = [];
    for (let i = 1; i < m.length; i++) {
      groups.push({ index: i, value: m[i] });
    }

    const named = [];
    if (m.groups) {
      Object.keys(m.groups).forEach(function (k) {
        named.push({ name: k, value: m.groups[k] });
      });
    }

    return {
      value: m[0],
      index: m.index,
      length: m[0].length,
      groups: groups,
      named: named,
    };
  }

  /* ---------------- Rendering ---------------- */

  function paintStats(result) {
    const el = refs.matchStats;
    DT.ui.dom.clear(el);

    if (!result.ok) {
      el.appendChild(
        DT.ui.dom.el("span", { class: "dt-stat dt-stat--danger" }, [
          DT.ui.dom.txt("Error"),
        ]),
      );
      return;
    }

    const n = result.matches.length;
    const dur = (
      typeof result.duration === "number" ? result.duration : 0
    ).toFixed(2);

    el.appendChild(
      DT.ui.dom.el("span", { class: "dt-stat" }, [
        DT.ui.dom.txt("Matches "),
        DT.ui.dom.el("span", { class: "dt-stat__value", text: String(n) }),
      ]),
    );
    el.appendChild(
      DT.ui.dom.el("span", { class: "dt-stat" }, [
        DT.ui.dom.txt("Time "),
        DT.ui.dom.el("span", { class: "dt-stat__value", text: dur + " ms" }),
      ]),
    );
  }

  function renderMatches(result) {
    const dom = DT.ui.dom;
    const slot = refs.matchesSlot;
    dom.clear(slot);

    if (!result.ok) {
      slot.appendChild(
        dom.el("div", { class: "dt-alert dt-alert--error" }, [
          dom.el("div", {
            style: { fontWeight: "600" },
            text: "Invalid regex",
          }),
          dom.el("div", { text: result.error }),
        ]),
      );
      return;
    }

    if (!result.matches.length) {
      slot.appendChild(
        dom.el("div", { class: "dt-empty" }, [
          dom.el("div", { class: "dt-empty__title", text: "No matches" }),
          dom.el("div", {
            class: "dt-empty__text",
            text: "Try a different pattern or flags.",
          }),
        ]),
      );
      return;
    }

    const list = dom.el("div", { class: "dt-regex-matches" });
    result.matches.forEach(function (m, i) {
      const head = dom.el("div", { class: "dt-regex-match__head" }, [
        dom.el("span", {
          class: "dt-badge dt-badge--accent",
          text: "#" + (i + 1),
        }),
        dom.el("span", {
          class: "dt-help",
          text: "index " + m.index + " · length " + m.length,
        }),
      ]);

      const value = dom.el("code", {
        class: "dt-regex-match__value",
        text: m.value || "(empty)",
      });
      const body = dom.el("div", { class: "dt-regex-match__body" }, [
        head,
        value,
      ]);

      if (m.groups.length) {
        const groupWrap = dom.el("div", { class: "dt-regex-groups" });
        m.groups.forEach(function (g) {
          groupWrap.appendChild(
            dom.el("div", { class: "dt-regex-group" }, [
              dom.el("span", {
                class: "dt-regex-group__label",
                text: "$" + g.index,
              }),
              dom.el("code", {
                class: "dt-regex-group__value",
                text: g.value == null ? "(undefined)" : g.value || "(empty)",
              }),
            ]),
          );
        });
        body.appendChild(groupWrap);
      }

      if (m.named.length) {
        const namedWrap = dom.el("div", { class: "dt-regex-groups" });
        m.named.forEach(function (g) {
          namedWrap.appendChild(
            dom.el("div", { class: "dt-regex-group" }, [
              dom.el("span", {
                class: "dt-regex-group__label dt-regex-group__label--named",
                text: g.name,
              }),
              dom.el("code", {
                class: "dt-regex-group__value",
                text: g.value == null ? "(undefined)" : g.value || "(empty)",
              }),
            ]),
          );
        });
        body.appendChild(namedWrap);
      }

      list.appendChild(dom.el("div", { class: "dt-regex-match" }, [body]));
    });

    slot.appendChild(list);
  }

  function renderHighlight(result) {
    const dom = DT.ui.dom;
    const slot = refs.highlightSlot;
    dom.clear(slot);

    if (!result.ok) return;

    const text = refs.text.value;
    if (!text) {
      slot.appendChild(
        dom.el("div", { class: "dt-help", text: "No test string." }),
      );
      return;
    }

    if (!result.matches.length) {
      const pre = dom.el("pre", { class: "dt-regex-highlight" });
      pre.appendChild(document.createTextNode(text));
      slot.appendChild(pre);
      return;
    }

    const pre = dom.el("pre", { class: "dt-regex-highlight" });
    let cursor = 0;

    result.matches.forEach(function (m, i) {
      if (m.index > cursor) {
        pre.appendChild(document.createTextNode(text.slice(cursor, m.index)));
      }
      const span = dom.el("mark", {
        class: "dt-regex-hit" + (i % 2 ? " dt-regex-hit--alt" : ""),
        title: "Match #" + (i + 1),
      });
      span.appendChild(document.createTextNode(m.value || "\u200B"));
      pre.appendChild(span);
      cursor = m.index + m.length;
    });

    if (cursor < text.length) {
      pre.appendChild(document.createTextNode(text.slice(cursor)));
    }

    slot.appendChild(pre);
  }

/* ---------------- Phase 2B: common patterns library ---------------- */
  const PATTERN_LIBRARY = [
    { name: "Email", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+", flags: "g" },
    { name: "URL", pattern: "https?:\\/\\/[\\w.-]+(?:\\.[a-z]{2,})(?:[\\w\\/?#=&%.-]*)", flags: "gi" },
    { name: "IPv4", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", flags: "g" },
    { name: "ISO date", pattern: "\\b\\d{4}-\\d{2}-\\d{2}\\b", flags: "g" },
    { name: "Time (24h)", pattern: "\\b(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?\\b", flags: "g" },
    { name: "Hex color", pattern: "#(?:[0-9a-f]{3}){1,2}\\b", flags: "gi" },
    { name: "Slug", pattern: "\\b[a-z0-9]+(?:-[a-z0-9]+)+\\b", flags: "g" },
    { name: "UUID", pattern: "\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b", flags: "gi" },
    { name: "Phone (intl)", pattern: "\\+\\d[\\d\\s-]{7,}\\d", flags: "g" },
    { name: "HTML tag", pattern: "<\\/?[a-z][\\w-]*(\\s[^>]*)?>", flags: "gi" },
    { name: "Words", pattern: "\\b\\w+\\b", flags: "g" },
    { name: "Numbers", pattern: "-?\\d+(?:\\.\\d+)?", flags: "g" },
  ];

  function loadPattern(preset) {
    refs.pattern.value = preset.pattern;
    FLAGS.forEach(function (f) {
      refs.flags[f.id].checked = preset.flags.indexOf(f.id) !== -1;
    });
    update();
    refs.pattern.focus();
  }

  /* ---------------- Phase 2B: replace preview ---------------- */
  function renderReplace(result) {
    if (!refs || !refs.replaceOut) return;
    const statsEl = refs.replaceStats;
    if (!result || !result.ok) {
      refs.replaceOut.value = "";
      statsEl.textContent = result ? "Fix the pattern to preview the replacement" : "";
      return;
    }
    if (!refs.pattern.value) {
      refs.replaceOut.value = "";
      statsEl.textContent = "0 replacements";
      return;
    }
    let re;
    try {
      re = new RegExp(refs.pattern.value, flagsString());
    } catch (e) {
      refs.replaceOut.value = "";
      statsEl.textContent = "Invalid pattern";
      return;
    }
    const replacement = refs.replaceInput.value;
    const out = refs.text.value.replace(re, replacement);
    refs.replaceOut.value = out;
    const n = re.global ? result.matches.length : (result.matches.length ? 1 : 0);
    statsEl.textContent =
      n + " replacement" + (n === 1 ? "" : "s") + " · $1, $2 … refer to groups, $$ is a literal $";
  }

  function update() {
    const result = runMatch();
    paintStats(result);
    renderMatches(result);
    renderHighlight(result);
    renderReplace(result);
  }

  /* ---------------- Actions ---------------- */

  function clearAll() {
    const snap = { pattern: refs.pattern.value, text: refs.text.value };
    if (!snap.pattern && !snap.text) {
      refs.pattern.focus();
      return;
    }

    refs.pattern.value = "";
    refs.text.value = "";
    update();
    refs.pattern.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.pattern.value = snap.pattern;
      refs.text.value = snap.text;
      update();
    });
  }

  function copyMatches() {
    const result = runMatch();
    if (!result.ok || !result.matches.length) {
      DT.ui.toast.info("No matches to copy");
      return;
    }

    const out = result.matches
      .map(function (m, i) {
        let line = "#" + (i + 1) + "  index " + m.index + '  "' + m.value + '"';
        if (m.groups.length) {
          line +=
            "\n    groups: " +
            m.groups
              .map(function (g) {
                return "$" + g.index + '="' + (g.value || "") + '"';
              })
              .join(", ");
        }
        return line;
      })
      .join("\n");

    DT.utils.clipboard
      .copy(out)
      .then(function () {
        DT.ui.toast.success("Matches copied");
      })
      .catch(function () {
        DT.ui.toast.error("Copy failed");
      });
  }

  function loadSample() {
    refs.pattern.value = "(\\w+)@(\\w+)\\.com";
    refs.flags.g.checked = true;
    refs.flags.i.checked = true;
    refs.text.value =
      "Contact alice@example.com or bob@test.com for support.\nInvalid: not-an-email, charlie@.";
    update();
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.regex = {
    id: "regex",
    name: "Regex Tester",
    category: "Regex",
    icon: "regex",
    description: "Test patterns with flags, groups, highlighting and replace.",

    keywords: "regexp pattern match test regular expression flags groups replace library email url phone date",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* Pattern row */
      const pattern = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-regex-pattern",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "e.g. (\\w+)@(\\w+)\\.com",
      });

      /* Flags */
      const flagsWrap = dom.el("div", { class: "dt-regex-flags" });
      const flags = {};
      FLAGS.forEach(function (f) {
        const cb = dom.el("input", {
          type: "checkbox",
          id: "dt-regex-flag-" + f.id,
        });
        const lbl = dom.el(
          "label",
          {
            class: "dt-regex-flag",
            for: "dt-regex-flag-" + f.id,
            title: f.title,
          },
          [cb, dom.txt(f.label)],
        );
        flags[f.id] = cb;
        flagsWrap.appendChild(lbl);
      });
      flags.g.checked = true;

      const patternPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Pattern" }),
          dom.el("div", { class: "dt-panel__actions" }, [flagsWrap]),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "12px 16px" } },
          [pattern],
        ),
      ]);

      /* Toolbar */
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy matches",
      });
      const btnSample = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Load sample",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const btnDownload = DT.ui.dlButton({
        getText: function () {
          if (!refs || !refs.pattern) return "";
          const result = runMatch();
          if (!result.ok || !result.matches.length) return "";
          return JSON.stringify(
            {
              pattern: refs.pattern.value,
              flags: flagsString(),
              count: result.matches.length,
              matches: result.matches,
            },
            null,
            2,
          );
        },
        filename: function () {
          return DT.utils.download.withTimestamp("regex-matches", "json");
        },
        mime: "application/json;charset=utf-8",
        label: "Download",
        emptyMsg: "No matches to download",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          btnCopy,
          btnDownload,
          btnSample,
        ]),
        btnClear,
      ]);

      /* Test string */
      const text = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-regex-text",
        rows: "6",
        spellcheck: "false",
        placeholder: "Paste test string here…",
      });
      text.style.whiteSpace = "pre-wrap";

      const textPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Test string", [DT.ui.panel.pasteBtn(text)]),
        dom.el("div", { class: "dt-panel__body" }, [text]),
      ]);

      /* Highlight */
      const highlightSlot = dom.el("div", {
        id: "dt-regex-highlight",
        style: { padding: "12px 16px" },
      });
      const highlightPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Highlighted" }),
        ]),
        highlightSlot,
      ]);

      /* Matches */
      const matchesSlot = dom.el("div", {
        id: "dt-regex-matches",
        style: { padding: "8px 12px" },
      });
      const matchStats = dom.el("div", { class: "dt-panel__stats" });
      const matchesPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Matches" }),
        ]),
        matchesSlot,
        dom.el("div", { class: "dt-panel__foot" }, [matchStats]),
      ]);

      /* --- Common patterns library --- */
      const libWrap = dom.el("div", { class: "dt-chips" });
      PATTERN_LIBRARY.forEach(function (preset) {
        const chip = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm",
          text: preset.name,
          title: "/" + preset.pattern + "/" + preset.flags,
        });
        chip.addEventListener("click", function () { loadPattern(preset); });
        libWrap.appendChild(chip);
      });
      const libPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Common patterns" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [libWrap]),
      ]);

      /* --- Replace panel --- */
      const replaceInput = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-regex-replace",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "Replacement text ($1 = group 1)…",
      });
      const replaceOut = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-regex-replace-out",
        rows: "4",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "The replaced text appears here…",
      });
      replaceOut.style.whiteSpace = "pre-wrap";
      const replaceStats = dom.el("div", { class: "dt-panel__stats", text: "0 replacements" });
      const btnReplaceCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy result",
      });
      const replacePanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Replace", [btnReplaceCopy]),
        dom.el("div", {
          class: "dt-panel__body",
          style: { padding: "12px 16px 0" },
        }, [replaceInput]),
        dom.el("div", { class: "dt-panel__body" }, [replaceOut]),
        dom.el("div", { class: "dt-panel__foot" }, [replaceStats]),
      ]);

      workspace.appendChild(patternPanel);
      workspace.appendChild(libPanel);
      workspace.appendChild(toolbar);
      workspace.appendChild(textPanel);
      workspace.appendChild(highlightPanel);
      workspace.appendChild(matchesPanel);
      workspace.appendChild(replacePanel);
      container.appendChild(workspace);

      refs = {
        pattern: pattern,
        text: text,
        flags: flags,
        highlightSlot: highlightSlot,
        matchesSlot: matchesSlot,
        matchStats: matchStats,
        replaceInput: replaceInput,
        replaceOut: replaceOut,
        replaceStats: replaceStats,
      };

      /* Events */
      const updateDebounced = DT.utils.debounce(update, 120);
      on(pattern, "input", updateDebounced);
      on(text, "input", updateDebounced);
      FLAGS.forEach(function (f) {
        on(flags[f.id], "change", update);
      });

      on(replaceInput, "input", updateDebounced);
      on(btnReplaceCopy, "click", function () {
        if (!replaceOut.value) {
          DT.ui.toast.info("Nothing to copy");
          return;
        }
        DT.utils.clipboard
          .copy(replaceOut.value)
          .then(function () { DT.ui.toast.success("Replaced text copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });
      on(btnCopy, "click", copyMatches);
      on(btnSample, "click", loadSample);
      on(btnClear, "click", clearAll);

      DT.utils.persist.bind("regex", pattern, {
        slot: "pattern",
        onRestore: function () {
          update();
        },
      });
      DT.utils.persist.bind("regex", text, {
        slot: "text",
        onRestore: function () {
          update();
        },
      });

      pattern.focus();
      update();
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
