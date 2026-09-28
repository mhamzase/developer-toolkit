/**
 * File: js/utils/persist.js
 * Module: Utils — Persist
 * Purpose: Save/restore textarea/input values per tool.
 * Notes:
 *   - Skips tools marked `sensitive: true`.
 *   - Honors the global `persistInput` setting.
 *   - Debounced save, flushed on window close.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  const PREFIX = 'dt:input:';
  const timers = {};   // key → timeout
  const pending = {};  // key → value

  function keyFor(toolId, slot) {
    return PREFIX + toolId + (slot ? ':' + slot : '');
  }

  function flush(key) {
    if (!(key in pending)) return;
    const value = pending[key];
    delete pending[key];
    delete timers[key];
    DT.core.storage.set(key, value);
  }

  /* Flush pending saves when the window is about to close */
  window.addEventListener('beforeunload', function () {
    Object.keys(pending).forEach(flush);
  });

  DT.utils.persist = {
    /**
     * Bind persistence to a textarea/input.
     * @param {string} toolId
     * @param {HTMLElement} el
     * @param {{slot?:string, onRestore?:function(string):void, delay?:number}} [opts]
     */
    bind: function (toolId, el, opts) {
      if (!el) return;
      opts = opts || {};

      // Respect global setting
      if (DT.core.session.get('persistInput') === false) return;

      // Skip tools flagged as sensitive
      const tool = DT.core.registry.get(toolId);
      if (tool && tool.sensitive) return;

      const key = keyFor(toolId, opts.slot);
      const delay = typeof opts.delay === 'number' ? opts.delay : 250;

      // Restore
      DT.core.storage.get(key, '').then(function (saved) {
        if (saved && typeof saved === 'string') {
          el.value = saved;
          if (typeof opts.onRestore === 'function') {
            try { opts.onRestore(saved); } catch (e) { console.error(e); }
          }
        }
      });

      // Save (debounced)
      el.addEventListener('input', function () {
        pending[key] = el.value;
        if (timers[key]) clearTimeout(timers[key]);
        timers[key] = setTimeout(function () { flush(key); }, delay);
      });
    },

    /** Clear one tool's saved input. */
    clearTool: function (toolId) {
      return new Promise(function (resolve) {
        chrome.storage.local.get(null, function (all) {
          const prefix = PREFIX + toolId;
          const toRemove = Object.keys(all || {}).filter(function (k) {
            return k.indexOf(prefix) === 0;
          });
          if (!toRemove.length) return resolve();
          chrome.storage.local.remove(toRemove, function () { resolve(); });
        });
      });
    },

    /** Clear all tool inputs. */
    clearAll: function () {
      return new Promise(function (resolve) {
        chrome.storage.local.get(null, function (all) {
          const toRemove = Object.keys(all || {}).filter(function (k) {
            return k.indexOf(PREFIX) === 0;
          });
          if (!toRemove.length) return resolve();
          chrome.storage.local.remove(toRemove, function () { resolve(); });
        });
      });
    }
  };
})();