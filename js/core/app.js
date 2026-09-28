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
      const root = document.getElementById("dt-root");
      if (!root) {
        console.error("[DT] #dt-root not found");
        return;
      }

      // Apply theme first to avoid flash.
      DT.core.theme.init().then(function () {
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

        // Subscribe to router → render
        DT.core.router.on(renderView);

        // Initial view
        DT.core.router.go("list");
      });
    },
  };
})();
