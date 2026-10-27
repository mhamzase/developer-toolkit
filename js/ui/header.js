/**
 * File: js/ui/header.js
 * Module: UI — Sidebar head
 * Purpose: Logo, title, search input, theme toggle.
 * Notes: Renders the top block of the sidebar in the Clean Pro shell;
 *        the search field and actions keep their original classes so
 *        the palette hint and settings menu keep working unchanged.
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

      // Repaint when the theme changes elsewhere (settings, system mode)
      if (typeof DT.core.theme.on === "function") {
        DT.core.theme.on(function () { paintThemeIcon(); });
      }

      themeBtn.addEventListener("click", function () {
        DT.core.theme.toggle();
        paintThemeIcon();
      });

      const settingsBtn = DT.ui.settings.render();
      const actions = dom.el("div", { class: "dt-header__actions" }, [
        settingsBtn,
        themeBtn,
      ]);

      const header = dom.el("header", { class: "dt-header" }, [
        brand,
        search,
        actions,
      ]);

      /* ---------- Search: grid filter on list, quick-launch
         dropdown while a tool is open ----------
         Typing must never hide the tool the user is working in
         (the old wiring force-switched the view on every
         keystroke). With a tool open, matches appear in a
         dropdown under the field and navigation happens only
         when the user picks one (click, or arrows + Enter).
         On the list view the field keeps filtering the grid. */
      const drop = dom.el("div", {
        class: "dt-search-drop",
        id: "dt-search-drop",
        hidden: "",
        role: "listbox",
        "aria-label": "Search results",
      });
      search.appendChild(drop);

      let matches = [];
      let activeIdx = 0;
      let dropOpen = false;

      function closeDrop() {
        dropOpen = false;
        matches = [];
        drop.hidden = true;
        dom.clear(drop);
      }

      function paintActive() {
        drop.querySelectorAll(".dt-search-drop__item").forEach(function (row, i) {
          row.classList.toggle("dt-search-drop__item--active", i === activeIdx);
        });
      }

      function renderDrop() {
        dom.clear(drop);
        if (!matches.length) {
          drop.appendChild(dom.el("div", {
            class: "dt-search-drop__empty",
            text: "No tools found",
          }));
          return;
        }
        matches.forEach(function (tool, i) {
          const iconNode = DT.utils.icons.get(tool.icon);
          const iconWrap = dom.el("span", {
            class: "dt-side-item__icon",
            "data-cat": DT.core.registry.categorySlug(tool.category),
          });
          if (iconNode) iconWrap.appendChild(iconNode);
          const row = dom.el("button", {
            type: "button",
            class: "dt-search-drop__item" +
              (i === activeIdx ? " dt-search-drop__item--active" : ""),
            "data-tool-id": tool.id,
            role: "option",
          }, [
            iconWrap,
            dom.el("span", { class: "dt-search-drop__name", text: tool.name }),
            dom.el("span", { class: "dt-search-drop__cat", text: tool.category }),
          ]);
          row.addEventListener("mouseenter", function () {
            if (activeIdx !== i) { activeIdx = i; paintActive(); }
          });
          row.addEventListener("click", function () { openTool(tool); });
          drop.appendChild(row);
        });
      }

      function openDrop(list) {
        matches = list;
        activeIdx = 0;
        dropOpen = true;
        drop.hidden = false;
        renderDrop();
      }

      function currentMatches() {
        return DT.core.registry
          .filter({ query: searchInput.value.trim() })
          .slice(0, 8);
      }

      function openTool(tool) {
        DT.core.prefs.recordRecent(tool.id);
        closeDrop();
        searchInput.value = "";
        DT.core.router.go("tool", { toolId: tool.id, query: "" });
        searchInput.blur();
      }

      // Wire search (debounced)
      const push = DT.utils.debounce(function () {
        const q = searchInput.value.trim();
        if (DT.core.router.state.view === "list") {
          closeDrop();
          DT.core.router.setQuery(q);
          return;
        }
        if (!q) { closeDrop(); return; }
        openDrop(currentMatches());
      }, 120);
      searchInput.addEventListener("input", push);

      searchInput.addEventListener("focus", function () {
        if (DT.core.router.state.view !== "list" && searchInput.value.trim()) {
          openDrop(currentMatches());
        }
      });

      searchInput.addEventListener("keydown", function (e) {
        if (!dropOpen) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!matches.length) return;
          const dir = e.key === "ArrowDown" ? 1 : -1;
          activeIdx = (activeIdx + dir + matches.length) % matches.length;
          paintActive();
          const rows = drop.querySelectorAll(".dt-search-drop__item");
          if (rows[activeIdx]) rows[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          if (matches[activeIdx]) {
            e.preventDefault();
            openTool(matches[activeIdx]);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeDrop();
        }
      });

      document.addEventListener("mousedown", function (e) {
        if (dropOpen && !search.contains(e.target)) closeDrop();
      });

      /* Any navigation closes a stale dropdown */
      DT.core.router.on(function () { if (dropOpen) closeDrop(); });

      return header;
    },
  };
})();
