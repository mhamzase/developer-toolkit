/**
 * File: js/core/storage.js
 * Module: Core — Storage
 * Purpose: Promise wrapper around chrome.storage.local.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  DT.core.storage = {
    /**
     * Get a stored value.
     * @param {string} key
     * @param {*} fallback
     * @returns {Promise<*>}
     */
    get: function (key, fallback) {
      return new Promise(function (resolve) {
        try {
          chrome.storage.local.get(key, function (data) {
            if (chrome.runtime && chrome.runtime.lastError) { resolve(fallback); return; }
            resolve(data && key in data ? data[key] : fallback);
          });
        } catch (e) {
          resolve(fallback);
        }
      });
    },

    /**
     * Set a stored value.
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    set: function (key, value) {
      return new Promise(function (resolve) {
        const payload = {};
        payload[key] = value;
        try {
          chrome.storage.local.set(payload, function () { resolve(); });
        } catch (e) {
          resolve();
        }
      });
    },

    /**
     * Remove a stored key.
     * @param {string} key
     * @returns {Promise<void>}
     */
    remove: function (key) {
      return new Promise(function (resolve) {
        try {
          chrome.storage.local.remove(key, function () { resolve(); });
        } catch (e) {
          resolve();
        }
      });
    }
  };
})();