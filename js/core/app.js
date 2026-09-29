/**
 * File: js/core/app.js
 * Module: Core — App
 * Purpose: Bootstrap: apply theme, build shell, wire router.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.core = DT.core || {};

  let mainEl = null;

  // Add a shortcut hint to the header search field on init
  function attachPaletteHint() {
    const searchWrap = document.querySelector(".dt-header__search");
    if (!searchWrap || searchWrap.querySelector(".dt-palette-hint")) return;
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const hint = document.createElement("span");
    hint.className = "dt-palette-hint";
    hint.setAttribute("aria-hidden", "true");
    hint.innerHTML = ""; // never use innerHTML with user data — this is a hardcoded safe string
    hint.textContent = isMac ? "⌘K" : "Ctrl K";
    searchWrap.appendChild(hint);
  }

  /** Re-render main area based on router state. */
  function renderView(state) {
    if (!mainEl) return;
    DT.ui.dom.clear(mainEl);

    if (state.view === "tool") {
      DT.ui.toolview.render(mainEl);
    } else {
      DT.ui.toolview.unmountActive();
      DT.ui.grid.render(mainEl);
    }
  }

  DT.core.app = {
    init: function () {
      /* Safety: remove any orphaned overlays from a previous failed boot */
      document
        .querySelectorAll(".dt-help, .dt-palette, .dt-confirm, .dt-settings")
        .forEach(function (el) {
          el.remove();
        });

      const root = document.getElementById("dt-root");
      if (!root) {
        console.error("[DT] #dt-root not found");
        return;
      }

      // Apply theme + load preferences first, then render.
      Promise.all([
        DT.core.theme.init(),
        DT.core.prefs.load(),
        DT.core.session.load(),
      ]).then(function () {
        DT.ui.dom.clear(root);

        // Header
        root.appendChild(DT.ui.header.render());

        // Category tabs
        root.appendChild(DT.ui.nav.render());

        // Main scrollable area
        mainEl = DT.ui.dom.el("main", { class: "dt-main", id: "dt-main" });
        root.appendChild(mainEl);

        // Footer
        root.appendChild(DT.ui.footer.render());

        // Subscribe to router → render main view
        DT.core.router.on(renderView);

        // Subscribe to prefs changes → re-render the list view
        DT.core.prefs.on(function () {
          if (DT.core.router.state.view === "list") {
            renderView(DT.core.router.state);
          }
        });

        // Command palette (build overlay + global Ctrl+K handler)
        DT.ui.palette.init();
        attachPaletteHint();

        // Keyboard shortcuts help overlay ("?")
        DT.ui.help.init();

        // First-run welcome (shows only once)
        DT.ui.welcome.init();

        // ALWAYS open on the home grid with "All" category selected
        DT.core.router.go("list", { filter: "All", query: "" });
      });
    },
  };
})();
