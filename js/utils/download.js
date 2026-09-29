/**
 * File: js/utils/download.js
 * Module: Utils — Download
 * Purpose: Trigger file downloads from extension context.
 * Notes: Uses Blob + object URL. No permissions needed.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  function pad(n) { return String(n).padStart(2, '0'); }

  DT.utils.download = {
    /**
     * Trigger a text download.
     * @param {string} content
     * @param {string} filename
     * @param {string} [mime]
     * @returns {boolean} — false if content was empty
     */
    text: function (content, filename, mime) {
      if (content == null || content === '') return false;

      const blob = new Blob([content], {
        type: mime || 'text/plain;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download.txt';
      a.rel = 'noopener';
      a.style.display = 'none';

      document.body.appendChild(a);
      a.click();

      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);

      return true;
    },

    /**
     * Build a filename with a timestamp suffix.
     * Example: withTimestamp('json', 'json') → "json-20260929-143022.json"
     */
    withTimestamp: function (baseName, ext) {
      const d = new Date();
      const stamp =
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) + '-' +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds());
      return (baseName || 'download') + '-' + stamp + '.' + (ext || 'txt');
    }
  };
})();