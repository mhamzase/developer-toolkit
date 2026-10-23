/**
 * File: js/core/theme.js
 * Module: Core — Theme
 * Purpose: Theme engine with three modes: light, dark, system.
 * Notes:
 *   - The stored value is the MODE ('light' | 'dark' | 'system').
 *   - `current` is always the APPLIED theme ('light' | 'dark').
 *   - Older installs stored 'light'/'dark' directly, which maps
 *     cleanly onto the explicit modes, so no migration is needed.
 *   - In system mode the app follows prefers-color-scheme live.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  const KEY = 'dt:theme';
  const listeners = [];

  function systemTheme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';
  }

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(DT.core.theme.current, DT.core.theme.mode); } catch (e) { console.error('[DT theme]', e); }
    });
  }

  DT.core.theme = {
    key: KEY,
    current: 'light',
    mode: 'system',

    /** Read the saved mode (default: system) and apply it. */
    init: function () {
      const self = this;
      return DT.core.storage.get(KEY, null).then(function (saved) {
        self.mode = (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
        self.apply(self.mode === 'system' ? systemTheme() : self.mode);

        /* Follow the OS while in system mode */
        if (window.matchMedia) {
          const mq = window.matchMedia('(prefers-color-scheme: dark)');
          const onChange = function () {
            if (self.mode === 'system') self.apply(systemTheme());
          };
          if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
          else if (typeof mq.addListener === 'function') mq.addListener(onChange);
        }
      });
    },

    /** Apply a resolved theme without persisting anything. */
    apply: function (theme) {
      this.current = theme;
      document.documentElement.setAttribute('data-theme', theme);
      emit();
    },

    /** Set an explicit theme ('light' | 'dark'). Kept for existing callers. */
    set: function (theme) {
      this.setMode(theme);
    },

    /** Set and persist the mode: 'light' | 'dark' | 'system'. */
    setMode: function (mode) {
      if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = 'system';
      this.mode = mode;
      DT.core.storage.set(KEY, mode);
      this.apply(mode === 'system' ? systemTheme() : mode);
    },

    /** The active mode: 'light' | 'dark' | 'system'. */
    getMode: function () {
      return this.mode;
    },

    /** Switch between explicit light and dark. */
    toggle: function () {
      this.setMode(this.current === 'light' ? 'dark' : 'light');
    },

    /** Subscribe to applied-theme changes: fn(current, mode). */
    on: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };
})();
