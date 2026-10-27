/**
 * File: js/ui/header.js
 * Module: UI — Sidebar head
 * Purpose: Sidebar head (logo, title, actions) plus the search
 *          field that now lives in a top bar above the main area.
 * Notes: render() builds the sidebar head; renderSearch() builds
 *        the search field and all of its wiring (grid filtering
 *        on the list view, results panel while a tool is open),
 *        and app.js mounts it in the content column's top bar.
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
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-topbar__search-icon" viewBox="0 0 24 24" ' +
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

      // Sidebar collapse toggle: switches the shell to the icon
      // rail (and back) at any window width; the choice persists
      // via prefs and app.js applies it at boot.
      const collapseBtn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon dt-header__collapse",
        id: "dt-sidebar-collapse",
        "aria-label": "Toggle sidebar",
      });
      const collapseIcon = DT.utils.icons.get("panelLeft");
      if (collapseIcon) collapseBtn.appendChild(collapseIcon);

      function paintCollapseBtn() {
        const collapsed = DT.core.prefs.isSidebarCollapsed();
        collapseBtn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
        collapseBtn.setAttribute("aria-pressed", collapsed ? "true" : "false");
        const svg = collapseBtn.querySelector("svg");
        if (svg) svg.style.transform = collapsed ? "scaleX(-1)" : "";
      }

      collapseBtn.addEventListener("click", function () {
        const next = !DT.core.prefs.isSidebarCollapsed();
        DT.core.prefs.setSidebarCollapsed(next);
        const root = document.getElementById("dt-root");
        if (root) root.classList.toggle("dt-shell--collapsed", next);
        paintCollapseBtn();
      });
      paintCollapseBtn();

      const settingsBtn = DT.ui.settings.render();
      const actions = dom.el("div", { class: "dt-header__actions" }, [
        settingsBtn,
        themeBtn,
        collapseBtn,
      ]);

      const header = dom.el("header", { class: "dt-header" }, [
        brand,
        actions,
      ]);

      return header;
    },

    /** Build the search field for the top bar (with wiring). */
    renderSearch: function () {
      const dom = DT.ui.dom;

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
      const search = dom.el("div", { class: "dt-topbar__search" }, [
        searchIcon,
        searchInput,
      ]);

      /* ---------- Search wiring: grid filter on the list
         view, results panel in the main area while a tool
         is open ----------
         Typing must never hide the tool the user is working in
         (the old wiring force-switched the view on every
         keystroke). With a tool open, matches appear in a full
         width panel pinned at the top of the main area (the
         sidebar dropdown truncated long tool names), and
         navigation happens only when the user picks one
         (click, or arrows + Enter). On the list view the field
         keeps filtering the grid. */
      const panel = dom.el("div", {
        class: "dt-search-panel",
        id: "dt-search-panel",
        hidden: "",
        role: "listbox",
        "aria-label": "Search results",
      });
      const panelHead = dom.el("div", { class: "dt-search-panel__head" }, [
        dom.el("span", { class: "dt-search-panel__title", text: "Search results" }),
        dom.el("span", {
          class: "dt-search-panel__hint",
          text: "\u2191\u2193 navigate \u00B7 Enter opens \u00B7 Esc closes",
        }),
      ]);
      const panelRows = dom.el("div", { class: "dt-search-panel__rows" });
      panel.appendChild(panelHead);
      panel.appendChild(panelRows);

      let matches = [];
      let activeIdx = 0;
      let panelOpenState = false;

      function mountPanel() {
        const main = document.getElementById("dt-main");
        if (main && panel.parentNode !== main) {
          main.insertBefore(panel, main.firstChild);
        }
      }

      function closePanel() {
        panelOpenState = false;
        matches = [];
        panel.hidden = true;
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        dom.clear(panelRows);
      }

      function paintActive() {
        panelRows.querySelectorAll(".dt-search-item").forEach(function (row, i) {
          row.classList.toggle("dt-search-item--active", i === activeIdx);
        });
      }

      function renderPanel() {
        dom.clear(panelRows);
        if (!matches.length) {
          panelRows.appendChild(dom.el("div", {
            class: "dt-search-panel__empty",
            text: "No tools match your search",
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
            class: "dt-search-item" +
              (i === activeIdx ? " dt-search-item--active" : ""),
            "data-tool-id": tool.id,
            role: "option",
          }, [
            iconWrap,
            dom.el("span", { class: "dt-search-item__main" }, [
              dom.el("span", { class: "dt-search-item__name", text: tool.name }),
              dom.el("span", { class: "dt-search-item__desc", text: tool.description || "" }),
            ]),
            dom.el("span", { class: "dt-search-item__cat", text: tool.category }),
          ]);
          row.addEventListener("mouseenter", function () {
            if (activeIdx !== i) { activeIdx = i; paintActive(); }
          });
          row.addEventListener("click", function () { openTool(tool); });
          panelRows.appendChild(row);
        });
      }

      function openPanel(list) {
        matches = list;
        activeIdx = 0;
        mountPanel();
        panelOpenState = true;
        panel.hidden = false;
        renderPanel();
      }

      function currentMatches() {
        return DT.core.registry
          .filter({ query: searchInput.value.trim() })
          .slice(0, 8);
      }

      function openTool(tool) {
        DT.core.prefs.recordRecent(tool.id);
        closePanel();
        searchInput.value = "";
        DT.core.router.go("tool", { toolId: tool.id, query: "" });
        searchInput.blur();
      }

      // Wire search (debounced)
      const push = DT.utils.debounce(function () {
        const q = searchInput.value.trim();
        if (DT.core.router.state.view === "list") {
          closePanel();
          DT.core.router.setQuery(q);
          return;
        }
        if (!q) { closePanel(); return; }
        openPanel(currentMatches());
      }, 120);
      searchInput.addEventListener("input", push);

      searchInput.addEventListener("focus", function () {
        if (DT.core.router.state.view !== "list" && searchInput.value.trim()) {
          openPanel(currentMatches());
        }
      });

      searchInput.addEventListener("keydown", function (e) {
        if (!panelOpenState) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!matches.length) return;
          const dir = e.key === "ArrowDown" ? 1 : -1;
          activeIdx = (activeIdx + dir + matches.length) % matches.length;
          paintActive();
          const rows = panelRows.querySelectorAll(".dt-search-item");
          if (rows[activeIdx] && rows[activeIdx].scrollIntoView) rows[activeIdx].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter") {
          if (matches[activeIdx]) {
            e.preventDefault();
            openTool(matches[activeIdx]);
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closePanel();
        }
      });

      document.addEventListener("mousedown", function (e) {
        if (panelOpenState && !search.contains(e.target) && !panel.contains(e.target)) {
          closePanel();
        }
      });

      /* Any navigation closes a stale results panel */
      DT.core.router.on(function () { if (panelOpenState) closePanel(); });

      return search;
    },
  };
})();
