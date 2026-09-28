/**
 * File: js/core/theme.js
 * Module: Core — Theme
 * Purpose: Light/Dark theme engine. Persists to chrome.storage.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  const KEY = 'dt:theme';

  DT.core.theme = {
    key: KEY,
    current: 'light',

    /** Read saved theme (or system preference) and apply it. */
    init: function () {
      const self = this;
      return DT.core.storage.get(KEY, null).then(function (saved) {
        let theme = saved;
        if (theme !== 'light' && theme !== 'dark') {
          theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
            ? 'dark'
            : 'light';
        }
        self.apply(theme);
      });
    },

    /** Apply a theme without persisting. */
    apply: function (theme) {
      this.current = theme;
      document.documentElement.setAttribute('data-theme', theme);
    },

    /** Apply and persist. */
    set: function (theme) {
      this.apply(theme);
      DT.core.storage.set(KEY, theme);
    },

    /** Switch between light and dark. */
    toggle: function () {
      this.set(this.current === 'light' ? 'dark' : 'light');
    }
  };
})();