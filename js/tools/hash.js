/**
 * File: js/tools/hash.js
 * Module: Tool — Hash Generator
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];
  let hashToken = 0;

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }

  function bytesToHex(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i++)
      out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }
  function bytesToBase64(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  /* ------------------------------------------------------------
   * MD5 (RFC 1321), implemented in pure JS because Web Crypto
   * does not offer it. SHA-1 and the SHA-2 family come from
   * crypto.subtle. MD5 is for checksums and legacy comparisons,
   * never for new security work.
   * ------------------------------------------------------------ */
  const MD5_S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  function md5K(i) {
    return Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);
  }
  function md5Bytes(input) {
    const bitLen = input.length * 8;
    const padZeros = (56 - ((input.length + 1) % 64) + 64) % 64;
    const total = input.length + 1 + padZeros + 8;
    const msg = new Uint8Array(total);
    msg.set(input);
    msg[input.length] = 0x80;
    const view = new DataView(msg.buffer);
    view.setUint32(total - 8, bitLen >>> 0, true);
    view.setUint32(total - 4, Math.floor(bitLen / 4294967296), true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < total; off += 64) {
      for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let f, g;
        if (i < 16) { f = (B & C) | (~B & D); g = i; }
        else if (i < 32) { f = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { f = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { f = C ^ (B | ~D); g = (7 * i) % 16; }
        f = (f + A + md5K(i) + M[g]) >>> 0;
        A = D; D = C; C = B;
        const rot = ((f << MD5_S[i]) | (f >>> (32 - MD5_S[i]))) >>> 0;
        B = (B + rot) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0;
      c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const ov = new DataView(out.buffer);
    ov.setUint32(0, a0, true); ov.setUint32(4, b0, true);
    ov.setUint32(8, c0, true); ov.setUint32(12, d0, true);
    return out;
  }
  function concatBytes(a, b) {
    const out = new Uint8Array(a.length + b.length);
    out.set(a); out.set(b, a.length);
    return out;
  }
  function hmacMd5(key, msgBytes) {
    const BLOCK = 64;
    let k = key;
    if (k.length > BLOCK) k = md5Bytes(k);
    const ipad = new Uint8Array(BLOCK).fill(0x36);
    const opad = new Uint8Array(BLOCK).fill(0x5c);
    for (let i = 0; i < k.length; i++) { ipad[i] ^= k[i]; opad[i] ^= k[i]; }
    return md5Bytes(concatBytes(opad, md5Bytes(concatBytes(ipad, msgBytes))));
  }

  /**
   * One digest entry point for text, files and HMAC.
   * @param {string} algo  MD5 | SHA-1 | SHA-256 | SHA-384 | SHA-512
   * @param {Uint8Array} bytes
   * @param {Uint8Array|null} keyBytes  non-null means HMAC
   * @returns {Promise<Uint8Array>}
   */
  function digestBytes(algo, bytes, keyBytes) {
    if (keyBytes) {
      if (algo === "MD5") return Promise.resolve(hmacMd5(keyBytes, bytes));
      return crypto.subtle
        .importKey("raw", keyBytes, { name: "HMAC", hash: algo }, false, ["sign"])
        .then((key) => crypto.subtle.sign("HMAC", key, bytes))
        .then((sig) => new Uint8Array(sig));
    }
    if (algo === "MD5") return Promise.resolve(md5Bytes(bytes));
    return crypto.subtle.digest(algo, bytes).then((buf) => new Uint8Array(buf));
  }
  function digest(algo, text) {
    const data = new TextEncoder().encode(String(text));
    return digestBytes(algo, data, hmacKeyBytes());
  }
  function hmacKeyBytes() {
    if (!refs || !refs.hmacKey) return null;
    const key = refs.hmacKey.value;
    return key ? new TextEncoder().encode(key) : null;
  }
  function format(bytes) {
    return refs.format.value === "base64"
      ? bytesToBase64(bytes)
      : bytesToHex(bytes);
  }

  function paintStats(text) {
    if (!refs) return;
    const bytes = text ? new TextEncoder().encode(text).length : 0;
    refs.inputStats.textContent =
      (text ? text.length : 0) + " chars · " + bytes + " bytes";
  }

  function clearOutput() {
    refs.output.value = "";
    refs.outputStats.textContent = "0 chars";
    refs.meta.textContent = "";
  }

  function compute() {
    if (!refs) return;
    const raw = refs.input.value;
    if (!raw) {
      clearOutput();
      return;
    }
    const algo = refs.algo.value;
    const token = ++hashToken;
    digest(algo, raw)
      .then((bytes) => {
        if (!refs || token !== hashToken) return;
        const out = format(bytes);
        refs.output.value = out;
        refs.outputStats.textContent = out.length + " chars";
        refs.meta.textContent =
          (hmacKeyBytes() ? "HMAC-" : "") +
          algo +
          " · " +
          (refs.format.value === "base64" ? "base64" : "hex");
      })
      .catch((e) => {
        if (!refs || token !== hashToken) return;
        refs.output.value = "";
        refs.outputStats.textContent = "0 chars";
        refs.meta.textContent = "error";
        DT.ui.toast.error("Hash failed");
      });
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
    const snap = {
      input: refs.input.value,
      output: refs.output.value,
      meta: refs.meta.textContent,
    };
    if (!snap.input && !snap.output) {
      refs.input.focus();
      return;
    }

    refs.input.value = "";
    clearOutput();
    paintStats("");
    refs.input.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.input.value = snap.input;
      refs.output.value = snap.output;
      refs.meta.textContent = snap.meta;
      paintStats(snap.input);
    });
  }
  DT.tools.hash = {
    id: "hash",
    name: "Hash Generator",
    category: "Security",
    icon: "key",
    description: "MD5, SHA-1, SHA-2 hashes + HMAC, for text and files.",

    keywords: "sha sha1 sha256 sha384 sha512 md5 hmac digest checksum crypto fingerprint",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const notice = dom.el("div", { class: "dt-alert dt-alert--info" }, [
        dom.el("div", { style: { fontWeight: "600" }, text: "Local hashing" }),
        dom.el("div", {
          text: "Your input never leaves the browser. SHA runs on Web Crypto; MD5 runs on a built-in implementation (checksums and legacy use, not security). Add an HMAC key below to sign instead of plain hashing.",
        }),
      ]);

      const algo = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-hash-algo" },
        [
          dom.el("option", { value: "MD5", text: "MD5" }),
          dom.el("option", { value: "SHA-1", text: "SHA-1" }),
          dom.el("option", { value: "SHA-256", text: "SHA-256" }),
          dom.el("option", { value: "SHA-384", text: "SHA-384" }),
          dom.el("option", { value: "SHA-512", text: "SHA-512" }),
        ],
      );
      algo.style.width = "120px";

      const format = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-hash-format" },
        [
          dom.el("option", { value: "hex", text: "Hex" }),
          dom.el("option", { value: "base64", text: "Base64" }),
        ],
      );
      format.style.width = "110px";

      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Algorithm" }),
          algo,
          dom.el("span", { class: "dt-toolbar__label", text: "Format" }),
          format,
        ]),
        btnClear,
      ]);

      /* HMAC key row: an empty key means a plain hash. */
      const hmacKey = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-hash-hmac-key",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "HMAC key (optional). Leave empty for a plain hash.",
      });
      const hmacRow = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", {
          class: "dt-toolbar__group",
          style: { flex: "1 1 auto" },
        }, [
          dom.el("span", { class: "dt-toolbar__label", text: "HMAC key" }),
          hmacKey,
        ]),
      ]);
      hmacKey.style.flex = "1 1 auto";

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-hash-input",
        rows: "6",
        spellcheck: "false",
        placeholder: "Type or paste text…  (Ctrl+Enter to hash now)",
      });
      input.style.whiteSpace = "pre-wrap";
      input.style.fontFamily = "var(--font-sans)";
      input.style.fontSize = "var(--fs-sm)";

      const inputStats = dom.el("div", {
        class: "dt-panel__stats",
        text: "0 chars · 0 bytes",
      });

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Input", [
          DT.ui.panel.pasteBtn(input, function () {
            paintStats(input.value);
          }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
        dom.el("div", { class: "dt-panel__foot" }, [
          inputStats,
          DT.ui.panel.hint("Hashes as you type"),
        ]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-hash-output",
        rows: "3",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "Hash appears here…",
      });
      output.style.whiteSpace = "pre-wrap";
      output.style.wordBreak = "break-all";
      output.style.fontFamily = "var(--font-mono)";
      output.style.fontSize = "var(--fs-xs)";

      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });
      const btnDownload = DT.ui.dlButton({
        getText: () => (refs && refs.output ? refs.output.value : ""),
        filename: () => DT.utils.download.withTimestamp("hash", "txt"),
        mime: "text/plain;charset=utf-8",
        label: "Download",
      });
      const outputStats = dom.el("div", { class: "dt-panel__stats", text: "0 chars" });
      const meta = dom.el("div", { class: "dt-panel__stats", text: "" });

      const outputPanel = dom.el(
        "div",
        { class: "dt-panel dt-panel--editor" },
        [
          dom.el("div", { class: "dt-panel__head" }, [
            dom.el("div", { class: "dt-panel__title", text: "Hash" }),
            dom.el("div", { class: "dt-panel__actions" }, [
              btnCopy,
              btnDownload,
            ]),
          ]),
          dom.el("div", { class: "dt-panel__body" }, [output]),
          dom.el("div", { class: "dt-panel__foot" }, [outputStats, meta]),
        ],
      );

      /* --- File hash panel (shared file component) --- */
      const fileHashOut = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-hash-file-output",
        rows: "2",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "The file's hash appears here…",
      });
      fileHashOut.style.whiteSpace = "pre-wrap";
      fileHashOut.style.wordBreak = "break-all";
      fileHashOut.style.fontFamily = "var(--font-mono)";
      fileHashOut.style.fontSize = "var(--fs-xs)";
      const fileMeta = dom.el("div", {
        class: "dt-panel__stats",
        text: "No file chosen",
      });
      const btnFileHashCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy",
      });

      const fileState = { file: null };
      function computeFileHash() {
        const file = fileState.file;
        if (!file) return;
        file
          .arrayBuffer()
          .then(function (buf) {
            return digestBytes(refs.algo.value, new Uint8Array(buf), hmacKeyBytes());
          })
          .then(function (bytes) {
            // Note: the module-level format() helper is shadowed inside
            // mount() by the format <select>, so pick the encoder here.
            fileHashOut.value =
              refs.format.value === "base64"
                ? bytesToBase64(bytes)
                : bytesToHex(bytes);
            fileMeta.textContent =
              file.name +
              " · " +
              DT.ui.fileDrop.formatSize(file.size) +
              " · " +
              (hmacKeyBytes() ? "HMAC-" : "") +
              refs.algo.value;
          })
          .catch(function () {
            DT.ui.toast.error("Could not hash that file");
          });
      }
      const hashDrop = DT.ui.fileDrop({
        label: "Drop any file here, or click to browse (max 50 MB)",
        maxBytes: 50 * 1024 * 1024,
        onFile: function (file) {
          fileState.file = file;
          computeFileHash();
        },
      });
      const hashDropWrap = dom.el(
        "div",
        { style: { padding: "12px 16px" } },
        [hashDrop.el],
      );
      const filePanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("File hash", [btnFileHashCopy]),
        dom.el("div", { class: "dt-panel__body" }, [hashDropWrap, fileHashOut]),
        dom.el("div", { class: "dt-panel__foot" }, [
          fileMeta,
          DT.ui.panel.hint("Uses the Algorithm, Format and HMAC key above"),
        ]),
      ]);
      on(btnFileHashCopy, "click", function () {
        if (!fileHashOut.value) {
          DT.ui.toast.info("Choose a file first");
          return;
        }
        DT.utils.clipboard
          .copy(fileHashOut.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      on(algo, "change", computeFileHash);
      on(format, "change", computeFileHash);

      workspace.appendChild(notice);
      workspace.appendChild(toolbar);
      workspace.appendChild(hmacRow);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      workspace.appendChild(filePanel);
      container.appendChild(workspace);

      refs = { input, output, algo, format, hmacKey, inputStats, outputStats, meta };

      const computeDebounced = DT.utils.debounce(compute, 180);
      on(input, "input", () => {
        paintStats(input.value);
        computeDebounced();
      });
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          compute();
        }
      });
      on(algo, "change", compute);
      on(format, "change", compute);
      on(hmacKey, "input", computeDebounced);
      on(hmacKey, "change", computeFileHash);
      on(btnCopy, "click", copyOutput);
      on(btnClear, "click", clearAll);

      paintStats("");
      input.focus();
    },

    unmount() {
      while (listeners.length) {
        const entry = listeners.pop();
        entry[0].removeEventListener(entry[1], entry[2]);
      }
      refs = null;
      hashToken = 0;
    },
  };
})();
