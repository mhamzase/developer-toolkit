/**
 * File: js/utils/escape.js
 * Module: Utils — Escape
 * Purpose: Escape HTML special characters when string building is unavoidable.
 * Note: Prefer textContent/DOM APIs over this. Use only as a safety net.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  DT.utils.escape = {
    html: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };
})();