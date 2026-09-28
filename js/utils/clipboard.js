/**
 * File: js/utils/clipboard.js
 * Module: Utils — Clipboard
 * Purpose: Copy text to clipboard with a safe fallback.
 * Returns: Promise<void>
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  DT.utils.clipboard = {
    /**
     * Copy a string to the clipboard.
     * @param {string} text
     * @returns {Promise<void>}
     */
    copy: function (text) {
      const value = String(text == null ? '' : text);

      // Preferred: async Clipboard API (extension popups support this)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(value);
      }

      // Fallback: temporary hidden textarea + execCommand
      return new Promise(function (resolve, reject) {
        try {
          const ta = document.createElement('textarea');
          ta.value = value;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-1000px';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('execCommand failed'));
        } catch (e) {
          reject(e);
        }
      });
    }
  };
})();