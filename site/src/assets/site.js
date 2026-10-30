/**
 * File: site/src/assets/site.js
 * Purpose: Site-wide behaviours for the Zase website:
 *   - Dark/light toggle in the header (the initial theme is set by
 *     an inline script in <head> before first paint; this file only
 *     wires the button and persists the choice).
 *   - Mobile menu: the hamburger toggles the nav panel.
 *   - Home search filtering on the tool grid.
 *   - Scroll reveal: elements with .z-reveal fade in once when they
 *     enter the viewport. The hidden state is applied by CSS only
 *     under <html class="z-js">, and this file adds .z-reveal--in;
 *     with no IntersectionObserver everything is simply shown.
 *   - Pointer tilt on tool cards (fine pointers only, and never
 *     when the visitor prefers reduced motion).
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

  /* ---------------- Mobile menu ---------------- */

  function initMenu() {
    var btn = document.getElementById("z-menu-toggle");
    var nav = document.getElementById("z-nav");
    if (!btn || !nav) return;
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("z-nav--open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    /* Tapping a link closes the panel again. */
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("z-nav--open");
        btn.setAttribute("aria-expanded", "false");
        btn.setAttribute("aria-label", "Open menu");
      }
    });
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

  /* ---------------- Scroll reveal ---------------- */

  function initReveal() {
    var items = document.querySelectorAll(".z-reveal");
    if (!items.length) return;
    /* No observer support: leave everything visible. */
    if (typeof window.IntersectionObserver !== "function") return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("z-reveal--in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* ---------------- Card pointer tilt ---------------- */

  function initTilt() {
    /* Touch and reduced-motion visitors get the plain hover lift. */
    if (window.matchMedia) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    }
    var cards = document.querySelectorAll(".z-card");
    cards.forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--z-tilt-x", (y * -5).toFixed(2) + "deg");
        card.style.setProperty("--z-tilt-y", (x * 5).toFixed(2) + "deg");
        card.style.setProperty("--z-glow-x", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--z-glow-y", ((y + 0.5) * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--z-tilt-x", "0deg");
        card.style.setProperty("--z-tilt-y", "0deg");
      });
    });
  }

  function init() {
    initThemeToggle();
    initMenu();
    initSearch();
    initReveal();
    initTilt();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
