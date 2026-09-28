/**
 * File: js/utils/debounce.js
 * Module: Utils — Debounce
 * Purpose: Delay repeated function calls (used for search input).
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  DT.utils.debounce = function (fn, wait) {
    let timer = null;
    return function () {
      const ctx = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait || 150);
    };
  };
})();