/**
 * File: js/tools/image.js
 * Module: Tool — Image Compressor / Resizer
 * Purpose: Compress, resize and convert images (PNG, JPEG, WebP)
 *          with the Canvas API. Side-by-side size comparison and a
 *          one-click download of the result.
 * Notes: Everything happens locally on a canvas. The original file
 *        never leaves the browser.
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

  const MAX_BYTES = 25 * 1024 * 1024;
  const FORMAT_MIME = { keep: null, png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
  const FORMAT_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

  DT.tools.image = {
    id: "image",
    name: "Image Compressor",
    category: "Conversion",
    icon: "image",
    description: "Compress, resize and convert images. PNG, JPEG, WebP.",

    keywords: "image compress resize convert png jpeg jpg webp optimize photo shrink",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const fileSlot = dom.el("div", {});
      const drop = DT.ui.fileDrop({
        label: "Drop an image here, or click to browse (max 25 MB)",
        accept: "image/*",
        maxBytes: MAX_BYTES,
        onFile: function (file) { loadFile(file); },
      });
      fileSlot.appendChild(drop.el);
      const dropPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Image" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [fileSlot]),
      ]);

      /* Controls */
      const formatSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-img-format" }, [
        dom.el("option", { value: "keep", text: "Keep format" }),
        dom.el("option", { value: "png", text: "PNG" }),
        dom.el("option", { value: "jpeg", text: "JPEG" }),
        dom.el("option", { value: "webp", text: "WebP" }),
      ]);
      formatSel.style.width = "130px";
      const scaleSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-img-scale" }, [
        dom.el("option", { value: "1", text: "100%" }),
        dom.el("option", { value: "0.75", text: "75%" }),
        dom.el("option", { value: "0.5", text: "50%" }),
        dom.el("option", { value: "0.25", text: "25%" }),
      ]);
      scaleSel.style.width = "90px";
      const maxWidth = dom.el("input", {
        type: "number",
        class: "dt-input",
        id: "dt-img-maxwidth",
        min: "1",
        placeholder: "No limit",
      });
      maxWidth.style.width = "110px";
      const quality = dom.el("input", {
        type: "range",
        id: "dt-img-quality",
        min: "10",
        max: "100",
        value: "82",
      });
      quality.style.width = "140px";
      const qualityVal = dom.el("span", { class: "dt-help", text: "82%" });
      const btnConvert = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Convert" });
      const btnDownload = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Download result", disabled: "disabled" });

      const controls = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Settings" }),
        ]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [
          dom.el("div", { class: "dt-toolbar", style: { marginBottom: "0", flexWrap: "wrap", gap: "14px" } }, [
            dom.el("div", { class: "dt-toolbar__group" }, [
              dom.el("span", { class: "dt-toolbar__label", text: "Format" }),
              formatSel,
            ]),
            dom.el("div", { class: "dt-toolbar__group" }, [
              dom.el("span", { class: "dt-toolbar__label", text: "Scale" }),
              scaleSel,
            ]),
            dom.el("div", { class: "dt-toolbar__group" }, [
              dom.el("span", { class: "dt-toolbar__label", text: "Max width (px)" }),
              maxWidth,
            ]),
            dom.el("div", { class: "dt-toolbar__group" }, [
              dom.el("span", { class: "dt-toolbar__label", text: "Quality" }),
              quality,
              qualityVal,
            ]),
            dom.el("div", { class: "dt-toolbar__group" }, [btnConvert, btnDownload]),
          ]),
          dom.el("div", {
            class: "dt-help",
            text: "Quality applies to JPEG and WebP. PNG ignores it. GIF and SVG inputs are rasterized to the chosen format.",
          }),
        ]),
      ]);

      /* Previews */
      const origImg = dom.el("img", { class: "dt-img-preview", alt: "Original" });
      const newImg = dom.el("img", { class: "dt-img-preview", alt: "Converted" });
      const origStats = dom.el("div", { class: "dt-help", text: "No image loaded yet." });
      const newStats = dom.el("div", { class: "dt-help", text: "" });
      const previews = dom.el("div", { class: "dt-img-grid" }, [
        dom.el("div", {}, [
          dom.el("div", { class: "dt-panel__title", style: { marginBottom: "8px" }, text: "Original" }),
          origImg,
          origStats,
        ]),
        dom.el("div", {}, [
          dom.el("div", { class: "dt-panel__title", style: { marginBottom: "8px" }, text: "Result" }),
          newImg,
          newStats,
        ]),
      ]);
      const previewPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [previews]),
      ]);

      workspace.appendChild(dropPanel);
      workspace.appendChild(controls);
      workspace.appendChild(previewPanel);
      container.appendChild(workspace);

      refs = { formatSel, scaleSel, maxWidth, quality, qualityVal, btnDownload, origImg, newImg, origStats, newStats };

      let source = null;      // { bitmap, url, name, type, bytes, width, height }
      let resultBlob = null;
      let resultName = "image";

      function fmtSize(bytes) {
        return DT.ui.fileDrop.formatSize(bytes);
      }

      function loadFile(file) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          source = {
            img: img,
            url: url,
            name: file.name,
            type: file.type || "image/png",
            bytes: file.size,
            width: img.naturalWidth,
            height: img.naturalHeight,
          };
          origImg.src = url;
          origStats.textContent =
            file.name + " · " + source.width + "×" + source.height + " · " + fmtSize(file.size);
          resultBlob = null;
          btnDownload.disabled = true;
          newImg.removeAttribute("src");
          newStats.textContent = "";
          convert();
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          DT.ui.toast.error("That file could not be read as an image");
        };
        img.src = url;
      }

      function targetSize() {
        let w = source.width;
        let h = source.height;
        const scale = parseFloat(scaleSel.value) || 1;
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const limit = parseInt(maxWidth.value, 10);
        if (limit > 0 && w > limit) {
          h = Math.max(1, Math.round(h * (limit / w)));
          w = limit;
        }
        return { w: w, h: h };
      }

      function convert() {
        if (!source) {
          DT.ui.toast.info("Load an image first");
          return;
        }
        const mime = FORMAT_MIME[formatSel.value] || source.type || "image/png";
        const outMime = FORMAT_EXT[mime] ? mime : "image/png";
        const size = targetSize();
        const canvas = document.createElement("canvas");
        canvas.width = size.w;
        canvas.height = size.h;
        const ctx = canvas.getContext("2d");
        if (outMime === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size.w, size.h);
        }
        ctx.drawImage(source.img, 0, 0, size.w, size.h);
        const q = (parseInt(quality.value, 10) || 82) / 100;
        canvas.toBlob(function (blob) {
          if (!blob) {
            DT.ui.toast.error("Conversion failed in this browser");
            return;
          }
          resultBlob = blob;
          const base = source.name.replace(/\.[^.]+$/, "") || "image";
          resultName = base + "-converted." + FORMAT_EXT[outMime];
          newImg.src = URL.createObjectURL(blob);
          const saved = source.bytes > 0 ? Math.round((1 - blob.size / source.bytes) * 100) : 0;
          newStats.textContent =
            resultName + " · " + size.w + "×" + size.h + " · " + fmtSize(blob.size) +
            (saved > 0 ? " · " + saved + "% smaller" : saved < 0 ? " · " + Math.abs(saved) + "% larger" : "");
          btnDownload.disabled = false;
        }, outMime, q);
      }

      on(quality, "input", function () { qualityVal.textContent = quality.value + "%"; });
      on(btnConvert, "click", convert);
      on(formatSel, "change", function () { if (source) convert(); });
      on(scaleSel, "change", function () { if (source) convert(); });
      on(btnDownload, "click", function () {
        if (!resultBlob) return;
        const url = URL.createObjectURL(resultBlob);
        const a = dom.el("a", { href: url, download: resultName });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      });
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
