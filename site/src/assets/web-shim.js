/**
 * File: site/src/assets/web-shim.js
 * Purpose: Browser compatibility shim for the Zase website.
 *
 * The extension tools were written against a small slice of the
 * Chrome extension APIs (chrome.storage.local, chrome.runtime).
 * This shim provides that exact slice on top of localStorage, so
 * the unmodified extension scripts run on the open web.
 *
 * Load order: this file MUST load before any extension script.
 *
 * Build note: site/build.mjs replaces __ZASE_MANIFEST_NAME__ and
 * __ZASE_MANIFEST_VERSION__ with the real values from manifest.json
 * when it copies this file into site/dist/.
 */
(function () {
  "use strict";

  /* Every shimmed value lives under this localStorage prefix so the
   * site's own keys (theme choice, etc.) can never collide with the
   * keys the extension code uses (dt:theme, dt:input:..., ...). */
  var PREFIX = "zase:store:";

  function readRaw(key) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      return raw === null ? undefined : JSON.parse(raw);
    } catch (e) {
      return undefined;
    }
  }

  function writeRaw(key, value) {
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      /* Storage full or blocked (private mode): fail silently,
       * exactly like the extension wrapper does on errors. */
    }
  }

  function removeRaw(key) {
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch (e) {
      /* ignore */
    }
  }

  function allKeys() {
    var out = [];
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
      }
    } catch (e) {
      /* ignore */
    }
    return out;
  }

  /* Callbacks in the real chrome.storage API are always async. */
  function later(cb, arg) {
    if (typeof cb === "function") {
      window.setTimeout(function () {
        cb(arg);
      }, 0);
    }
  }

  var local = {
    /**
     * Mirrors chrome.storage.local.get:
     * keys may be null/undefined (all items), a string, an array of
     * strings, or an object of key:defaultValue pairs.
     */
    get: function (keys, cb) {
      var out = {};
      if (keys === null || keys === undefined) {
        allKeys().forEach(function (k) {
          out[k] = readRaw(k);
        });
      } else if (typeof keys === "string") {
        var v = readRaw(keys);
        if (v !== undefined) out[keys] = v;
      } else if (Array.isArray(keys)) {
        keys.forEach(function (k) {
          var val = readRaw(k);
          if (val !== undefined) out[k] = val;
        });
      } else if (typeof keys === "object") {
        Object.keys(keys).forEach(function (k) {
          var val = readRaw(k);
          out[k] = val !== undefined ? val : keys[k];
        });
      }
      later(cb, out);
    },

    /** Mirrors chrome.storage.local.set(object, callback). */
    set: function (items, cb) {
      if (items && typeof items === "object") {
        Object.keys(items).forEach(function (k) {
          writeRaw(k, items[k]);
        });
      }
      later(cb);
    },

    /** Mirrors chrome.storage.local.remove(string|array, callback). */
    remove: function (keys, cb) {
      var list = Array.isArray(keys) ? keys : [keys];
      list.forEach(removeRaw);
      later(cb);
    },

    /** Mirrors chrome.storage.local.clear(callback). */
    clear: function (cb) {
      allKeys().forEach(removeRaw);
      later(cb);
    },
  };

  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: local,
    /* Tools never subscribe to storage changes on the web; the
     * extension shell does, and it is not part of the website.
     * A no-op keeps any stray listener registration harmless. */
    onChanged: {
      addListener: function () {},
      removeListener: function () {},
    },
  };
  window.chrome.runtime = {
    /* js/core/storage.js checks chrome.runtime.lastError after
     * every call; null keeps those checks on the happy path. */
    lastError: null,
    getManifest: function () {
      return {
        name: "__ZASE_MANIFEST_NAME__",
        version: "__ZASE_MANIFEST_VERSION__",
      };
    },
  };
})();
