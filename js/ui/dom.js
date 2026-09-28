/**
 * File: js/ui/dom.js
 * Module: UI — DOM helpers
 * Purpose: Small, safe DOM creation + querying utilities.
 * Rule: Never uses innerHTML for user content.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  DT.ui.dom = {
    /**
     * Create an element.
     * @param {string} tag
     * @param {Object} [attrs] - class, text, dataset, style, on*, any HTML attr
     * @param {Array|Node|string} [children]
     * @returns {HTMLElement}
     */
    el: function (tag, attrs, children) {
      const node = document.createElement(tag);

      if (attrs) {
        Object.keys(attrs).forEach(function (key) {
          const val = attrs[key];
          if (val == null || val === false) return;

          if (key === 'class') {
            node.className = val;
          } else if (key === 'text') {
            node.textContent = val;
          } else if (key === 'dataset' && typeof val === 'object') {
            Object.keys(val).forEach(function (k) { node.dataset[k] = val[k]; });
          } else if (key === 'style' && typeof val === 'object') {
            Object.keys(val).forEach(function (k) { node.style[k] = val[k]; });
          } else if (key.indexOf('on') === 0 && typeof val === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), val);
          } else {
            node.setAttribute(key, val);
          }
        });
      }

      if (children) {
        (Array.isArray(children) ? children : [children]).forEach(function (child) {
          if (child == null || child === false) return;
          node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
      }

      return node;
    },

    /** Create a text node. */
    txt: function (t) {
      return document.createTextNode(String(t == null ? '' : t));
    },

    /** Remove all children of a node. */
    clear: function (node) {
      while (node && node.firstChild) node.removeChild(node.firstChild);
    },

    /** querySelector shorthand. */
    qs: function (sel, root) {
      return (root || document).querySelector(sel);
    },

    /** querySelectorAll shorthand → Array. */
    qsa: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },

    /**
     * Parse a trusted SVG string into a DOM node.
     * @param {string} str
     * @returns {SVGElement|null}
     */
    svg: function (str) {
      const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
      if (!doc || doc.querySelector('parsererror')) return null;
      return document.importNode(doc.documentElement, true);
    }
  };
})();