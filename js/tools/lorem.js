/**
 * File: js/tools/lorem.js
 * Module: Tool — Lorem Ipsum Generator
 * Purpose: Generate placeholder text (paragraphs, sentences, or words).
 * Notes: Classic Latin word bank + custom source option. No network.
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

  /* ---------------- Word bank ---------------- */

  const WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor " +
    "incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud " +
    "exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute " +
    "irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur " +
    "excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt " +
    "mollit anim id est laborum vestibulum curabitur gravida nisl suscipit libero " +
    "volutpat sed cras ornare arcu dui vivamus hendrerit lacus viverra accumsan " +
    "tortor posuere ac ut consequat semper viverra nam libero justo laoreet"
  ).split(" ");

  const START_SENTENCE =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";

  /* ---------------- Random helpers ---------------- */

  function randomInt(max) {
    if (max <= 0) return 0;
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
  }

  function pick(arr) {
    return arr[randomInt(arr.length)];
  }

  function capitalize(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function pool() {
    if (refs.source.value === "custom" && refs.customText.value.trim()) {
      const words = refs.customText.value.trim().split(/\s+/).filter(Boolean);
      if (words.length) return words;
    }
    return WORDS;
  }

  /* ---------------- Generation ---------------- */

  /**
   * Build a sentence.
   * @param {number} wordCount
   * @param {boolean} first — first sentence of the piece?
   * @returns {string}
   */
  function buildSentence(wordCount, first) {
    if (first && refs.startClassic.checked) return START_SENTENCE;

    const words = pool();
    const n = Math.max(3, wordCount);
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(pick(words));

    let sentence = parts.join(" ");
    sentence = capitalize(sentence);

    // 30% chance of a comma before last third
    if (n >= 8 && randomInt(10) < 3) {
      const commaAt = Math.max(2, Math.floor(n * 0.6));
      const arr = sentence.split(" ");
      arr[commaAt] = arr[commaAt] + ",";
      sentence = arr.join(" ");
    }

    return sentence + ".";
  }

  /**
   * Build a paragraph.
   * @returns {string}
   */
  function buildParagraph() {
    const count = 4 + randomInt(4); // 4–7 sentences
    const sentences = [];
    for (let i = 0; i < count; i++) {
      const wc = 6 + randomInt(14); // 6–19 words
      sentences.push(buildSentence(wc, false));
    }
    return sentences.join(" ");
  }

  /**
   * Generate the placeholder text.
   * @returns {string}
   */
  function generate() {
    const mode = refs.mode.value;
    const count = clampCount(parseInt(refs.count.value, 10) || 1);
    const wrapHtml = refs.wrapHtml.checked;
    const useClassicStart = refs.startClassic.checked;

    let out = "";

    if (mode === "paragraphs") {
      const paragraphs = [];
      for (let i = 0; i < count; i++) {
        let p = buildParagraph();
        if (i === 0 && useClassicStart) {
          // Prepend the classic opener
          p = START_SENTENCE + " " + p;
        }
        paragraphs.push(p);
      }
      out = wrapHtml
        ? paragraphs.map((p) => "<p>" + p + "</p>").join("\n\n")
        : paragraphs.join("\n\n");
    } else if (mode === "sentences") {
      const sentences = [];
      for (let i = 0; i < count; i++) {
        const wc = 6 + randomInt(14);
        sentences.push(buildSentence(wc, i === 0 && useClassicStart));
      }
      out = sentences.join(" ");
      if (wrapHtml) out = "<p>" + out + "</p>";
    } else {
      // words
      const words = pool();
      const picked = [];
      for (let i = 0; i < count; i++) picked.push(pick(words));
      out = picked.join(" ");

      if (useClassicStart && count >= 5) {
        out = "Lorem ipsum dolor sit amet " + picked.slice(5).join(" ");
      }
      if (wrapHtml) out = "<p>" + out + "</p>";
    }

    return out;
  }

  function clampCount(n) {
    if (isNaN(n)) return 1;
    if (n < 1) return 1;
    const mode = refs ? refs.mode.value : "paragraphs";
    if (mode === "words") return Math.min(n, 1000);
    if (mode === "sentences") return Math.min(n, 100);
    return Math.min(n, 50);
  }

  /* ---------------- Rendering ---------------- */

  function paintStats(text) {
    const dom = DT.ui.dom;
    const el = refs.statsSlot;
    dom.clear(el);

    if (!text) return;

    const chars = text.length;
    const words = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    const paragraphs = text.split(/\n{2,}/).filter(Boolean).length;
    const bytes = new TextEncoder().encode(text).length;

    [
      ["Chars", chars],
      ["Words", words],
      ["Paragraphs", paragraphs],
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

  function renderOutput(text) {
    refs.output.value = text;
    paintStats(text);
  }

  /* ---------------- Actions ---------------- */

  function generateNow() {
    try {
      const out = generate();
      renderOutput(out);
      DT.ui.toast.success("Generated");
    } catch (e) {
      DT.ui.toast.error("Generation failed");
      console.error("[DT lorem]", e);
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
    const snap = refs.output.value;
    if (!snap) {
      refs.count.focus();
      return;
    }

    refs.output.value = "";
    paintStats("");
    refs.count.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.output.value = snap;
      paintStats(snap);
    });
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.lorem = {
    id: "lorem",
    name: "Lorem Ipsum",
    category: "Text",
    icon: "lorem",
    description: "Generate placeholder text in Latin or custom words.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      /* --- Mode select --- */
      const mode = dom.el(
        "select",
        {
          class: "dt-select dt-select--sm",
          id: "dt-lorem-mode",
        },
        [
          dom.el("option", { value: "paragraphs", text: "Paragraphs" }),
          dom.el("option", { value: "sentences", text: "Sentences" }),
          dom.el("option", { value: "words", text: "Words" }),
        ],
      );
      mode.style.width = "130px";

      /* --- Count --- */
      const count = dom.el("input", {
        type: "number",
        class: "dt-input",
        id: "dt-lorem-count",
        min: "1",
        value: "3",
        inputmode: "numeric",
      });
      count.style.width = "70px";

      /* --- Source select --- */
      const source = dom.el(
        "select",
        {
          class: "dt-select dt-select--sm",
          id: "dt-lorem-source",
        },
        [
          dom.el("option", { value: "classic", text: "Classic Latin" }),
          dom.el("option", { value: "custom", text: "Custom text" }),
        ],
      );
      source.style.width = "130px";

      /* --- Start classic --- */
      const startClassic = dom.el("input", {
        type: "checkbox",
        id: "dt-lorem-start",
      });
      startClassic.checked = true;
      const startLabel = dom.el(
        "label",
        {
          class: "dt-toolbar__label",
          for: "dt-lorem-start",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            textTransform: "none",
            letterSpacing: "0",
          },
        },
        [startClassic, dom.txt('Start with "Lorem ipsum"')],
      );

      /* --- Wrap HTML --- */
      const wrapHtml = dom.el("input", {
        type: "checkbox",
        id: "dt-lorem-html",
      });
      const wrapLabel = dom.el(
        "label",
        {
          class: "dt-toolbar__label",
          for: "dt-lorem-html",
          style: {
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            textTransform: "none",
            letterSpacing: "0",
          },
        },
        [wrapHtml, dom.txt("Wrap in <p>")],
      );

      /* --- Toolbar --- */
      const btnGen = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Generate",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Mode" }),
          mode,
          dom.el("span", { class: "dt-toolbar__label", text: "Count" }),
          count,
          btnGen,
        ]),
        btnClear,
      ]);

      /* --- Options row --- */
      const optionsRow = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Source" }),
          source,
          startLabel,
          wrapLabel,
        ]),
      ]);

      /* --- Custom text panel (shown only when source === 'custom') --- */
      const customText = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-lorem-custom",
        rows: "3",
        spellcheck: "false",
        placeholder:
          "Paste your own words here — separated by spaces or newlines…",
      });
      customText.style.whiteSpace = "pre-wrap";
      customText.style.fontFamily = "var(--font-sans)";
      customText.style.fontSize = "var(--fs-sm)";

      const customPanel = dom.el(
        "div",
        { class: "dt-panel dt-panel--editor dt-lorem-custom-panel" },
        [
          dom.el("div", { class: "dt-panel__head" }, [
            dom.el("div", {
              class: "dt-panel__title",
              text: "Custom word source",
            }),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [customText]),
        ],
      );
      customPanel.style.display = "none";

      /* --- Output panel --- */
      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-lorem-output",
        rows: "12",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Generated text will appear here…",
      });
      output.style.whiteSpace = "pre-wrap";
      output.style.fontFamily = "var(--font-sans)";
      output.style.fontSize = "var(--fs-sm)";
      output.style.lineHeight = "var(--lh-relaxed)";

      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () =>
          DT.utils.download.withTimestamp(
            "lorem",
            refs && refs.wrapHtml && refs.wrapHtml.checked ? "html" : "txt",
          ),
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
        ],
      );

      const statsSlot = dom.el("div", { class: "dt-stats" });
      const statsFoot = dom.el("div", { class: "dt-panel__foot" }, [statsSlot]);

      /* --- Assemble --- */
      workspace.appendChild(toolbar);
      workspace.appendChild(optionsRow);
      workspace.appendChild(customPanel);
      workspace.appendChild(outputPanel);
      workspace.appendChild(statsFoot);
      container.appendChild(workspace);

      refs = {
        mode,
        count,
        source,
        startClassic,
        wrapHtml,
        customText,
        output,
        statsSlot,
      };

      /* --- Events --- */
      on(btnGen, "click", generateNow);
      on(btnClear, "click", clearAll);
      on(btnCopy, "click", copyOutput);

      on(count, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          generateNow();
        }
      });

      on(mode, "change", () => {
        // Reset count default per mode
        if (mode.value === "words") count.value = "50";
        else if (mode.value === "sentences") count.value = "5";
        else count.value = "3";
        generateNow();
      });

      on(source, "change", () => {
        customPanel.style.display = source.value === "custom" ? "" : "none";
        if (source.value === "custom") customText.focus();
        else generateNow();
      });

      on(
        customText,
        "input",
        DT.utils.debounce(() => {
          if (source.value === "custom") generateNow();
        }, 300),
      );

      on(startClassic, "change", generateNow);
      on(wrapHtml, "change", generateNow);

      /* --- Initial --- */
      generateNow();
      count.focus();
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
