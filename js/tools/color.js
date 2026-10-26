/**
 * File: js/tools/color.js
 * Module: Tool — Color Tools
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  const STORAGE_KEY = "dt:colors";
  let refs = null;
  const listeners = [];
  let state = { r: 79, g: 70, b: 229 };

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function rgbToHex(r, g, b) {
    const h = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
    return "#" + h(r) + h(g) + h(b);
  }
  function hexToRgb(hex) {
    let s = String(hex || "")
      .trim()
      .replace(/^#/, "");
    if (s.length === 3)
      s = s
        .split("")
        .map((c) => c + c)
        .join("");
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16),
    };
  }
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h = 0,
      s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }
  function hslToRgb(h, s, l) {
    h = (((h % 360) + 360) % 360) / 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    function hue(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    let r, g, b;
    if (s === 0) r = g = b = l;
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3);
      g = hue(p, q, h);
      b = hue(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

/* ------------------------------------------------------------
   * Phase 2B: OKLCH, luminance, contrast, shades
   * ------------------------------------------------------------ */
  function formatOklch(rgb) {
    function lin(c) {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    const r = lin(rgb.r), g = lin(rgb.g), b = lin(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    const C = Math.sqrt(a * a + bb * bb);
    let H = (Math.atan2(bb, a) * 180) / Math.PI;
    if (H < 0) H += 360;
    return (
      "oklch(" +
      (L * 100).toFixed(1) + "% " +
      C.toFixed(3) + " " +
      H.toFixed(1) + ")"
    );
  }

  /** WCAG relative luminance of an {r,g,b} color. */
  function luminance(rgb) {
    function lin(c) {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  }
  function contrastRatio(a, b) {
    const la = luminance(a), lb = luminance(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function mixRgb(rgb, target, t) {
    return {
      r: Math.round(rgb.r + (target.r - rgb.r) * t),
      g: Math.round(rgb.g + (target.g - rgb.g) * t),
      b: Math.round(rgb.b + (target.b - rgb.b) * t),
    };
  }

  let contrastBg = { r: 255, g: 255, b: 255 };

  function renderShades() {
    if (!refs || !refs.shadesSlot) return;
    const dom = DT.ui.dom;
    DT.ui.dom.clear(refs.shadesSlot);
    DT.ui.dom.clear(refs.tintsSlot);
    const BLACK = { r: 0, g: 0, b: 0 }, WHITE = { r: 255, g: 255, b: 255 };
    function row(slot, target) {
      [0.15, 0.3, 0.45, 0.6, 0.75].forEach(function (t) {
        const c = mixRgb(state, target, t);
        const hex = rgbToHex(c.r, c.g, c.b);
        const sw = dom.el("button", {
          type: "button",
          class: "dt-swatch dt-swatch--sm",
          title: hex + " (click to use + copy)",
          style: { backgroundColor: hex },
        });
        sw.addEventListener("click", function () {
          setFromRgb(c);
          DT.utils.clipboard.copy(hex).then(function () {
            DT.ui.toast.success(hex + " copied");
          }).catch(function () {});
        });
        slot.appendChild(sw);
      });
    }
    row(refs.shadesSlot, BLACK);
    row(refs.tintsSlot, WHITE);
  }

  function contrastBadge(label, ratio, needed) {
    const dom = DT.ui.dom;
    const pass = ratio >= needed;
    return dom.el("span", {
      class: "dt-contrast-badge " + (pass ? "dt-contrast-badge--pass" : "dt-contrast-badge--fail"),
      text: label + " " + (pass ? "Pass" : "Fail"),
      title: "Needs " + needed + ":1",
    });
  }

  function renderContrast() {
    if (!refs || !refs.contrastSlot) return;
    const dom = DT.ui.dom;
    DT.ui.dom.clear(refs.contrastSlot);
    const ratio = contrastRatio(state, contrastBg);
    refs.contrastSlot.appendChild(
      dom.el("div", { class: "dt-contrast-ratio", text: ratio.toFixed(2) + " : 1" }),
    );
    const badges = dom.el("div", { class: "dt-row", style: { gap: "6px", flexWrap: "wrap" } }, [
      contrastBadge("AA normal", ratio, 4.5),
      contrastBadge("AA large", ratio, 3),
      contrastBadge("AAA normal", ratio, 7),
      contrastBadge("AAA large", ratio, 4.5),
    ]);
    refs.contrastSlot.appendChild(badges);
    refs.contrastSlot.appendChild(
      dom.el("div", {
        class: "dt-help",
        text: "Text size counts as large from 18pt (or 14pt bold).",
      }),
    );
    if (refs.bgPicker) refs.bgPicker.value = rgbToHex(contrastBg.r, contrastBg.g, contrastBg.b);
    if (refs.bgHex) refs.bgHex.value = rgbToHex(contrastBg.r, contrastBg.g, contrastBg.b);
    if (refs.fgSwatch) refs.fgSwatch.style.backgroundColor = formatHex(state);
    if (refs.bgSwatch) refs.bgSwatch.style.backgroundColor = rgbToHex(contrastBg.r, contrastBg.g, contrastBg.b);
  }

  function formatHex(rgb) {
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  function formatRgb(rgb) {
    return "rgb(" + rgb.r + ", " + rgb.g + ", " + rgb.b + ")";
  }
  function formatHsl(rgb) {
    const h = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return "hsl(" + h.h + ", " + h.s + "%, " + h.l + "%)";
  }

  function paintInputs() {
    refs.hex.value = formatHex(state);
    refs.rgb.value = formatRgb(state);
    refs.hsl.value = formatHsl(state);
    if (refs.oklch) refs.oklch.value = formatOklch(state);
    refs.preview.style.backgroundColor = formatHex(state);
    refs.picker.value = formatHex(state);
    renderShades();
    renderContrast();
  }

  function setFromRgb(rgb) {
    state = {
      r: clamp(rgb.r, 0, 255),
      g: clamp(rgb.g, 0, 255),
      b: clamp(rgb.b, 0, 255),
    };
    paintInputs();
  }

  function setFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return false;
    setFromRgb(rgb);
    return true;
  }

  function copyIconButton(label) {
    const dom = DT.ui.dom;
    const btn = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm",
      "aria-label": "Copy " + label,
      title: "Copy " + label,
    });
    const icon = dom.svg(
      '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    );
    if (icon) btn.appendChild(icon);
    return btn;
  }

  function loadSaved() {
    return DT.core.storage
      .get(STORAGE_KEY, [])
      .then((l) => (Array.isArray(l) ? l : []));
  }
  function saveSaved(list) {
    return DT.core.storage.set(STORAGE_KEY, list);
  }

  function renderSwatches(list) {
    const dom = DT.ui.dom;
    DT.ui.dom.clear(refs.swatchSlot);
    if (!list.length) {
      refs.swatchSlot.appendChild(
        dom.el("div", {
          class: "dt-help",
          style: { padding: "12px 0" },
          text: 'No saved colors yet. Pick a color and click "Save".',
        }),
      );
      return;
    }
    const grid = dom.el("div", { class: "dt-swatches" });
    list.forEach((hex, idx) => {
      const swatch = dom.el("button", {
        type: "button",
        class: "dt-swatch",
        title: hex + " — click to copy",
        style: { backgroundColor: hex },
      });
      swatch.addEventListener("click", () => {
        setFromHex(hex);
        DT.utils.clipboard
          .copy(hex)
          .then(() => DT.ui.toast.success(hex + " copied"))
          .catch(() => {});
      });
      swatch.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        removeSwatch(idx);
      });
      const removeBtn = dom.el(
        "button",
        {
          type: "button",
          class: "dt-swatch__remove",
          "aria-label": "Remove " + hex,
          title: "Remove",
        },
        [dom.txt("×")],
      );
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeSwatch(idx);
      });
      swatch.appendChild(removeBtn);
      grid.appendChild(swatch);
    });
    refs.swatchSlot.appendChild(grid);
  }

  function removeSwatch(idx) {
    loadSaved().then((list) => {
      list.splice(idx, 1);
      saveSaved(list).then(() => {
        renderSwatches(list);
        DT.ui.toast.success("Removed");
      });
    });
  }

  function saveCurrent() {
    const hex = formatHex(state);
    loadSaved().then((list) => {
      if (list.indexOf(hex) !== -1) {
        DT.ui.toast.info(hex + " already saved");
        return;
      }
      list.push(hex);
      saveSaved(list).then(() => {
        renderSwatches(list);
        DT.ui.toast.success(hex + " saved");
      });
    });
  }

  function clearAllSwatches() {
    loadSaved().then(function (snap) {
      if (!snap.length) {
        DT.ui.toast.info("Nothing to clear");
        return;
      }
      saveSaved([]).then(function () {
        renderSwatches([]);
        DT.ui.toast.undo(
          "Cleared " +
            snap.length +
            " swatch" +
            (snap.length === 1 ? "" : "es"),
          function () {
            saveSaved(snap).then(function () {
              renderSwatches(snap);
            });
          },
        );
      });
    });
  }

  DT.tools.color = {
    id: "color",
    name: "Color Tools",
    category: "Color",
    icon: "palette",
    description: "Convert HEX, RGB, HSL, OKLCH. Contrast checker and shades.",

    keywords: "hex rgb hsl oklch picker swatch palette eyedropper colour convert shades tints contrast wcag accessibility",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const picker = dom.el("input", {
        type: "color",
        class: "dt-color-picker",
        id: "dt-color-picker",
        value: formatHex(state),
        "aria-label": "Pick color",
      });
      const preview = dom.el("div", { class: "dt-color-preview" });

      /* --- Eyedropper button (native EyeDropper API) --- */
      const eyedropperBtn = dom.el("button", {
        type: "button",
        class:
          "dt-btn dt-btn--secondary dt-btn--icon dt-btn--lg dt-color-eyedropper",
        id: "dt-color-eyedropper",
        "aria-label": "Pick a color from anywhere on screen",
        title: "Pick color from screen",
      });
      const eyedropperIcon = dom.svg(
        '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--lg" ' +
          'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="m2 22 1-1h3l9-9"/>' +
          '<path d="M3 21v-3l9-9"/>' +
          '<path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.7.7a1 1 0 0 1 0 1.4l-1.6 1.6a1 1 0 0 1-1.4 0l-5.7-5.7a1 1 0 0 1 0-1.4L11.6 4a1 1 0 0 1 1.4 0l.7.7Z"/>' +
          "</svg>",
      );
      if (eyedropperIcon) eyedropperBtn.appendChild(eyedropperIcon);

      /* Disable if the browser doesn't support EyeDropper */
      if (typeof window.EyeDropper !== "function") {
        eyedropperBtn.disabled = true;
        eyedropperBtn.title = "Not supported in this browser";
      }

      const previewRow = dom.el(
        "div",
        { class: "dt-row", style: { gap: "12px", alignItems: "center" } },
        [picker, eyedropperBtn, dom.el("div", { class: "dt-grow" }, [preview])],
      );

      const hex = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-color-hex",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "#4f46e5",
      });
      const hexCopy = copyIconButton("HEX");
      const hexRow = dom.el("div", { class: "dt-result__row" }, [
        dom.el("div", { class: "dt-result__label", text: "HEX" }),
        hex,
        hexCopy,
      ]);

      const rgb = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-color-rgb",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "rgb(79, 70, 229)",
      });
      const rgbCopy = copyIconButton("RGB");
      const rgbRow = dom.el("div", { class: "dt-result__row" }, [
        dom.el("div", { class: "dt-result__label", text: "RGB" }),
        rgb,
        rgbCopy,
      ]);

      const hsl = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-color-hsl",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "hsl(244, 76%, 59%)",
      });
      const hslCopy = copyIconButton("HSL");
      const hslRow = dom.el("div", { class: "dt-result__row" }, [
        dom.el("div", { class: "dt-result__label", text: "HSL" }),
        hsl,
        hslCopy,
      ]);

      const oklch = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-color-oklch",
        readonly: "readonly",
        spellcheck: "false",
      });
      const oklchCopy = copyIconButton("OKLCH");
      const oklchRow = dom.el("div", { class: "dt-result__row" }, [
        dom.el("div", { class: "dt-result__label", text: "OKLCH" }),
        oklch,
        oklchCopy,
      ]);

      const fieldsPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Values" }),
        ]),
        dom.el(
          "div",
          { class: "dt-panel__body", style: { padding: "8px 16px" } },
          [hexRow, rgbRow, hslRow, oklchRow],
        ),
      ]);

      /* --- Shades & tints panel --- */
      const shadesSlot = dom.el("div", { class: "dt-shades-row", id: "dt-color-shades" });
      const tintsSlot = dom.el("div", { class: "dt-shades-row", id: "dt-color-tints" });
      const shadesPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Shades & tints" }),
        ]),
        dom.el("div", {
          class: "dt-panel__body",
          style: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" },
        }, [
          dom.el("div", { class: "dt-result__row" }, [
            dom.el("div", { class: "dt-result__label", text: "Shades" }),
            shadesSlot,
          ]),
          dom.el("div", { class: "dt-result__row" }, [
            dom.el("div", { class: "dt-result__label", text: "Tints" }),
            tintsSlot,
          ]),
        ]),
      ]);

      /* --- Contrast panel (WCAG) --- */
      const fgSwatch = dom.el("div", { class: "dt-contrast-swatch", title: "Text / foreground (current color)" });
      const bgSwatch = dom.el("div", { class: "dt-contrast-swatch", title: "Background" });
      const bgPicker = dom.el("input", {
        type: "color",
        class: "dt-color-picker dt-color-picker--sm",
        id: "dt-color-bg-picker",
        value: "#ffffff",
        "aria-label": "Pick background color",
      });
      const bgHex = dom.el("input", {
        type: "text",
        class: "dt-input",
        id: "dt-color-bg-hex",
        autocomplete: "off",
        spellcheck: "false",
        value: "#ffffff",
      });
      bgHex.style.width = "110px";
      const btnSwap = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Swap",
      });
      const contrastSlot = dom.el("div", {
        id: "dt-color-contrast",
        style: { display: "flex", flexDirection: "column", gap: "8px" },
      });
      const contrastPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Contrast (WCAG)" }),
        ]),
        dom.el("div", {
          class: "dt-panel__body",
          style: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" },
        }, [
          dom.el("div", { class: "dt-row", style: { gap: "10px", alignItems: "center", flexWrap: "wrap" } }, [
            dom.el("span", { class: "dt-toolbar__label", text: "Text" }),
            fgSwatch,
            dom.el("span", { class: "dt-toolbar__label", text: "On" }),
            bgSwatch,
            bgPicker,
            bgHex,
            btnSwap,
          ]),
          contrastSlot,
        ]),
      ]);

      const btnSave = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Save color",
      });
      const btnRandom = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Random",
      });
      const btnClearSw = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear swatches",
      });

      const actions = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [btnSave, btnRandom]),
        btnClearSw,
      ]);

      const swatchSlot = dom.el("div", {
        id: "dt-color-swatches",
        style: { padding: "12px 16px" },
      });

      const swatchPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Saved colors" }),
        ]),
        swatchSlot,
      ]);

      workspace.appendChild(previewRow);
      workspace.appendChild(fieldsPanel);
      workspace.appendChild(shadesPanel);
      workspace.appendChild(contrastPanel);
      workspace.appendChild(actions);
      workspace.appendChild(swatchPanel);
      container.appendChild(workspace);

      refs = {
        preview, picker, hex, rgb, hsl, oklch, swatchSlot,
        shadesSlot, tintsSlot, contrastSlot, bgPicker, bgHex, fgSwatch, bgSwatch,
      };
      paintInputs();

      function attachCopy(btn, getVal, label) {
        btn.addEventListener("click", () => {
          const v = getVal();
          if (!v) {
            DT.ui.toast.info("Nothing to copy");
            return;
          }
          DT.utils.clipboard
            .copy(v)
            .then(() => DT.ui.toast.success(label + " copied"))
            .catch(() => DT.ui.toast.error("Copy failed"));
        });
      }
      attachCopy(hexCopy, () => formatHex(state), "HEX");
      attachCopy(rgbCopy, () => formatRgb(state), "RGB");
      attachCopy(hslCopy, () => formatHsl(state), "HSL");
      attachCopy(oklchCopy, () => formatOklch(state), "OKLCH");

      on(bgPicker, "input", () => {
        const c = hexToRgb(bgPicker.value);
        if (c) { contrastBg = c; renderContrast(); }
      });
      on(bgHex, "input", () => {
        const c = hexToRgb(bgHex.value.trim());
        if (c) { contrastBg = c; renderContrast(); }
      });
      on(btnSwap, "click", () => {
        const prevFg = { r: state.r, g: state.g, b: state.b };
        const prevBg = contrastBg;
        contrastBg = prevFg;
        setFromRgb(prevBg);
      });

      on(picker, "input", () => setFromHex(picker.value));
      /* --- Eyedropper click --- */
      on(eyedropperBtn, "click", function () {
        if (typeof window.EyeDropper !== "function") {
          DT.ui.toast.error("Eyedropper not supported");
          return;
        }
        const eyeDropper = new window.EyeDropper();
        eyeDropper
          .open()
          .then(function (result) {
            if (result && result.sRGBHex) {
              setFromHex(result.sRGBHex);
              DT.ui.toast.success("Picked " + result.sRGBHex);
            }
          })
          .catch(function (err) {
            // User pressed Escape or cancelled — not an error
            if (err && err.name === "AbortError") return;
            DT.ui.toast.error("Eyedropper failed");
            console.error("[DT color]", err);
          });
      });
      on(hex, "input", () => {
        const rgbVal = hexToRgb(hex.value.trim());
        if (rgbVal) setFromRgb(rgbVal);
      });
      on(rgb, "input", () => {
        const m = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(rgb.value);
        if (!m) return;
        setFromRgb({
          r: parseInt(m[1], 10),
          g: parseInt(m[2], 10),
          b: parseInt(m[3], 10),
        });
      });
      on(hsl, "input", () => {
        const m = /hsla?\(\s*(-?\d+)\s*,\s*(\d+)\s*%?\s*,\s*(\d+)\s*%?/i.exec(
          hsl.value,
        );
        if (!m) return;
        setFromRgb(
          hslToRgb(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)),
        );
      });

      on(btnSave, "click", saveCurrent);
      on(btnRandom, "click", () => {
        const bytes = new Uint8Array(3);
        crypto.getRandomValues(bytes);
        setFromRgb({ r: bytes[0], g: bytes[1], b: bytes[2] });
        DT.ui.toast.success("Random color");
      });
      on(btnClearSw, "click", clearAllSwatches);

      loadSaved().then(renderSwatches);
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
