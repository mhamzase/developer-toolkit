/**
 * File: site/src/assets/site.js
 * Purpose: Small site-wide behaviours for the Zase website:
 *   - Dark/light toggle in the header (the initial theme is set by
 *     an inline script in <head> before first paint; this file only
 *     wires the button and persists the choice).
 *   - Live search filtering on the home page tool grid.
 *
 * Theme contract: <html data-theme="light|dark"> drives every color
 * token in css/themes.css, exactly like the extension. The stored
 * choice lives in localStorage under "zase:theme". With no stored
 * choice the site follows prefers-color-scheme.
 */
(function () {
  "use strict";

  var THEME_KEY = "zase:theme";

  /* ---------------- Theme toggle ---------------- */

  function storedTheme() {
    try {
      var v = window.localStorage.getItem(THEME_KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) {
      return null;
    }
  }

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = document.getElementById("z-theme-toggle");
    if (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
      );
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }
  }

  function initThemeToggle() {
    var btn = document.getElementById("z-theme-toggle");
    if (!btn) return;
    applyTheme(
      document.documentElement.getAttribute("data-theme") || systemTheme()
    );
    btn.addEventListener("click", function () {
      var next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* Private mode: theme still flips for this page view. */
      }
      applyTheme(next);
    });

    /* Follow the OS live while the visitor has not chosen a theme. */
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (!storedTheme()) applyTheme(systemTheme());
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(onChange);
      }
    }
  }

  /* ---------------- Home search filter ---------------- */

  function initSearch() {
    var input = document.getElementById("z-search");
    if (!input) return;
    var cards = Array.prototype.slice.call(
      document.querySelectorAll(".z-card[data-search]")
    );
    var sections = Array.prototype.slice.call(
      document.querySelectorAll("[data-category-section]")
    );
    var empty = document.getElementById("z-no-results");

    function apply() {
      var q = input.value.trim().toLowerCase();
      var visible = 0;
      cards.forEach(function (card) {
        var hit = !q || card.getAttribute("data-search").indexOf(q) !== -1;
        card.style.display = hit ? "" : "none";
        if (hit) visible++;
      });
      sections.forEach(function (section) {
        var any = Array.prototype.some.call(
          section.querySelectorAll(".z-card[data-search]"),
          function (c) {
            return c.style.display !== "none";
          }
        );
        section.style.display = any ? "" : "none";
      });
      if (empty) empty.style.display = visible ? "none" : "";
    }

    input.addEventListener("input", apply);
  }

  function init() {
    initThemeToggle();
    initSearch();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
