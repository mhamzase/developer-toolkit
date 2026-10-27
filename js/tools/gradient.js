/**
 * File: js/tools/gradient.js
 * Module: Tool — CSS Gradient Generator
 * Purpose: Build linear and radial CSS gradients visually:
 *          an editable list of color stops, a live preview and
 *          copy ready CSS.
 * Notes: Stop positions are kept sorted for the generated code
 *        (the editor rows stay in the user's order). Random
 *        gradients use harmonious HSL steps. All local.
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

  const PRESETS = [
    { name: "Ocean", stops: [{ color: "#2563eb", pos: 0 }, { color: "#06b6d4", pos: 100 }] },
    { name: "Sunset", stops: [{ color: "#f59e0b", pos: 0 }, { color: "#ef4444", pos: 60 }, { color: "#8b5cf6", pos: 100 }] },
    { name: "Forest", stops: [{ color: "#14532d", pos: 0 }, { color: "#22c55e", pos: 100 }] },
    { name: "Candy", stops: [{ color: "#ec4899", pos: 0 }, { color: "#8b5cf6", pos: 100 }] },
    { name: "Slate", stops: [{ color: "#0f172a", pos: 0 }, { color: "#475569", pos: 100 }] },
    { name: "Peach", stops: [{ color: "#fff7ed", pos: 0 }, { color: "#fdba74", pos: 100 }] },
  ];

  function buildCss(state) {
    const stops = state.stops.slice().sort(function (a, b) { return a.pos - b.pos; });
    const parts = stops.map(function (s) { return s.color + " " + s.pos + "%"; }).join(", ");
    if (state.type === "radial") return "radial-gradient(circle, " + parts + ")";
    return "linear-gradient(" + state.angle + "deg, " + parts + ")";
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = function (n) { return (n + h / 30) % 12; };
    const a = s * Math.min(l, 1 - l);
    const f = function (n) {
      return l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    };
    const to = function (x) { return Math.round(x * 255).toString(16).padStart(2, "0"); };
    return "#" + to(f(0)) + to(f(8)) + to(f(4));
  }

  DT.tools.gradient = {
    id: "gradient",
    name: "CSS Gradient Generator",
    category: "Color",
    icon: "contrast",
    description: "Design linear and radial gradients and copy the CSS.",
    keywords: "gradient css generator linear radial color stops background design",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const state = {
        type: "linear",
        angle: 90,
        stops: [
          { color: "#2563eb", pos: 0 },
          { color: "#f59e0b", pos: 100 },
        ],
      };

      /* Preview + controls */
      const preview = dom.el("div", { class: "dt-grad-preview", id: "dt-grad-preview" });
      const typeSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-grad-type" }, [
        dom.el("option", { value: "linear", text: "Linear" }),
        dom.el("option", { value: "radial", text: "Radial" }),
      ]);
      const angleRange = dom.el("input", { type: "range", class: "dt-grad-angle", id: "dt-grad-angle", min: "0", max: "360", value: "90" });
      const angleNum = dom.el("input", { type: "number", class: "dt-input dt-grad-angle-num", id: "dt-grad-angle-num", min: "0", max: "360", value: "90" });
      const btnRandom = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Random" });
      const btnAdd = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Add stop" });
      const angleGroup = dom.el("div", { class: "dt-toolbar__group", id: "dt-grad-angle-group" }, [
        dom.el("span", { class: "dt-toolbar__label", text: "Angle" }),
        angleRange,
        angleNum,
        dom.el("span", { class: "dt-help", text: "deg" }),
      ]);
      const controls = dom.el("div", { class: "dt-toolbar dt-grad-controls" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Type" }),
          typeSel,
        ]),
        angleGroup,
        btnRandom,
        btnAdd,
      ]);
      const previewPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Preview"),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [preview, controls]),
      ]);

      /* Stops editor */
      const stopsWrap = dom.el("div", { class: "dt-grad-stops", id: "dt-grad-stops" });
      const stopsPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Color stops"),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [stopsWrap]),
      ]);

      /* Presets */
      const presetRow = dom.el("div", { class: "dt-grad-presets", id: "dt-grad-presets" });
      PRESETS.forEach(function (p) {
        const chip = dom.el("button", {
          type: "button",
          class: "dt-grad-chip",
          title: p.name,
          "aria-label": "Preset " + p.name,
        });
        chip.style.background = "linear-gradient(90deg, " +
          p.stops.map(function (s) { return s.color + " " + s.pos + "%"; }).join(", ") + ")";
        on(chip, "click", function () {
          state.stops = p.stops.map(function (s) { return { color: s.color, pos: s.pos }; });
          renderStops();
          update();
        });
        presetRow.appendChild(chip);
      });
      const presetPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Presets"),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [presetRow]),
      ]);

      /* Output */
      const output = dom.el("textarea", {
        class: "dt-textarea dt-textarea--code",
        id: "dt-grad-output",
        rows: "3",
        readonly: "readonly",
        spellcheck: "false",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy CSS" });
      const btnDownload = DT.ui.dlButton({
        getText: () => output.value,
        filename: () => "gradient.css",
        mime: "text/css;charset=utf-8",
        label: "Download",
      });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("CSS", [btnCopy, btnDownload]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
      ]);

      workspace.appendChild(previewPanel);
      workspace.appendChild(stopsPanel);
      workspace.appendChild(presetPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = { output: output };

      function renderStops() {
        DT.ui.dom.clear(stopsWrap);
        state.stops.forEach(function (stop, i) {
          const colorIn = dom.el("input", { type: "color", class: "dt-grad-stop__color", value: stop.color });
          const hexLabel = dom.el("span", { class: "dt-grad-stop__hex", text: stop.color });
          const posRange = dom.el("input", { type: "range", class: "dt-grad-stop__pos", min: "0", max: "100", value: String(stop.pos) });
          const posNum = dom.el("input", { type: "number", class: "dt-input dt-grad-stop__num", min: "0", max: "100", value: String(stop.pos) });
          const btnRemove = dom.el("button", {
            type: "button",
            class: "dt-btn dt-btn--ghost dt-btn--sm",
            text: "Remove",
          });
          btnRemove.disabled = state.stops.length <= 2;

          on(colorIn, "input", function () {
            stop.color = colorIn.value;
            hexLabel.textContent = stop.color;
            update();
          });
          on(posRange, "input", function () {
            stop.pos = Number(posRange.value);
            posNum.value = String(stop.pos);
            update();
          });
          on(posNum, "change", function () {
            stop.pos = Math.max(0, Math.min(100, Number(posNum.value) || 0));
            posRange.value = String(stop.pos);
            update();
          });
          on(btnRemove, "click", function () {
            state.stops.splice(i, 1);
            renderStops();
            update();
          });

          stopsWrap.appendChild(dom.el("div", { class: "dt-grad-stop" }, [
            colorIn,
            hexLabel,
            posRange,
            posNum,
            dom.el("span", { class: "dt-help", text: "%" }),
            btnRemove,
          ]));
        });
      }

      function update() {
        const css = buildCss(state);
        preview.style.background = css;
        output.value = "background: " + css + ";";
        angleGroup.style.display = state.type === "radial" ? "none" : "";
      }

      on(typeSel, "change", function () {
        state.type = typeSel.value;
        update();
      });
      on(angleRange, "input", function () {
        state.angle = Number(angleRange.value);
        angleNum.value = String(state.angle);
        update();
      });
      on(angleNum, "change", function () {
        state.angle = Math.max(0, Math.min(360, Number(angleNum.value) || 0));
        angleRange.value = String(state.angle);
        update();
      });
      on(btnAdd, "click", function () {
        if (state.stops.length >= 6) {
          DT.ui.toast.info("Six stops is the editor limit");
          return;
        }
        state.stops.push({ color: "#10b981", pos: 50 });
        renderStops();
        update();
      });
      on(btnRandom, "click", function () {
        const base = Math.floor(Math.random() * 360);
        state.stops = [
          { color: hslToHex(base, 75, 55), pos: 0 },
          { color: hslToHex((base + 70) % 360, 75, 45), pos: 100 },
        ];
        renderStops();
        update();
      });
      on(btnCopy, "click", function () {
        DT.utils.clipboard.copy(output.value)
          .then(function () { DT.ui.toast.success("Copied"); })
          .catch(function () { DT.ui.toast.error("Copy failed"); });
      });

      renderStops();
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
