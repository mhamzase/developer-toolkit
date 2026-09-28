/**
 * File: js/core/registry.js
 * Module: Core — Registry
 * Purpose: Read tool metadata from window.DT.tools (self-registered).
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};
  DT.tools = DT.tools || {};

  DT.core.registry = {
    /** Return all registered tools, sorted by name. */
    all: function () {
      const out = [];
      Object.keys(DT.tools).forEach(function (k) {
        const t = DT.tools[k];
        if (t && t.id && typeof t.mount === 'function') out.push(t);
      });
      out.sort(function (a, b) { return a.name.localeCompare(b.name); });
      return out;
    },

    /** Get a tool by id. */
    get: function (id) {
      return DT.tools[id] || null;
    },

    /** Return unique category list, prefixed with "All". */
    categories: function () {
      const seen = { All: true };
      const list = ['All'];
      Object.keys(DT.tools).forEach(function (k) {
        const c = DT.tools[k] && DT.tools[k].category;
        if (c && !seen[c]) { seen[c] = true; list.push(c); }
      });
      return list;
    },

    /**
     * Filter tools by category and search query.
     * @param {{filter?:string, query?:string}} opts
     */
    filter: function (opts) {
      opts = opts || {};
      let list = this.all();

      if (opts.filter && opts.filter !== 'All') {
        list = list.filter(function (t) { return t.category === opts.filter; });
      }
      if (opts.query) {
        const q = String(opts.query).toLowerCase();
        list = list.filter(function (t) {
          return (
            (t.name && t.name.toLowerCase().indexOf(q) !== -1) ||
            (t.description && t.description.toLowerCase().indexOf(q) !== -1)
          );
        });
      }
      return list;
    }
  };
})();