/**
 * File: popup/popup.js
 * Module: Popup Bootstrap
 * Purpose: Kick off the app once the DOM is ready.
 * Depends on: window.DT.core.app
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.DT || !window.DT.core || !window.DT.core.app) {
      console.error('[DT] App core not loaded.');
      return;
    }
    window.DT.core.app.init();
  });
})();