/**
 * File: js/ui/header.js
 * Module: UI — Header
 * Purpose: Logo, title, search input, theme toggle.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  const ICON_SUN =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="4"/>' +
    '<line x1="12" y1="2" x2="12" y2="4"/>' +
    '<line x1="12" y1="20" x2="12" y2="22"/>' +
    '<line x1="2" y1="12" x2="4" y2="12"/>' +
    '<line x1="20" y1="12" x2="22" y2="12"/>' +
    '<line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/>' +
    '<line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/>' +
    '<line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/>' +
    '<line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/>' +
    "</svg>";

  const ICON_MOON =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>' +
    "</svg>";

  /* Real extension logo — path is relative to popup/popup.html */
  const LOGO_SRC = "../assets/icons/icon48.png";

  const ICON_SEARCH =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-header__search-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="11" cy="11" r="7"/>' +
    '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
    "</svg>";

  DT.ui.header = {
    /** Build the header element. */
    render: function () {
      const dom = DT.ui.dom;

      // Brand
      const logo = dom.el("img", {
        class: "dt-header__logo",
        src: LOGO_SRC,
        alt: "",
        "aria-hidden": "true",
        draggable: "false",
      });
      const title = dom.el("div", {
        class: "dt-header__title",
        text: "Developer Toolkit",
      });
      const brand = dom.el("div", { class: "dt-header__brand" }, [logo, title]);

      // Search
      const searchIcon = dom.svg(ICON_SEARCH);
      const searchInput = dom.el("input", {
        type: "search",
        class: "dt-input",
        id: "dt-search",
        placeholder: "Search tools…",
        autocomplete: "off",
        spellcheck: "false",
      });
      const search = dom.el("div", { class: "dt-header__search" }, [
        searchIcon,
        searchInput,
      ]);

      // Theme toggle
      const themeBtn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon",
        id: "dt-theme-toggle",
        "aria-label": "Toggle theme",
        title: "Toggle theme",
      });

      function paintThemeIcon() {
        dom.clear(themeBtn);
        const svg = DT.core.theme.current === "dark" ? ICON_SUN : ICON_MOON;
        const node = dom.svg(svg);
        if (node) themeBtn.appendChild(node);
      }

      paintThemeIcon();

      themeBtn.addEventListener("click", function () {
        DT.core.theme.toggle();
        paintThemeIcon();
      });

      const actions = dom.el("div", { class: "dt-header__actions" }, [
        themeBtn,
      ]);

      const header = dom.el("header", { class: "dt-header" }, [
        brand,
        search,
        actions,
      ]);

      // Wire search → router (debounced)
      const push = DT.utils.debounce(function () {
        DT.core.router.setQuery(searchInput.value.trim());
      }, 120);
      searchInput.addEventListener("input", push);

      return header;
    },
  };
})();
