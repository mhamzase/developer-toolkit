/**
 * File: js/tools/diff.js
 * Module: Tool — Diff Checker
 * Purpose: Compare two texts line by line with added/removed highlighting.
 * Notes: LCS-based diff algorithm. No network. All processing local.
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

  /* ---------------- Diff algorithm (LCS) ---------------- */

  /**
   * Split text into lines, dropping one trailing empty line if present.
   * @param {string} text
   * @returns {string[]}
   */
  function splitLines(text) {
    const lines = String(text || "").split(/\r?\n/);
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    return lines;
  }

  /**
   * Compute a line-by-line diff using LCS.
   * @param {string[]} a
   * @param {string[]} b
   * @returns {Array<{type:'same'|'add'|'remove', a?:string, b?:string, aIdx?:number, bIdx?:number}>}
   */
  function diffLines(a, b) {
    const n = a.length,
      m = b.length;

    // Guard for very large inputs
    if (n * m > 4_000_000) {
      return [
        {
          type: "error",
          a: null,
          b: null,
          message: "Input too large to diff (over ~4M line pairs).",
        },
      ];
    }

    // Build LCS length table
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Backtrack
    const out = [];
    let i = n,
      j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        out.unshift({
          type: "same",
          a: a[i - 1],
          b: b[j - 1],
          aIdx: i,
          bIdx: j,
        });
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        out.unshift({ type: "add", b: b[j - 1], bIdx: j });
        j--;
      } else {
        out.unshift({ type: "remove", a: a[i - 1], aIdx: i });
        i--;
      }
    }

    return out;
  }

  /* ---------------- Stats ---------------- */

  function computeStats(diff) {
    let added = 0,
      removed = 0,
      same = 0;
    diff.forEach((d) => {
      if (d.type === "add") added++;
      else if (d.type === "remove") removed++;
      else if (d.type === "same") same++;
    });
    return { added, removed, same, total: diff.length };
  }

  /* ---------------- Rendering ---------------- */

  function renderDiff() {
    const dom = DT.ui.dom;
    const slot = refs.diffSlot;
    const statsSlot = refs.statsSlot;

    const aLines = splitLines(refs.left.value);
    const bLines = splitLines(refs.right.value);

    dom.clear(slot);
    dom.clear(statsSlot);

    /* Empty state */
    if (!aLines.length && !bLines.length) {
      slot.appendChild(
        dom.el("div", { class: "dt-empty" }, [
          dom.el("div", {
            class: "dt-empty__title",
            text: "Nothing to compare",
          }),
          dom.el("div", {
            class: "dt-empty__text",
            text: "Paste text on both sides.",
          }),
        ]),
      );
      return;
    }

    /* Compute */
    const diff = diffLines(aLines, bLines);

    if (diff.length && diff[0].type === "error") {
      slot.appendChild(
        dom.el("div", { class: "dt-alert dt-alert--error" }, [
          dom.el("div", { style: { fontWeight: "600" }, text: "Cannot diff" }),
          dom.el("div", { text: diff[0].message }),
        ]),
      );
      return;
    }

    const stats = computeStats(diff);

    /* Panel header with counts */
    refs.leftCount.textContent = aLines.length + " lines";
    refs.rightCount.textContent = bLines.length + " lines";

    /* Stats pills */
    statsSlot.appendChild(
      dom.el("span", { class: "dt-stat" }, [
        dom.txt("Same "),
        dom.el("span", { class: "dt-stat__value", text: String(stats.same) }),
      ]),
    );
    statsSlot.appendChild(
      dom.el("span", { class: "dt-stat dt-stat--add" }, [
        dom.txt("+"),
        dom.el("span", { class: "dt-stat__value", text: String(stats.added) }),
      ]),
    );
    statsSlot.appendChild(
      dom.el("span", { class: "dt-stat dt-stat--remove" }, [
        dom.txt("−"),
        dom.el("span", {
          class: "dt-stat__value",
          text: String(stats.removed),
        }),
      ]),
    );

    /* Rows */
    const body = dom.el("div", { class: "dt-diff-body" });

    if (!stats.added && !stats.removed) {
      body.appendChild(
        dom.el("div", { class: "dt-diff-identical" }, [
          dom.el("span", { class: "dt-badge dt-badge--success", text: "●" }),
          dom.txt(" Identical — no differences"),
        ]),
      );
    }

    // Cap rendering to avoid huge DOM for massive diffs
    const MAX_ROWS = 3000;
    const rows = diff.slice(0, MAX_ROWS);

    rows.forEach((d) => {
      const leftCell = buildCell(d, "left");
      const rightCell = buildCell(d, "right");
      body.appendChild(leftCell);
      body.appendChild(rightCell);
    });

    if (diff.length > MAX_ROWS) {
      const truncL = dom.el("div", {
        class: "dt-diff-cell dt-diff-cell--empty",
        text: "…",
      });
      const truncR = dom.el("div", {
        class: "dt-diff-cell dt-diff-cell--empty",
        text: "… " + (diff.length - MAX_ROWS) + " more rows not shown",
      });
      body.appendChild(truncL);
      body.appendChild(truncR);
    }

    slot.appendChild(body);
  }

  function buildCell(d, side) {
    const dom = DT.ui.dom;
    const cell = dom.el("div", { class: "dt-diff-cell" });

    const num = dom.el("span", { class: "dt-diff-line-num" });
    const content = dom.el("span", { class: "dt-diff-line-content" });

    if (side === "left") {
      if (d.type === "same") {
        num.textContent = String(d.aIdx);
        content.textContent = d.a;
      } else if (d.type === "remove") {
        cell.classList.add("dt-diff-cell--remove");
        num.textContent = String(d.aIdx);
        content.textContent = d.a;
      } else {
        // 'add' → empty on left side
        cell.classList.add("dt-diff-cell--empty");
      }
    } else {
      if (d.type === "same") {
        num.textContent = String(d.bIdx);
        content.textContent = d.b;
      } else if (d.type === "add") {
        cell.classList.add("dt-diff-cell--add");
        num.textContent = String(d.bIdx);
        content.textContent = d.b;
      } else {
        // 'remove' → empty on right side
        cell.classList.add("dt-diff-cell--empty");
      }
    }

    // Preserve whitespace safely (textContent + empty line → zero-width space)
    if (content.textContent === "")
      content.appendChild(document.createTextNode("\u200B"));

    cell.appendChild(num);
    cell.appendChild(content);
    return cell;
  }

  /* ---------------- Actions ---------------- */

  function clearAll() {
    const snap = { left: refs.left.value, right: refs.right.value };
    if (!snap.left && !snap.right) {
      refs.left.focus();
      return;
    }

    refs.left.value = "";
    refs.right.value = "";
    renderDiff();
    refs.left.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.left.value = snap.left;
      refs.right.value = snap.right;
      renderDiff();
    });
  }
  function swap() {
    const tmp = refs.left.value;
    refs.left.value = refs.right.value;
    refs.right.value = tmp;
    renderDiff();
    DT.ui.toast.success("Swapped");
  }

  function copyUnified() {
    const aLines = splitLines(refs.left.value);
    const bLines = splitLines(refs.right.value);
    const diff = diffLines(aLines, bLines);

    const lines = ["--- Original", "+++ Modified"];
    diff.forEach((d) => {
      if (d.type === "same") lines.push(" " + d.a);
      else if (d.type === "remove") lines.push("-" + d.a);
      else if (d.type === "add") lines.push("+" + d.b);
    });

    DT.utils.clipboard
      .copy(lines.join("\n"))
      .then(() => DT.ui.toast.success("Unified diff copied"))
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  function loadSample() {
    refs.left.value =
      "function greet(name) {\n" +
      '  console.log("Hello, " + name);\n' +
      "  return true;\n" +
      "}\n" +
      "\n" +
      'greet("World");';

    refs.right.value =
      "function greet(name) {\n" +
      "  if (!name) return false;\n" +
      "  console.log(`Hello, ${name}!`);\n" +
      "  return true;\n" +
      "}\n" +
      "\n" +
      'greet("World");\n' +
      'greet("Developer");';

    renderDiff();
    DT.ui.toast.success("Sample loaded");
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.diff = {
    id: "diff",
    name: "Diff Checker",
    category: "Text",
    icon: "diff",
    description: "Compare two texts line by line.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* --- Toolbar --- */
      const btnSwap = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "⇄ Swap",
      });
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy as diff",
      });
      const btnSample = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Sample",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          btnSwap,
          btnCopy,
          btnSample,
        ]),
        btnClear,
      ]);

      /* --- Inputs (two side-by-side panels) --- */
      const left = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-diff-left",
        rows: "8",
        spellcheck: "false",
        placeholder: "Original text…",
      });
      left.style.whiteSpace = "pre";
      left.style.fontFamily = "var(--font-mono)";
      left.style.fontSize = "var(--fs-xs)";

      const right = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-diff-right",
        rows: "8",
        spellcheck: "false",
        placeholder: "Modified text…",
      });
      right.style.whiteSpace = "pre";
      right.style.fontFamily = "var(--font-mono)";
      right.style.fontSize = "var(--fs-xs)";

      const leftCount = dom.el("div", { class: "dt-help", text: "0 lines" });
      const rightCount = dom.el("div", { class: "dt-help", text: "0 lines" });

      const leftPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Original" }),
          leftCount,
        ]),
        dom.el("div", { class: "dt-panel__body" }, [left]),
      ]);

      const rightPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Modified" }),
          rightCount,
        ]),
        dom.el("div", { class: "dt-panel__body" }, [right]),
      ]);

      const inputs = dom.el("div", { class: "dt-diff-inputs" }, [
        leftPanel,
        rightPanel,
      ]);

      /* --- Diff view panel --- */
      const diffSlot = dom.el("div", {
        id: "dt-diff-view",
        class: "dt-diff-view",
      });
      const statsSlot = dom.el("div", { class: "dt-stats" });

      const diffPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Diff" }),
        ]),
        diffSlot,
        dom.el("div", { class: "dt-panel__foot" }, [statsSlot]),
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(inputs);
      workspace.appendChild(diffPanel);
      container.appendChild(workspace);

      refs = { left, right, leftCount, rightCount, diffSlot, statsSlot };

      /* --- Events --- */
      const updateDebounced = DT.utils.debounce(renderDiff, 250);

      on(left, "input", updateDebounced);
      on(right, "input", updateDebounced);

      on(left, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          renderDiff();
        }
      });
      on(right, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          renderDiff();
        }
      });

      on(btnSwap, "click", swap);
      on(btnCopy, "click", copyUnified);
      on(btnSample, "click", loadSample);
      on(btnClear, "click", clearAll);

      DT.utils.persist.bind("diff", left, {
        slot: "left",
        onRestore: function () {
          renderDiff();
        },
      });
      DT.utils.persist.bind("diff", right, {
        slot: "right",
        onRestore: function () {
          renderDiff();
        },
      });

      left.focus();
      renderDiff();
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
