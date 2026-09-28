/**
 * File: js/core/session.js
 * Module: Core — Session
 * Purpose: Remember last tool + user settings with version-based migration.
 * Notes:
 *   - SETTINGS_VERSION bumps when DEFAULTS change → forces a reset once.
 *   - Settings persist to chrome.storage.local.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  const LAST_TOOL_KEY = 'dt:lastTool';
  const SETTINGS_KEY  = 'dt:settings';

  /* Bump this number whenever DEFAULTS changes so users get new defaults. */
  const SETTINGS_VERSION = 2;

  const DEFAULTS = {
    rememberLastTool: true,
    persistInput: false
  };

  let settings = Object.assign({}, DEFAULTS, { _v: SETTINGS_VERSION });
  let lastTool = null;
  const listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[DT session]', e); }
    });
  }

  DT.core.session = {
    /* ---------------- Load ---------------- */

    load: function () {
      return Promise.all([
        DT.core.storage.get(LAST_TOOL_KEY, null),
        DT.core.storage.get(SETTINGS_KEY, null)
      ]).then(function (r) {
        lastTool = r[0] || null;

        const saved = r[1];

        if (!saved || saved._v !== SETTINGS_VERSION) {
          // Fresh install OR version bump → use new defaults
          settings = Object.assign({}, DEFAULTS, { _v: SETTINGS_VERSION });
          DT.core.storage.set(SETTINGS_KEY, settings);
        } else {
          // Same version → merge saved over defaults (saved wins)
          settings = Object.assign({}, DEFAULTS, saved);
        }
      });
    },

    /* ---------------- Settings ---------------- */

    getSettings: function () {
      const copy = Object.assign({}, settings);
      delete copy._v;
      return copy;
    },

    get: function (key) {
      return settings[key];
    },

    set: function (key, value) {
      settings[key] = value;
      settings._v = SETTINGS_VERSION;
      DT.core.storage.set(SETTINGS_KEY, settings);
      emit();
    },

    /* ---------------- Last tool ---------------- */

    getLastTool: function () { return lastTool; },

    setLastTool: function (id) {
      lastTool = id;
      DT.core.storage.set(LAST_TOOL_KEY, id);
    },

    clearLastTool: function () {
      lastTool = null;
      DT.core.storage.remove(LAST_TOOL_KEY);
    },

    /* ---------------- Wipe ---------------- */

    /** Clear all app data AND reset settings to defaults. */
    clearAllSaved: function () {
      return DT.utils.persist.clearAll().then(function () {
        return Promise.all([
          DT.core.storage.remove(LAST_TOOL_KEY),
          DT.core.storage.remove('dt:recents'),
          DT.core.storage.remove('dt:favorites'),
          DT.core.storage.remove('dt:colors'),
          DT.core.storage.remove(SETTINGS_KEY)
        ]);
      }).then(function () {
        settings = Object.assign({}, DEFAULTS, { _v: SETTINGS_VERSION });
        lastTool = null;
        emit();
      });
    },

    /* ---------------- Subscribe ---------------- */

    on: function (fn) { if (typeof fn === 'function') listeners.push(fn); }
  };
})();