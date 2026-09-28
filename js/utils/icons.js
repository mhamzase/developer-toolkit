/**
 * File: js/utils/icons.js
 * Module: Utils — Icons
 * Purpose: Inline SVG icon library. All icons are stroke-only (outline).
 * Style: Lucide/Feather — 24×24 viewBox, 2px stroke, round caps/joins.
 * Note: All SVGs are hardcoded strings. No user data.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  /* Inner path fragments for a 24×24 viewBox.
     Designed for stroke rendering — no filled shapes. */
  const LIB = {
    /* Curly braces { } */
    braces:
      '<path d="M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1"/>' +
      '<path d="M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1"/>',

    /* Shield (security) — open outline */
    shield:
      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',

    /* Code — < / > */
    code:
      '<polyline points="16 18 22 12 16 6"/>' +
      '<polyline points="8 6 2 12 8 18"/>',

    /* Link — two chain links */
    link:
      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
      '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',

    /* Hash # */
    hash:
      '<line x1="4" y1="9" x2="20" y2="9"/>' +
      '<line x1="4" y1="15" x2="20" y2="15"/>' +
      '<line x1="10" y1="3" x2="8" y2="21"/>' +
      '<line x1="16" y1="3" x2="14" y2="21"/>',

    /* Clock */
    clock:
      '<circle cx="12" cy="12" r="10"/>' +
      '<polyline points="12 6 12 12 16 14"/>',

    /* Type — capital T with serif marks (case converter) */
    type:
      '<polyline points="4 7 4 4 20 4 20 7"/>' +
      '<line x1="9" y1="20" x2="15" y2="20"/>' +
      '<line x1="12" y1="4" x2="12" y2="20"/>',

    /* Palette — outline with color dots */
    palette:
      '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>' +
      '<circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>' +
      '<circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>' +
      '<circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>' +
      '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',

    /* Key — outline key with round head */
    key:
      '<path d="m15.5 7.5 3 3L22 7l-3-3"/>' +
      '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/>' +
      '<circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',

    /* Text — left-aligned lines (text utilities) */
    text:
      '<line x1="21" y1="6"  x2="3" y2="6"/>' +
      '<line x1="15" y1="12" x2="3" y2="12"/>' +
      '<line x1="17" y1="18" x2="3" y2="18"/>',

    /* Calendar + Clock (timestamp) */
    calendarClock:
      '<path d="M8 2v4"/>' +
      '<path d="M16 2v4"/>' +
      '<rect x="3" y="4" width="18" height="18" rx="2"/>' +
      '<path d="M3 10h18"/>' +
      '<circle cx="16" cy="16" r="3.2"/>' +
      '<path d="M16 14.5V16l1.2 1.2"/>',

    /* Regex */
    regex:
      '<path d="M17 3v10"/>' +
      '<path d="m12.67 5.5 8.66 5"/>' +
      '<path d="m12.67 10.5 8.66-5"/>' +
      '<path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z"/>',

    /* Diff — split view with + and − */
    diff:
      '<path d="M8 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h2"/>' +
      '<path d="M16 3h2a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-2"/>' +
      '<path d="M12 3v18"/>' +
      '<path d="M10 9h4"/>' +
      '<path d="M10 15h4"/>',

    /* Lock — padlock (password generator) */
    lock:
      '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
      '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>' +
      '<circle cx="12" cy="16" r="1" fill="currentColor"/>',

    /* Lorem — paragraph lines with a leading letter */
    lorem:
      '<path d="M4 6h4"/>' +
      '<path d="M12 6h8"/>' +
      '<path d="M4 12h10"/>' +
      '<path d="M18 12h2"/>' +
      '<path d="M4 18h6"/>' +
      '<path d="M14 18h6"/>',

    /* HTTP — globe with a horizontal line (world / network) */
    http:
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M3 12h18"/>' +
      '<path d="M12 3a13 13 0 0 1 0 18"/>' +
      '<path d="M12 3a13 13 0 0 0 0 18"/>',

    /* Cron — clock with circular arrow (recurring) */
    cron:
      '<circle cx="12" cy="12" r="9"/>' +
      '<polyline points="12 7 12 12 15 14"/>' +
      '<path d="M5.5 5.5 3 8"/>' +
      '<path d="M3 3v5h5"/>',
  };

  /**
   * Wrap inner SVG content in a stroke-only SVG element.
   * @param {string} inner
   * @returns {string}
   */
  function wrapSvg(inner) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon" ' +
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" focusable="false">' +
      inner +
      "</svg>"
    );
  }

  DT.utils.icons = {
    /**
     * Get an <svg> DOM node for the named icon.
     * @param {string} name
     * @returns {SVGElement|null}
     */
    get: function (name) {
      const inner = LIB[name] || LIB.code;
      return DT.ui.dom.svg(wrapSvg(inner));
    },
  };
})();
