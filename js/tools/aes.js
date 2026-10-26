/**
 * File: js/tools/aes.js
 * Module: Tool — AES Encrypt / Decrypt
 * Purpose: Password-based AES-256-GCM encryption for text, entirely
 *          in the browser. The key is derived with PBKDF2
 *          (SHA-256, 210000 iterations, random salt per message).
 * Format: One copy-friendly Base64 string: salt (16) + iv (12) +
 *         ciphertext. Decryption reads the same format, so anything
 *         encrypted here can be decrypted here later.
 * Notes: Passwords and plaintext are never persisted or sent.
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

  const ITERATIONS = 210000;
  const SALT_LEN = 16;
  const IV_LEN = 12;

  function bytesToBase64(bytes) {
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: salt, iterations: ITERATIONS, hash: "SHA-256" },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async function encryptText(plain, password) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveKey(password, salt);
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      new TextEncoder().encode(plain),
    );
    const all = new Uint8Array(SALT_LEN + IV_LEN + cipher.byteLength);
    all.set(salt, 0);
    all.set(iv, SALT_LEN);
    all.set(new Uint8Array(cipher), SALT_LEN + IV_LEN);
    return bytesToBase64(all);
  }

  async function decryptText(blob, password) {
    const all = base64ToBytes(blob);
    if (all.length <= SALT_LEN + IV_LEN) {
      throw new Error("That does not look like an encrypted message from this tool.");
    }
    const salt = all.subarray(0, SALT_LEN);
    const iv = all.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const data = all.subarray(SALT_LEN + IV_LEN);
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, data);
    return new TextDecoder().decode(plain);
  }

  DT.tools.aes = {
    id: "aes",
    name: "AES Encrypt / Decrypt",
    category: "Security",
    icon: "lock",
    description: "Encrypt text with a password (AES-256-GCM), decrypt it back.",

    keywords: "aes encrypt decrypt cipher password gcm pbkdf2 secret text crypto",
    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el("div", { class: "dt-workspace" });

      const notice = dom.el("div", { class: "dt-notice" }, [
        dom.el("span", {
          class: "dt-notice__text",
          text: "AES-256-GCM with a PBKDF2 key (210k rounds) and a fresh random salt per message. Nothing is saved or sent anywhere.",
        }),
      ]);

      function passwordField(id, placeholder) {
        return dom.el("input", {
          type: "password",
          class: "dt-input dt-input--mono",
          id: id,
          autocomplete: "new-password",
          spellcheck: "false",
          placeholder: placeholder,
        });
      }
      function areaField(id, rows, placeholder, readonly) {
        const attrs = {
          class: "dt-textarea",
          id: id,
          rows: String(rows),
          spellcheck: "false",
          placeholder: placeholder,
        };
        if (readonly) attrs.readonly = "readonly";
        return dom.el("textarea", attrs);
      }

      /* Encrypt side */
      const encPass = passwordField("dt-aes-enc-pass", "Password for encryption");
      const encIn = areaField("dt-aes-enc-in", 4, "Text to encrypt…");
      const encOut = areaField("dt-aes-enc-out", 4, "Encrypted Base64 appears here…", true);
      const btnEncrypt = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Encrypt" });
      const btnEncCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const encPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [dom.el("div", { class: "dt-panel__title", text: "Encrypt" })]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [
          dom.el("div", { style: { marginBottom: "10px" } }, [encPass]),
          encIn,
          dom.el("div", { style: { display: "flex", gap: "8px", margin: "10px 0" } }, [btnEncrypt, btnEncCopy]),
          encOut,
        ]),
      ]);

      /* Decrypt side */
      const decPass = passwordField("dt-aes-dec-pass", "Password for decryption");
      const decIn = areaField("dt-aes-dec-in", 4, "Paste the encrypted Base64 here…");
      const decOut = areaField("dt-aes-dec-out", 4, "Decrypted text appears here…", true);
      const btnDecrypt = dom.el("button", { type: "button", class: "dt-btn dt-btn--primary dt-btn--sm", text: "Decrypt" });
      const btnDecCopy = dom.el("button", { type: "button", class: "dt-btn dt-btn--secondary dt-btn--sm", text: "Copy" });
      const decPanel = dom.el("div", { class: "dt-panel" }, [
        dom.el("div", { class: "dt-panel__head" }, [dom.el("div", { class: "dt-panel__title", text: "Decrypt" })]),
        dom.el("div", { class: "dt-panel__body", style: { padding: "12px 16px" } }, [
          dom.el("div", { style: { marginBottom: "10px" } }, [decPass]),
          decIn,
          dom.el("div", { style: { display: "flex", gap: "8px", margin: "10px 0" } }, [btnDecrypt, btnDecCopy]),
          decOut,
        ]),
      ]);

      workspace.appendChild(notice);
      workspace.appendChild(encPanel);
      workspace.appendChild(decPanel);
      container.appendChild(workspace);

      refs = { encPass, encIn, encOut, decPass, decIn, decOut };

      function copyFrom(field) {
        if (!field.value) { DT.ui.toast.info("Nothing to copy"); return; }
        DT.utils.clipboard.copy(field.value)
          .then(() => DT.ui.toast.success("Copied"))
          .catch(() => DT.ui.toast.error("Copy failed"));
      }

      on(btnEncrypt, "click", async function () {
        if (!encIn.value) { DT.ui.toast.info("Type the text to encrypt"); encIn.focus(); return; }
        if (!encPass.value) { DT.ui.toast.error("Enter a password"); encPass.focus(); return; }
        try {
          encOut.value = await encryptText(encIn.value, encPass.value);
          DT.ui.toast.success("Encrypted");
        } catch (e) {
          DT.ui.toast.error("Encryption failed: " + e.message);
        }
      });
      on(btnDecrypt, "click", async function () {
        if (!decIn.value.trim()) { DT.ui.toast.info("Paste the encrypted text"); decIn.focus(); return; }
        if (!decPass.value) { DT.ui.toast.error("Enter the password"); decPass.focus(); return; }
        try {
          decOut.value = await decryptText(decIn.value.trim(), decPass.value);
          DT.ui.toast.success("Decrypted");
        } catch (e) {
          decOut.value = "";
          DT.ui.toast.error("Decryption failed. Wrong password, or the text is not from this tool.");
        }
      });
      on(btnEncCopy, "click", function () { copyFrom(encOut); });
      on(btnDecCopy, "click", function () { copyFrom(decOut); });

      encIn.focus();
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
