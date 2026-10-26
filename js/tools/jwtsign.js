/**
 * File: js/tools/jwtsign.js
 * Module: Tool — JWT Signer
 * Purpose: Create signed JSON Web Tokens locally (HS256, HS384,
 *          HS512) for testing APIs. The signing companion to the
 *          JWT Decoder.
 * Notes: Uses Web Crypto HMAC. The secret never leaves the tab and
 *        is never persisted (same rule as the decoder).
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

  function bytesToBase64Url(bytes) {
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function textToBase64Url(text) {
    return bytesToBase64Url(new TextEncoder().encode(text));
  }

  function base64UrlToBytes(text) {
    let b64 = String(text).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  const HASHES = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };

  DT.tools.jwtsign = {
    id: "jwtsign",
    name: "JWT Signer",
    category: "Security",
    icon: "key",
    description: "Sign JSON Web Tokens locally (HS256, HS384, HS512).",

    keywords: "jwt sign signer create token hmac hs256 bearer auth test",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const notice = dom.el("div", { class: "dt-notice" }, [
        dom.el("span", {
          class: "dt-notice__text",
          text: "For testing and development. Signing happens locally with Web Crypto; the secret is never saved or sent anywhere.",
        }),
      ]);

      const algSel = dom.el("select", { class: "dt-select dt-select--sm", id: "dt-jwtsign-alg" }, [
        dom.el("option", { value: "HS256", text: "HS256" }),
        dom.el("option", { value: "HS384", text: "HS384" }),
        dom.el("option", { value: "HS512", text: "HS512" }),
      ]);
      algSel.style.width = "110px";
      const secretB64 = dom.el("input", { type: "checkbox", id: "dt-jwtsign-secret-b64" });
      const btnSign = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Sign token" });
      const btnClear = dom.el("button", { type: "button", class: "dt-btn dt-btn--ghost dt-btn--sm", text: "Clear" });

      const toolbar = dom.el("div", { class: "dt-toolbar" }, [
        dom.el("div", { class: "dt-toolbar__group" }, [
          dom.el("span", { class: "dt-toolbar__label", text: "Algorithm" }),
          algSel,
          btnSign,
        ]),
        btnClear,
      ]);

      const headerInput = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jwtsign-header",
        rows: "3",
        spellcheck: "false",
      });
      headerInput.value = JSON.stringify({ alg: "HS256", typ: "JWT" }, null, 2);
      const headerPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [dom.el("div", { class: "dt-panel__title", text: "Header (JSON)" })]),
        dom.el("div", { class: "dt-panel__body" }, [headerInput]),
      ]);
      const headerError = DT.ui.panel.error(headerPanel);
      headerError.el.id = "dt-jwtsign-header-error";
      headerPanel.appendChild(headerError.el);

      const payloadInput = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jwtsign-payload",
        rows: "6",
        spellcheck: "false",
      });
      payloadInput.value = JSON.stringify(
        { sub: "1234567890", name: "John Doe", iat: 1516239022 },
        null,
        2,
      );
      const payloadPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        dom.el("div", { class: "dt-panel__head" }, [dom.el("div", { class: "dt-panel__title", text: "Payload (JSON)" })]),
        dom.el("div", { class: "dt-panel__body" }, [payloadInput]),
      ]);
      const payloadError = DT.ui.panel.error(payloadPanel);
      payloadError.el.id = "dt-jwtsign-payload-error";
      payloadPanel.appendChild(payloadError.el);

      const secretInput = dom.el("input", {
        type: "text",
        class: "dt-input dt-input--mono",
        id: "dt-jwtsign-secret",
        autocomplete: "off",
        spellcheck: "false",
        placeholder: "your-256-bit-secret",
        value: "your-256-bit-secret",
      });
      const secretRow = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [dom.el("div", { class: "dt-panel__title", text: "Secret" })]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [
          secretInput,
          dom.el("label", {
            class: "dt-help",
            style: { display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "8px", cursor: "pointer" },
          }, [secretB64, dom.el("span", { text: "Secret is base64url encoded" })]),
        ]),
      ]);

      const output = dom.el("textarea", {
        class: "dt-textarea",
        id: "dt-jwtsign-output",
        rows: "4",
        spellcheck: "false",
        readonly: "readonly",
        placeholder: "The signed token appears here…",
      });
      const btnCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy token" });
      const outputPanel = dom.el("div", { class: "dt-panel dt-panel--editor" }, [
        DT.ui.panel.head("Signed token", [DT.ui.panel.wrapBtn(output), btnCopy]),
        dom.el("div", { class: "dt-panel__body" }, [output]),
        dom.el("div", { class: "dt-panel__foot" }, [
          DT.ui.panel.hint("Tip: paste it into the JWT Decoder to inspect it."),
        ]),
      ]);

      workspace.appendChild(notice);
      workspace.appendChild(toolbar);
      workspace.appendChild(headerPanel);
      workspace.appendChild(payloadPanel);
      workspace.appendChild(secretRow);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = {
        algSel, headerInput, payloadInput, secretInput, secretB64, output,
        headerPanel, payloadPanel, headerError, payloadError,
      };

      function parseJsonField(input, box, label) {
        try {
          const value = JSON.parse(input.value);
          if (value === null || typeof value !== "object" || Array.isArray(value)) {
            throw new Error(label + " must be a JSON object");
          }
          box.clear();
          return value;
        } catch (e) {
          box.show(label, e.message);
          return null;
        }
      }

      async function sign() {
        const header = parseJsonField(headerInput, headerError, "Header");
        const payload = parseJsonField(payloadInput, payloadError, "Payload");
        if (!header || !payload) {
          DT.ui.toast.error("Fix the JSON errors first");
          return;
        }
        if (!secretInput.value) {
          DT.ui.toast.error("Enter a secret");
          secretInput.focus();
          return;
        }
        try {
          const secretBytes = secretB64.checked
            ? base64UrlToBytes(secretInput.value.trim())
            : new TextEncoder().encode(secretInput.value);
          const key = await crypto.subtle.importKey(
            "raw",
            secretBytes,
            { name: "HMAC", hash: HASHES[algSel.value] },
            false,
            ["sign"],
          );
          const signingInput =
            textToBase64Url(JSON.stringify(header)) + "." +
            textToBase64Url(JSON.stringify(payload));
          const sig = await crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(signingInput),
          );
          output.value = signingInput + "." + bytesToBase64Url(new Uint8Array(sig));
          DT.ui.toast.success("Token signed");
        } catch (e) {
          DT.ui.toast.error("Signing failed: " + e.message);
        }
      }

      // Keep the header's alg in step with the picker.
      on(algSel, "change", function () {
        try {
          const header = JSON.parse(headerInput.value);
          if (header && typeof header === "object") {
            header.alg = algSel.value;
            headerInput.value = JSON.stringify(header, null, 2);
          }
        } catch (e) {
          // Invalid header JSON: the signer will report it.
        }
        sign();
      });
      on(btnSign, "click", sign);
      on(btnCopy, "click", function () {
        if (!output.value) { DT.ui.toast.info("Sign a token first"); return; }
        DT.utils.clipboard.copy(output.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      });
      on(btnClear, "click", function () {
        output.value = "";
        DT.ui.toast.info("Output cleared");
      });
      on(payloadInput, "keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); sign(); }
      });

      sign();
      payloadInput.focus();
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
