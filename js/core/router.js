/**
 * File: js/core/router.js
 * Module: Core — Router
 * Purpose: Tiny state machine for view switching + filter/query state.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  const listeners = [];

  DT.core.router = {
    state: {
      view: 'list',   // 'list' | 'tool'
      toolId: null,
      filter: 'All',
      query: ''
    },

    /** Subscribe to state changes. */
    on: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
    },

    /** Emit current state. */
    emit: function () {
      const state = DT.core.router.state;
      listeners.forEach(function (fn) {
        try { fn(state); } catch (e) { console.error('[DT router]', e); }
      });
    },

    /**
     * Navigate.
     * @param {'list'|'tool'} view
     * @param {{toolId?:string, filter?:string, query?:string}} [opts]
     */
    go: function (view, opts) {
      opts = opts || {};
      this.state.view = view;
      if ('toolId' in opts) this.state.toolId = opts.toolId;
      if ('filter' in opts) this.state.filter = opts.filter;
      if ('query'  in opts) this.state.query  = opts.query;
      if (view === 'list') this.state.toolId = null;
      this.emit();
    },

    setFilter: function (filter) {
      this.state.filter = filter;
      if (this.state.view !== 'list') { this.state.view = 'list'; this.state.toolId = null; }
      this.emit();
    },

    setQuery: function (q) {
      this.state.query = q;
      if (this.state.view !== 'list') { this.state.view = 'list'; this.state.toolId = null; }
      this.emit();
    }
  };
})();