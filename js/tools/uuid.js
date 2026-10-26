/**
 * File: js/tools/uuid.js
 * Module: Tool — UUID Generator
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

  function uuidV4() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [];
    for (let i = 0; i < 16; i++)
      hex.push((bytes[i] + 0x100).toString(16).slice(1));
    return (
      hex[0] +
      hex[1] +
      hex[2] +
      hex[3] +
      "-" +
      hex[4] +
      hex[5] +
      "-" +
      hex[6] +
      hex[7] +
      "-" +
      hex[8] +
      hex[9] +
      "-" +
      hex[10] +
      hex[11] +
      hex[12] +
      hex[13] +
      hex[14] +
      hex[15]
    );
  }

/* ------------------------------------------------------------
   * Phase 2B: more id types
   * ------------------------------------------------------------ */
  function bytesToUuid(bytes) {
    const hex = [];
    for (let i = 0; i < 16; i++)
      hex.push((bytes[i] + 0x100).toString(16).slice(1));
    return (
      hex[0] + hex[1] + hex[2] + hex[3] + "-" +
      hex[4] + hex[5] + "-" +
      hex[6] + hex[7] + "-" +
      hex[8] + hex[9] + "-" +
      hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
    );
  }

  /** UUID v7: 48-bit millisecond timestamp + random, sorts by time. */
  function uuidV7() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let ms = Date.now();
    for (let i = 5; i >= 0; i--) {
      bytes[i] = ms % 256;
      ms = Math.floor(ms / 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return bytesToUuid(bytes);
  }

  const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  /** ULID: 48-bit timestamp + 80-bit random, Crockford Base32. */
  function ulid() {
    let ms = Date.now();
    let time = "";
    for (let i = 0; i < 10; i++) {
      time = ULID_ALPHABET[ms % 32] + time;
      ms = Math.floor(ms / 32);
    }
    const rb = new Uint8Array(10);
    crypto.getRandomValues(rb);
    let rand = "", bits = 0, val = 0;
    for (let i = 0; i < rb.length; i++) {
      val = (val << 8) | rb[i];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        rand += ULID_ALPHABET[(val >> bits) & 31];
        val &= (1 << bits) - 1;
      }
    }
    return time + rand;
  }

  const NANO_ALPHABET =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  /** Nano ID: 21 chars; the 64-char alphabet divides 256 evenly. */
  function nanoId() {
    const bytes = new Uint8Array(21);
    crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < 21; i++) out += NANO_ALPHABET[bytes[i] & 63];
    return out;
  }

  function generateOne() {
    const type = refs && refs.type ? refs.type.value : "v4";
    if (type === "v7") return uuidV7();
    if (type === "ulid") return ulid();
    if (type === "nanoid") return nanoId();
    return uuidV4();
  }

  /* ------------------------------------------------------------
   * Parse / validate
   * ------------------------------------------------------------ */
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-([0-9a-f])[0-9a-f]{3}-([89ab])[0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;

  function parseId(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    const um = UUID_RE.exec(s);
    if (um) {
      const version = parseInt(um[1], 16);
      const info = { kind: "UUID", version: version, valid: true };
      if (version === 7) {
        info.timestamp = new Date(parseInt(s.replace(/-/g, "").slice(0, 12), 16));
      }
      info.canonical = s.toLowerCase();
      return info;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      return { kind: "UUID-shaped", valid: false, note: "Version or variant bits are not valid for a standard UUID." };
    }
    if (ULID_RE.test(s) && s[0].toUpperCase() <= "7") {
      const upper = s.toUpperCase();
      let ms = 0;
      for (let i = 0; i < 10; i++) ms = ms * 32 + ULID_ALPHABET.indexOf(upper[i]);
      return { kind: "ULID", valid: true, timestamp: new Date(ms), canonical: upper };
    }
    if (/^[A-Za-z0-9_-]{21}$/.test(s)) {
      return { kind: "Nano ID (likely)", valid: true, note: "Any 21 characters from the Nano ID alphabet qualify, so this cannot be verified further." };
    }
    return { kind: "Unknown", valid: false, note: "Not a valid UUID, ULID or Nano ID." };
  }

  function renderParse() {
    const dom = DT.ui.dom;
    const slot = refs.parseResult;
    DT.ui.dom.clear(slot);
    const info = parseId(refs.parseInput.value);
    if (!info) return;
    function row(label, value) {
      return dom.el("div", { class: "dt-result__row" }, [
        dom.el("span", { class: "dt-result__label", text: label }),
        dom.el("span", { class: "dt-result__value", text: value }),
      ]);
    }
    const card = dom.el("div", { class: "dt-result" }, [
      row("Type", info.kind + (info.version ? " v" + info.version : "")),
      row("Valid", info.valid ? "Yes" : "No"),
    ]);
    if (info.timestamp) card.appendChild(row("Created", info.timestamp.toISOString() + " (" + info.timestamp.toLocaleString() + ")"));
    if (info.canonical) card.appendChild(row("Canonical", info.canonical));
    if (info.note) card.appendChild(row("Note", info.note));
    slot.appendChild(card);
  }

  function generateMany(n) {
    const out = [];
    const seen = Object.create(null);
    let guard = 0;
    while (out.length < n && guard < n * 4) {
      guard++;
      const id = generateOne();
      if (!seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    return out;
  }

  function clearList() {
    DT.ui.dom.clear(refs.listSlot);
  }

  function emptyState() {
    const dom = DT.ui.dom;
    return dom.el("div", { class: "dt-empty" }, [
      dom.el("div", { class: "dt-empty__title", text: "No IDs yet" }),
      dom.el("div", {
        class: "dt-empty__text",
        text: "Click Generate to create one.",
      }),
    ]);
  }

  function renderList(ids) {
    const dom = DT.ui.dom;
    clearList();

    const wrap = dom.el("div", { class: "dt-uuid-list" });
    ids.forEach((id, index) => {
      const code = dom.el("code", { class: "dt-uuid-row__value", text: id });
      const btn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm",
        "aria-label": "Copy UUID",
        title: "Copy",
      });
      const icon = dom.svg(
        '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      );
      if (icon) btn.appendChild(icon);
      btn.addEventListener("click", () => {
        DT.utils.clipboard
          .copy(id)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      const row = dom.el("div", { class: "dt-uuid-row" }, [
        dom.el("span", {
          class: "dt-uuid-row__index",
          text: String(index + 1),
        }),
        code,
        btn,
      ]);
      wrap.appendChild(row);
    });
    refs.listSlot.appendChild(wrap);
    if (refs.listStats) {
      refs.listStats.textContent = ids.length + " ID" + (ids.length === 1 ? "" : "s");
    }
  }

  function parseCount() {
    const raw = parseInt(refs.count.value, 10);
    if (isNaN(raw) || raw < 1) return 1;
    if (raw > 500) return 500;
    return raw;
  }

  function generateNow() {
    const n = parseCount();
    const ids = generateMany(n);
    refs.currentIds = ids;
    renderList(ids);
    DT.ui.toast.success(
      "Generated " + ids.length + " ID" + (ids.length === 1 ? "" : "s"),
    );
  }

  function copyAll() {
    if (!refs.currentIds || !refs.currentIds.length) {
      DT.ui.toast.info("Nothing to copy");
      return;
    }
    DT.utils.clipboard
      .copy(refs.currentIds.join("\n"))
      .then(() =>
        DT.ui.toast.success("Copied " + refs.currentIds.length + " IDs"),
      )
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  function clearAll() {
    const snap = (refs.currentIds || []).slice();
    if (!snap.length) return;

    refs.currentIds = [];
    clearList();
    refs.listSlot.appendChild(emptyState());
    if (refs.listStats) refs.listStats.textContent = "0 IDs";

    DT.ui.toast.undo(
      "Cleared " + snap.length + " ID" + (snap.length === 1 ? "" : "s"),
      function () {
        refs.currentIds = snap;
        renderList(snap);
      },
    );
  }
  DT.tools.uuid = {
    id: "uuid",
    name: "UUID & ID Generator",
    category: "Generators",
    icon: "hash",
    description: "Generate UUID v4/v7, ULID and Nano ID values. Validate any ID.",

    keywords: "guid generate v4 v7 ulid nanoid random id unique identifier bulk validate parse",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const countLabel = dom.el("span", {
        class: "dt-toolbar__label",
        text: "Count",
      });
      const count = dom.el("input", {
        type: "number",
        class: "dt-input",
        id: "dt-uuid-count",
        min: "1",
        max: "500",
        value: "1",
        inputmode: "numeric",
      });
      count.style.width = "90px";

      const btnGen = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Generate",
      });
      const btnCopyAll = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy all",
      });
      const btnClear = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--sm",
        text: "Clear",
      });

      const btnDownload = DT.ui.dlButton({
        getText: () =>
          refs && refs.currentIds ? refs.currentIds.join("\n") : "",
        filename: () => DT.utils.download.withTimestamp("ids", "txt"),
        mime: "text/plain;charset=utf-8",
        label: "Download",
        emptyMsg: "Generate IDs first",
      });

      const typeLabel = dom.el("span", {
        class: "dt-toolbar__label",
        text: "Type",
      });
      const type = dom.el(
        "select",
        { class: "dt-select dt-select--sm", id: "dt-uuid-type" },
        [
          dom.el("option", { value: "v4", text: "UUID v4" }),
          dom.el("option", { value: "v7", text: "UUID v7" }),
          dom.el("option", { value: "ulid", text: "ULID" }),
          dom.el("option", { value: "nanoid", text: "Nano ID" }),
        ],
      );
      type.style.width = "120px";

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          typeLabel,
          type,
          countLabel,
          count,
          btnGen,
        ]),
        btnClear,
      ]);

      const hint = dom.el("div", {
        class: "dt-help",
        text: "Generated locally with crypto.getRandomValues. v7 and ULID sort by creation time. Max 500 per batch.",
      });

      const listSlot = dom.el("div", {
        id: "dt-uuid-list",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "12px 16px",
        },
      });
      listSlot.appendChild(emptyState());

      const listStats = DT.ui.panel.stats();
      listStats.textContent = "0 IDs";
      const listPanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("IDs", [btnCopyAll, btnDownload]),
        listSlot,
        dom.el("div", { class: "dt-panel__foot" }, [listStats]),
      ]);

      /* --- Parse / validate panel --- */
      const parseInput = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-uuid-parse",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "Paste a UUID, ULID or Nano ID to check it…",
      });
      const parseResult = dom.el("div", {
        id: "dt-uuid-parse-result",
        style: { padding: "0 16px 12px" },
      });
      const parsePanel = dom.el("div", { class: "dt-panel" }, [
        DT.ui.panel.head("Parse / validate", [DT.ui.panel.pasteBtn(parseInput, function () { renderParse(); })]),
        dom.el("div", {
          class: "dt-panel__body",
          style: { padding: "12px 16px", display: "flex", flexDirection: "column", gap: "12px" },
        }, [parseInput, parseResult]),
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(hint);
      workspace.appendChild(listPanel);
      workspace.appendChild(parsePanel);
      container.appendChild(workspace);

      refs = { count, type, listSlot, listStats, parseInput, parseResult, currentIds: [] };

      on(btnGen, "click", generateNow);
      on(parseInput, "input", renderParse);
      on(btnCopyAll, "click", copyAll);
      on(btnClear, "click", clearAll);
      on(count, "keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          generateNow();
        }
      });

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
