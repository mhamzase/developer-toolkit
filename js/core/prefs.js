/**
 * File: js/core/prefs.js
 * Module: Core — Preferences
 * Purpose: Favorites + recently-used tools. Persists to chrome.storage.
 * Notes: Subscribers are notified on any change.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  const FAV_KEY = 'dt:favorites';
  const REC_KEY = 'dt:recents';
  const REC_MAX = 5;

  let favorites = [];
  let recents   = [];
  const listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(); } catch (e) { console.error('[DT prefs]', e); }
    });
  }

  DT.core.prefs = {
    /* ---------------- Lifecycle ---------------- */

    /** Load from storage. Call once at app init. */
    load: function () {
      return Promise.all([
        DT.core.storage.get(FAV_KEY, []),
        DT.core.storage.get(REC_KEY, [])
      ]).then(function (results) {
        favorites = Array.isArray(results[0]) ? results[0] : [];
        recents   = Array.isArray(results[1]) ? results[1] : [];
        emit();
      });
    },

    /* ---------------- Favorites ---------------- */

    isFavorite: function (id) {
      return favorites.indexOf(id) !== -1;
    },

    getFavorites: function () {
      return favorites.slice();
    },

    /** Toggle, persist, emit. Returns true if now favorited. */
    toggleFavorite: function (id) {
      const i = favorites.indexOf(id);
      if (i === -1) favorites.push(id);
      else favorites.splice(i, 1);
      DT.core.storage.set(FAV_KEY, favorites);
      emit();
      return i === -1;
    },

    /* ---------------- Recently used ---------------- */

    getRecents: function () {
      return recents.slice();
    },

    /** Push to front, dedupe, cap at REC_MAX. Persist, emit. */
    recordRecent: function (id) {
      const i = recents.indexOf(id);
      if (i !== -1) recents.splice(i, 1);
      recents.unshift(id);
      if (recents.length > REC_MAX) recents.length = REC_MAX;
      DT.core.storage.set(REC_KEY, recents);
      emit();
    },

    /* ---------------- Subscribe ---------------- */

    on: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    }
  };
})();