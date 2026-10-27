/**
 * File: js/tools/favicon.js
 * Module: Tool — Favicon Generator
 * Purpose: Turn an uploaded image or a short piece of text
 *          into a full favicon set: PNGs at 16, 32, 48, 180,
 *          192 and 512 px plus a classic favicon.ico holding
 *          the 16, 32 and 48 px images.
 * Notes: Everything is drawn on canvas locally; nothing is
 *        uploaded. The .ico file is assembled with
 *        DT.utils.ico (PNG entries inside an ICO container,
 *        which every modern browser accepts).
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

  const SIZES = [16, 32, 48, 180, 192, 512];
  const ICO_SIZES = [16, 32, 48];

  DT.tools.favicon = {
    id: "favicon",
    name: "Favicon Generator",
    category: "Generators",
    icon: "appWindow",
    description: "Make a full favicon set (PNG sizes plus favicon.ico) from an image or text.",
    keywords: "favicon icon generator ico png apple touch android sizes website",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const state = {
        mode: "text",       // 'text' | 'image'
        image: null,        // HTMLImageElement when a file is loaded
        objectUrl: "",
      };

      /* ----- Source panel ----- */
      const modeTextBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Text / Letter" });
      const modeImgBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Upload image" });

      const letterIn = dom.el("input", {
        type: "text", class: "dt-input dt-fav-letter", id: "dt-fav-letter",
        value: "D", maxlength: "2", autocomplete: "off",
      });
      const bgIn = dom.el("input", { type: "color", class: "dt-grad-stop__color", id: "dt-fav-bg", value: "#2563eb" });
      const fgIn = dom.el("input", { type: "color", class: "dt-grad-stop__color", id: "dt-fav-fg", value: "#ffffff" });
      const textFields = dom.el("div", { class: "dt-fav-textfields", id: "dt-fav-textfields" }, [
        dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", for: "dt-fav-letter", text: "Letter(s)" }),
          letterIn,
        ]),
        dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", text: "Background" }),
          bgIn,
        ]),
        dom.el("div", { class: "dt-field" }, [
          dom.el("label", { class: "dt-label", text: "Text color" }),
          fgIn,
        ]),
      ]);

      const dropZone = DT.ui.fileDrop({
        label: "Drop a square image (PNG or JPG), or click to browse",
        accept: "image/*",
        maxBytes: 10 * 1024 * 1024,
        onFile: function (file) { loadImageFile(file); },
      });
      const dropWrap = dom.el("div", { id: "dt-fav-dropwrap", style: { display: "none" } }, [dropZone.el]);

      const sourcePanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Source", [modeTextBtn, modeImgBtn]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [textFields, dropWrap]),
      ]);

      /* ----- Results panel ----- */
      const cardsWrap = dom.el("div", { class: "dt-fav-cards", id: "dt-fav-cards" });
      const icoBtn = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Download favicon.ico" });
      const resultPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Your favicon set", [icoBtn]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [cardsWrap]),
      ]);

      workspace.appendChild(sourcePanel);
      workspace.appendChild(resultPanel);
      container.appendChild(workspace);

      refs = {};

      /* ----- Canvas helpers ----- */

      function roundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      // Draw the master artwork (image cover-fit or letter) at a size.
      function drawAt(canvas, size) {
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;
        ctx.clearRect(0, 0, size, size);
        if (state.mode === "image" && state.image) {
          const img = state.image;
          const scale = Math.max(size / img.naturalWidth, size / img.naturalHeight);
          const w = img.naturalWidth * scale;
          const h = img.naturalHeight * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          return true;
        }
        // Text mode: branded rounded tile + letter
        const r = Math.round(size * 0.22);
        roundRectPath(ctx, 0, 0, size, size, r);
        ctx.fillStyle = bgIn.value;
        ctx.fill();
        ctx.fillStyle = fgIn.value;
        ctx.font = "700 " + Math.round(size * 0.58) + "px Sora, 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(letterIn.value || "?", size / 2, size / 2 + Math.round(size * 0.03));
        return true;
      }

      function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }

      function canvasBlob(canvas) {
        return new Promise(function (resolve) {
          if (canvas.toBlob) {
            canvas.toBlob(function (b) { resolve(b); }, "image/png");
          } else {
            resolve(null);
          }
        });
      }

      /* ----- Rendering the size cards ----- */

      function renderCards() {
        DT.ui.dom.clear(cardsWrap);
        SIZES.forEach(function (size) {
          const canvas = dom.el("canvas", { class: "dt-fav-card__canvas", width: String(size), height: String(size) });
          canvas.style.width = Math.min(size, 64) + "px";
          canvas.style.height = Math.min(size, 64) + "px";
          const ok = drawAt(canvas, size);
          const btn = dom.el("button", {
            type: "button",
            class: "dt-btn dt-btn--secondary dt-btn--sm",
            text: "PNG",
          });
          btn.disabled = !ok;
          on(btn, "click", function () {
            canvasBlob(canvas).then(function (blob) {
              if (blob) downloadBlob(blob, "favicon-" + size + "x" + size + ".png");
              else DT.ui.toast.error("Download is not available here");
            });
          });
          cardsWrap.appendChild(dom.el("div", { class: "dt-fav-card" }, [
            dom.el("div", { class: "dt-fav-card__stage" }, [canvas]),
            dom.el("div", { class: "dt-fav-card__label", text: size + " × " + size }),
            btn,
          ]));
        });
      }

      async function downloadIco() {
        try {
          const entries = [];
          for (const size of ICO_SIZES) {
            const canvas = document.createElement("canvas");
            if (!drawAt(canvas, size)) throw new Error("canvas");
            const blob = await canvasBlob(canvas);
            if (!blob) throw new Error("blob");
            const buf = new Uint8Array(await blob.arrayBuffer());
            entries.push({ size: size, png: buf });
          }
          const bytes = DT.utils.ico.build(entries);
          downloadBlob(new Blob([bytes], { type: "image/x-icon" }), "favicon.ico");
          DT.ui.toast.success("favicon.ico saved");
        } catch (e) {
          DT.ui.toast.error("Could not build the ICO file here");
        }
      }

      function loadImageFile(file) {
        if (!file) return;
        if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
        state.objectUrl = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = function () {
          state.image = img;
          renderCards();
        };
        img.onerror = function () {
          DT.ui.toast.error("That file could not be read as an image");
        };
        img.src = state.objectUrl;
      }

      /* ----- Wiring ----- */

      function setMode(mode) {
        state.mode = mode;
        textFields.style.display = mode === "text" ? "" : "none";
        dropWrap.style.display = mode === "image" ? "" : "none";
        modeTextBtn.className = "dt-btn dt-btn--sm " + (mode === "text" ? "dt-btn--secondary" : "dt-btn--ghost");
        modeImgBtn.className = "dt-btn dt-btn--sm " + (mode === "image" ? "dt-btn--secondary" : "dt-btn--ghost");
        renderCards();
      }

      on(modeTextBtn, "click", function () { setMode("text"); });
      on(modeImgBtn, "click", function () { setMode("image"); });
      [letterIn].forEach(function (el) { on(el, "input", renderCards); });
      [bgIn, fgIn].forEach(function (el) { on(el, "input", renderCards); });
      on(icoBtn, "click", downloadIco);

      renderCards();
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
