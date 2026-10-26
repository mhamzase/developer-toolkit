/**
 * File: js/tools/qr.js
 * Module: Tool — QR Code Generator
 * Purpose: Generate QR codes locally (byte mode, error correction
 *          level M, versions 1 to 6, up to 106 UTF-8 bytes).
 * Notes: A compact from-scratch encoder: Reed-Solomon over GF(256),
 *        mask selection by the standard penalty rules, SVG output.
 *        No library, no network, nothing leaves the browser.
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

  /* ---------------- GF(256) arithmetic ---------------- */

  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGf() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  /* ---------------- Reed-Solomon ---------------- */

  /**
   * Generator polynomial with the given number of check bytes:
   * the product of (x + alpha^i) for i in 0..degree-1, stored in
   * descending-power order with a leading 1.
   */
  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  /** Error-correction bytes for one data block. */
  function rsCompute(data, degree) {
    const gen = rsGenerator(degree);
    const result = new Array(degree).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ result[0];
      result.shift();
      result.push(0);
      for (let j = 0; j < degree; j++) {
        result[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return result;
  }

  /* ---------------- Version table (ECC level M) ---------------- */

  // data blocks: per-version data-codeword counts per block;
  // ecc: check bytes per block; align: alignment pattern centers.
  const VERSIONS = [
    null,
    { blocks: [16], ecc: 10, align: [] },
    { blocks: [28], ecc: 16, align: [6, 18] },
    { blocks: [44], ecc: 26, align: [6, 22] },
    { blocks: [32, 32], ecc: 18, align: [6, 26] },
    { blocks: [43, 43], ecc: 24, align: [6, 30] },
    { blocks: [27, 27, 27, 27], ecc: 16, align: [6, 34] },
  ];
  const MAX_BYTES = 106; // version 6-M byte-mode capacity

  function totalDataCodewords(v) {
    return VERSIONS[v].blocks.reduce(function (a, b) { return a + b; }, 0);
  }

  function pickVersion(byteLength) {
    for (let v = 1; v <= 6; v++) {
      const capacityBits = totalDataCodewords(v) * 8;
      if (4 + 8 + byteLength * 8 <= capacityBits) return v;
    }
    return 0;
  }

  /* ---------------- Data encoding ---------------- */

  function buildDataCodewords(bytes, version) {
    const total = totalDataCodewords(version);
    const bits = [];
    function push(value, length) {
      for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    }
    push(0b0100, 4);            // byte mode
    push(bytes.length, 8);      // length (versions 1-9)
    bytes.forEach(function (b) { push(b, 8); });
    const capacity = total * 8;
    const terminator = Math.min(4, capacity - bits.length);
    for (let i = 0; i < terminator; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    const pads = [0xec, 0x11];
    let p = 0;
    while (codewords.length < total) {
      codewords.push(pads[p % 2]);
      p++;
    }
    return codewords;
  }

  function interleaveWithEcc(dataCodewords, version) {
    const info = VERSIONS[version];
    const blocks = [];
    let offset = 0;
    info.blocks.forEach(function (size) {
      const data = dataCodewords.slice(offset, offset + size);
      offset += size;
      blocks.push({ data: data, ecc: rsCompute(data, info.ecc) });
    });
    const out = [];
    const maxData = Math.max.apply(null, info.blocks);
    for (let i = 0; i < maxData; i++) {
      blocks.forEach(function (b) { if (i < b.data.length) out.push(b.data[i]); });
    }
    for (let i = 0; i < info.ecc; i++) {
      blocks.forEach(function (b) { out.push(b.ecc[i]); });
    }
    return out;
  }

  /* ---------------- Matrix construction ---------------- */

  function formatBits(mask) {
    const data = mask; // ECC M format bits are 00, so data = mask alone
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function buildMatrix(codewords, version) {
    const size = version * 4 + 17;
    const grid = [];
    const isFunc = [];
    for (let r = 0; r < size; r++) {
      grid.push(new Array(size).fill(0));
      isFunc.push(new Array(size).fill(false));
    }
    function setF(x, y, v) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        grid[y][x] = v;
        isFunc[y][x] = true;
      }
    }

    // Timing patterns
    for (let i = 0; i < size; i++) {
      setF(6, i, i % 2 === 0 ? 1 : 0);
      setF(i, 6, i % 2 === 0 ? 1 : 0);
    }
    // Finder patterns (centers at the three corners)
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          setF(c[0] + dx, c[1] + dy, dist !== 2 && dist !== 4 ? 1 : 0);
        }
      }
    });
    // Alignment patterns
    const centers = VERSIONS[version].align;
    centers.forEach(function (x) {
      centers.forEach(function (y) {
        const isCorner =
          (x === centers[0] && y === centers[0]) ||
          (x === centers[centers.length - 1] && y === centers[0]) ||
          (x === centers[0] && y === centers[centers.length - 1]);
        if (isCorner) return;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy));
            setF(x + dx, y + dy, dist !== 1 ? 1 : 0);
          }
        }
      });
    });

    function drawFormat(mask) {
      const bits = formatBits(mask);
      function bit(i) { return (bits >>> i) & 1; }
      for (let i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6));
      setF(8, 8, bit(7));
      setF(7, 8, bit(8));
      for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, 1); // dark module
    }
    drawFormat(0); // reserve format modules before placing data

    // Final bit stream (codewords + remainder bits)
    const remainder = version === 1 ? 0 : 7;
    const stream = [];
    codewords.forEach(function (cw) {
      for (let i = 7; i >= 0; i--) stream.push((cw >>> i) & 1);
    });
    for (let i = 0; i < remainder; i++) stream.push(0);

    function maskBit(mask, r, c) {
      switch (mask) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
        case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
        default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      }
    }

    function placeData(mask, applyMask) {
      let bitIndex = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = ((right + 1) & 2) === 0;
            const y = upward ? size - 1 - vert : vert;
            if (isFunc[y][x]) continue;
            let bit = bitIndex < stream.length ? stream[bitIndex] : 0;
            bitIndex++;
            if (applyMask && maskBit(mask, y, x)) bit ^= 1;
            grid[y][x] = bit;
          }
        }
      }
    }

    function penalty(g) {
      let score = 0;
      // Runs of 5+ in rows and columns
      for (let r = 0; r < size; r++) {
        let run = 1;
        for (let c = 1; c <= size; c++) {
          if (c < size && g[r][c] === g[r][c - 1]) run++;
          else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
      }
      for (let c = 0; c < size; c++) {
        let run = 1;
        for (let r = 1; r <= size; r++) {
          if (r < size && g[r][c] === g[r - 1][c]) run++;
          else {
            if (run >= 5) score += run - 2;
            run = 1;
          }
        }
      }
      // 2x2 blocks
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
          const v = g[r][c];
          if (g[r][c + 1] === v && g[r + 1][c] === v && g[r + 1][c + 1] === v) {
            score += 3;
          }
        }
      }
      // Finder-like patterns with a 4-module quiet side
      const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      function scanLine(line) {
        for (let i = 0; i + 11 <= size; i++) {
          const win = line.slice(i, i + 11);
          if (win.join() === pat1.join() || win.join() === pat2.join()) score += 40;
        }
      }
      for (let r = 0; r < size; r++) scanLine(g[r]);
      for (let c = 0; c < size; c++) {
        scanLine(g.map(function (row) { return row[c]; }));
      }
      // Balance of dark modules
      let dark = 0;
      g.forEach(function (row) {
        row.forEach(function (v) { if (v) dark++; });
      });
      const percent = (dark * 100) / (size * size);
      const k = Math.max(0, Math.ceil(Math.abs(percent - 50) / 5) - 1);
      score += k * 10;
      return score;
    }

    // Try every mask on a copy, keep the lowest penalty, then commit.
    let bestMask = 0;
    let bestScore = Infinity;
    const baseGrid = grid.map(function (row) { return row.slice(); });
    for (let mask = 0; mask < 8; mask++) {
      for (let r = 0; r < size; r++) grid[r] = baseGrid[r].slice();
      placeData(mask, true);
      drawFormat(mask);
      const s = penalty(grid);
      if (s < bestScore) { bestScore = s; bestMask = mask; }
    }
    for (let r = 0; r < size; r++) grid[r] = baseGrid[r].slice();
    placeData(bestMask, true);
    drawFormat(bestMask);

    return { grid: grid, size: size, mask: bestMask };
  }

  /** Full pipeline: text → {version, size, grid, mask, byteLength}. */
  function encodeQr(text) {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const version = pickVersion(bytes.length);
    if (!version) return null;
    const data = buildDataCodewords(bytes, version);
    const all = interleaveWithEcc(data, version);
    const built = buildMatrix(all, version);
    return {
      version: version,
      size: built.size,
      grid: built.grid,
      mask: built.mask,
      byteLength: bytes.length,
      capacity: totalDataCodewords(version) - 2,
    };
  }

  function gridToSvg(grid, size, pixelSize) {
    const quiet = 4;
    const total = size + quiet * 2;
    let rects = "";
    for (let r = 0; r < size; r++) {
      let c = 0;
      while (c < size) {
        if (grid[r][c]) {
          let end = c;
          while (end < size && grid[r][end]) end++;
          rects +=
            '<rect x="' + (c + quiet) + '" y="' + (r + quiet) +
            '" width="' + (end - c) + '" height="1"/>';
          c = end;
        } else {
          c++;
        }
      }
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + pixelSize +
      '" height="' + pixelSize + '" viewBox="0 0 ' + total + " " + total +
      '"><rect width="' + total + '" height="' + total + '" fill="#ffffff"/>' +
      '<g fill="#000000">' + rects + "</g></svg>"
    );
  }

  DT.tools.qr = {
    id: "qr",
    name: "QR Code Generator",
    category: "Generators",
    icon: "qr",
    description: "Turn text or a link into a QR code. Fully offline.",

    keywords: "qr code generator scan link url text offline barcode",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const sizeSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-qr-size" }, [
        dom.el("option", { value: "256", text: "256 px" }),
        dom.el("option", { value: "384", text: "384 px" }),
        dom.el("option", { value: "512", text: "512 px" }),
      ]);
      sizeSel.style.width = "110px";

      const btnSvg = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Download SVG" });
      const btnPng = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Download PNG" });
      const btnClear = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });
      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Image size" }),
          sizeSel,
          btnSvg,
          btnPng,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-qr-input",
        rows: "3",
        spellcheck: "false",
        placeholder: "Text or a URL, e.g. https://example.com",
      });
      const inputStats = DT.ui.panel.stats();
      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Content", [DT.ui.panel.pasteBtn(input, function () { render(); })]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [
          inputStats,
          DT.ui.panel.hint("Max " + MAX_BYTES + " bytes at ECC level M"),
        ]),
      ]);

      const preview = dom.el("div", {
        id: "dt-qr-preview",
        style: {
          display: "flex",
          justifyContent: "center",
          padding: "18px",
        },
      });
      const meta = dom.el("div", { class: "dt-panel__stats", text: "" });
      const previewPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "QR code" }),
        ]),
        preview,
        dom.el("div", { class: "dt-panel__foot" }, [meta]),
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(previewPanel);
      container.appendChild(workspace);

      refs = { input, preview, meta, inputStats, sizeSel };

      let currentSvg = "";
      let currentText = "";

      function render() {
        DT.ui.panel.paintStats(inputStats, input.value);
        DT.ui.dom.clear(preview);
        currentSvg = "";
        currentText = input.value;
        if (!input.value) {
          meta.textContent = "";
          preview.appendChild(dom.el("div", {
            class: "dt-help",
            text: "Type something above and the code appears here.",
          }));
          return;
        }
        const result = encodeQr(input.value);
        if (!result) {
          meta.textContent = "";
          preview.appendChild(dom.el("div", { class: "dt-alert dt-alert--error" }, [
            dom.el("div", { style: { fontWeight: "600" }, text: "Content too long" }),
            dom.el("div", {
              text: "This generator covers up to " + MAX_BYTES + " bytes (version 6, level M). Your text is " +
                new TextEncoder().encode(input.value).length + " bytes.",
            }),
          ]));
          return;
        }
        currentSvg = gridToSvg(result.grid, result.size, parseInt(sizeSel.value, 10));
        const holder = dom.el("div", {});
        holder.innerHTML = currentSvg;
        preview.appendChild(holder);
        meta.textContent =
          "Version " + result.version + " · ECC M · " +
          result.byteLength + " / " + result.capacity + " bytes";
      }

      function download(name, blob) {
        const url = URL.createObjectURL(blob);
        const a = dom.el("a", { href: url, download: name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      }

      on(input, "input", DT.utils.debounce(render, 200));
      on(sizeSel, "change", render);
      on(btnSvg, "click", function () {
        if (!currentSvg) { DT.ui.toast.info("Generate a code first"); return; }
        download("qr.svg", new Blob([currentSvg], { type: "image/svg+xml" }));
      });
      on(btnPng, "click", function () {
        if (!currentSvg) { DT.ui.toast.info("Generate a code first"); return; }
        const px = parseInt(sizeSel.value, 10);
        const img = new Image();
        const svgUrl = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml" }));
        img.onload = function () {
          const canvas = document.createElement("canvas");
          canvas.width = px;
          canvas.height = px;
          canvas.getContext("2d").drawImage(img, 0, 0, px, px);
          URL.revokeObjectURL(svgUrl);
          if (canvas.toBlob) {
            canvas.toBlob(function (blob) {
              if (blob) download("qr.png", blob);
            }, "image/png");
          }
        };
        img.src = svgUrl;
      });
      on(btnClear, "click", function () {
        if (!input.value) { input.focus(); return; }
        const snap = input.value;
        input.value = "";
        render();
        input.focus();
        DT.ui.toast.undo("Cleared", function () {
          input.value = snap;
          render();
        });
      });

      DT.utils.persist.bind("qr", input, { onRestore: render });
      render();
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
