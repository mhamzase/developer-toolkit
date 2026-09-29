/**
 * File: js/tools/jwt.js
 * Module: Tool — JWT Decoder
 * Purpose: Decode JWT header and payload locally. Does NOT verify signature.
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

  function b64urlToUtf8(input) {
    let s = String(input || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    while (s.length % 4 !== 0) s += "=";
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    try {
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    } catch (e) {
      let out = "";
      for (let i = 0; i < bytes.length; i++)
        out += String.fromCharCode(bytes[i]);
      return out;
    }
  }

  function prettySegment(raw) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch (e) {
      return raw;
    }
  }

  function humanTime(sec) {
    if (typeof sec !== "number" || !isFinite(sec)) return "—";
    const d = new Date(sec * 1000);
    return d
      .toISOString()
      .replace("T", " ")
      .replace(/\.\d+Z$/, " UTC");
  }

  function relTime(sec) {
    const now = Math.floor(Date.now() / 1000);
    let diff = sec - now;
    const past = diff < 0;
    diff = Math.abs(diff);
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    const parts = [];
    if (days) parts.push(days + "d");
    if (hours) parts.push(hours + "h");
    if (minutes) parts.push(minutes + "m");
    if (!days && !hours) parts.push(seconds + "s");
    return (past ? "" : "in ") + parts.join(" ") + (past ? " ago" : "");
  }

  function buildClaimsInfo(payload) {
    const rows = [];
    if (!payload || typeof payload !== "object") return rows;
    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.iat === "number") {
      rows.push({
        key: "Issued at",
        value: humanTime(payload.iat) + "  (" + relTime(payload.iat) + ")",
      });
    }
    if (typeof payload.nbf === "number") {
      const ok = now >= payload.nbf;
      rows.push({
        key: "Not before",
        value: humanTime(payload.nbf) + "  (" + relTime(payload.nbf) + ")",
        tone: ok ? null : "warning",
        note: ok ? null : "Token not yet valid",
      });
    }
    if (typeof payload.exp === "number") {
      const expired = now >= payload.exp;
      rows.push({
        key: "Expires at",
        value: humanTime(payload.exp) + "  (" + relTime(payload.exp) + ")",
        tone: expired ? "danger" : "success",
        note: expired ? "Token expired" : "Token valid",
      });
    }
    return rows;
  }

  function decode(raw) {
    const token = String(raw || "").trim();
    if (!token) return { ok: false, error: "Input is empty." };
    const parts = token.split(".");
    if (parts.length !== 3)
      return {
        ok: false,
        error:
          "A JWT must have exactly 3 parts separated by dots. Found " +
          parts.length +
          ".",
      };

    let headerRaw, payloadRaw;
    try {
      headerRaw = b64urlToUtf8(parts[0]);
      payloadRaw = b64urlToUtf8(parts[1]);
    } catch (e) {
      return { ok: false, error: "Header or payload is not valid base64url." };
    }

    let header, payload;
    try {
      header = JSON.parse(headerRaw);
    } catch (e) {
      return { ok: false, error: "Header is not valid JSON." };
    }
    try {
      payload = JSON.parse(payloadRaw);
    } catch (e) {
      return { ok: false, error: "Payload is not valid JSON." };
    }

    return {
      ok: true,
      header,
      payload,
      signature: parts[2],
      headerRaw,
      payloadRaw,
    };
  }

  function sectionPanel(title, content, badge, copyValue) {
    const dom = DT.ui.dom;
    const code = dom.el("pre", { class: "dt-code", text: content });
    const btnCopy = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--ghost dt-btn--sm",
      text: "Copy",
    });
    btnCopy.addEventListener("click", () => {
      DT.utils.clipboard
        .copy(copyValue || content)
        .then(() => DT.ui.toast.success(title + " copied"))
        .catch(() => DT.ui.toast.error("Copy failed"));
    });

    const headKids = [dom.el("div", { class: "dt-panel__title", text: title })];
    if (badge) headKids.push(badge);

    return dom.el("div", { class: "dt-panel" }, [
      dom.el("div", { class: "dt-panel__head" }, [
        dom.el("div", { class: "dt-toolbar__group" }, headKids),
        dom.el("div", { class: "dt-panel__actions" }, [btnCopy]),
      ]),
      dom.el("div", { class: "dt-panel__body" }, [code]),
    ]);
  }

  function renderClaims(payload) {
    const dom = DT.ui.dom;
    const rows = buildClaimsInfo(payload);
    if (rows.length === 0) return null;

    const body = dom.el("div", { class: "dt-panel__body" });
    rows.forEach((r) => {
      const toneClass = r.tone ? " dt-badge--" + r.tone : "";
      const badge = dom.el("span", {
        class: "dt-badge" + toneClass,
        text: r.key,
      });
      const value = dom.el("div", { class: "dt-help", text: r.value });
      body.appendChild(
        dom.el(
          "div",
          {
            class: "dt-row",
            style: { gap: "8px", padding: "6px 14px", alignItems: "baseline" },
          },
          [badge, value],
        ),
      );
      if (r.note) {
        body.appendChild(
          dom.el("div", {
            class: "dt-help",
            style: { marginLeft: "22px", padding: "0 14px 6px" },
            text: r.note,
          }),
        );
      }
    });

    return dom.el("div", { class: "dt-panel" }, [
      dom.el("div", { class: "dt-panel__head" }, [
        dom.el("div", { class: "dt-panel__title", text: "Claims" }),
      ]),
      body,
    ]);
  }

  function clearResults() {
    DT.ui.dom.clear(refs.resultSlot);
  }

  function showError(message) {
    const dom = DT.ui.dom;
    dom.clear(refs.resultSlot);
    refs.resultSlot.appendChild(
      dom.el("div", { class: "dt-alert dt-alert--error" }, [
        dom.el("div", { style: { fontWeight: "600" }, text: "Cannot decode" }),
        dom.el("div", { text: message }),
      ]),
    );
  }

  function decodeNow() {
    const result = decode(refs.input.value);
    if (!result.ok) {
      showError(result.error);
      DT.ui.toast.error("Invalid JWT");
      return;
    }

    clearResults();
    const dom = DT.ui.dom;

    refs.resultSlot.appendChild(
      sectionPanel("Header", prettySegment(result.headerRaw)),
    );

    let payloadBadge = null;
    const exp =
      result.payload && typeof result.payload.exp === "number"
        ? result.payload.exp
        : null;
    if (exp != null) {
      const now = Math.floor(Date.now() / 1000);
      const expired = now >= exp;
      payloadBadge = dom.el("span", {
        class:
          "dt-badge " + (expired ? "dt-badge--danger" : "dt-badge--success"),
        text: expired ? "Expired" : "Valid",
      });
    }
    refs.resultSlot.appendChild(
      sectionPanel("Payload", prettySegment(result.payloadRaw), payloadBadge),
    );

    const claims = renderClaims(result.payload);
    if (claims) refs.resultSlot.appendChild(claims);

    const sigText =
      result.signature +
      "\n\nNote: The signature is NOT verified by this tool.\nDecoding is done locally in your browser.";
    refs.resultSlot.appendChild(
      sectionPanel("Signature", sigText, null, result.signature),
    );

    DT.ui.toast.success("Decoded");
  }

  function clearAll() {
    const snap = { input: refs.input.value };
    if (!snap.input) {
      refs.input.focus();
      return;
    }

    refs.input.value = "";
    clearResults();
    refs.input.focus();

    DT.ui.toast.undo("Cleared", function () {
      refs.input.value = snap.input;
      decodeNow();
    });
  }

  function copyInput() {
    const v = refs.input.value.trim();
    if (!v) {
      DT.ui.toast.info("Nothing to copy");
      return;
    }
    DT.utils.clipboard
      .copy(v)
      .then(() => DT.ui.toast.success("Copied"))
      .catch(() => DT.ui.toast.error("Copy failed"));
  }

  function pasteExample() {
    refs.input.value =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
      "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    decodeNow();
  }

  DT.tools.jwt = {
    id: "jwt",
    name: "JWT Decoder",
    category: "Security",
    icon: "shield",
    description: "Decode JWT header and payload locally.",

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const notice = dom.el("div", { class: "dt-alert dt-alert--info" }, [
        dom.el("div", {
          style: { fontWeight: "600" },
          text: "Local decode only",
        }),
        dom.el("div", {
          text: "Your token is never sent anywhere. The signature is NOT verified.",
        }),
      ]);

      const btnDecode = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--primary dt-btn--sm",
        text: "Decode",
      });
      const btnCopy = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--secondary dt-btn--sm",
        text: "Copy token",
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
          if (!refs || !refs.resultSlot) return "";
          const decoded = decode(refs.input.value);
          if (!decoded.ok) return "";
          return JSON.stringify(
            {
              header: decoded.header,
              payload: decoded.payload,
              signature: decoded.signature,
            },
            null,
            2,
          );
        },
        filename: () => DT.utils.download.withTimestamp("jwt", "json"),
        mime: "application/json;charset=utf-8",
        label: "Download",
        emptyMsg: "Decode a token first",
      });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          btnDecode,
          btnCopy,
          btnSample,
          btnDownload,
        ]),
        btnClear,
      ]);

      const input = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jwt-input",
        rows: "4",
        spellcheck: "false",
        placeholder: "Paste JWT here…  (Ctrl+Enter to decode)",
      });
      input.style.whiteSpace = "pre-wrap";
      input.style.wordBreak = "break-all";

      const inputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [
          dom.el("div", { class: "dt-panel__title", text: "Token" }),
        ]),
        dom.el("div", { class: "dt-panel__body" }, [input]),
      ]);

      const resultSlot = dom.el("div", {
        class: "dt-stack",
        id: "dt-jwt-result",
        style: { display: "flex", flexDirection: "column", gap: "16px" },
      });

      workspace.appendChild(notice);
      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(resultSlot);
      container.appendChild(workspace);

      refs = { input, resultSlot };

      on(btnDecode, "click", decodeNow);
      on(btnCopy, "click", copyInput);
      on(btnSample, "click", pasteExample);
      on(btnClear, "click", clearAll);
      on(input, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          decodeNow();
        }
      });

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
