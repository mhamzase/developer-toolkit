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

  /* --------------------------------------------------------------
   * Pending navigation (Phase 3): the service worker (context
   * menus, omnibox) stores { toolId, text } under dt:pendingNav;
   * the app consumes it on boot and live via storage.onChanged,
   * routes to the tool and prefills its primary field.
   * -------------------------------------------------------------- */
  const PENDING_KEY = "dt:pendingNav";
  const PREFILL = {
    jwt: "#dt-jwt-input",
    base64: "#dt-b64-input",
    url: "#dt-url-input",
    hash: "#dt-hash-input",
    qr: "#dt-qr-input",
    json: "#dt-json-input",
    markdown: "#dt-md-input",
  };

  function handlePending(pending) {
    if (!pending || !pending.toolId) return;
    if (!DT.core.registry.get(pending.toolId)) return;
    DT.core.router.go("tool", { toolId: pending.toolId });
    if (!pending.text) return;
    const selector = PREFILL[pending.toolId];
    if (!selector) return;
    let tries = 0;
    const timer = setInterval(function () {
      tries++;
      const field = document.querySelector(selector);
      if (field) {
        field.value = pending.text;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        // Tools that act on demand (JWT decode, JSON/SQL format)
        // listen for Ctrl+Enter; fire it so a context-menu send
        // lands fully processed, not just pasted.
        field.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
        );
        field.focus();
        clearInterval(timer);
      } else if (tries > 20) {
        clearInterval(timer);
      }
    }, 50);
  }

  function consumePendingNav() {
    try {
      if (!window.chrome || !chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get(PENDING_KEY, function (res) {
        const pending = res && res[PENDING_KEY];
        if (pending) {
          chrome.storage.local.remove(PENDING_KEY);
          handlePending(pending);
        }
      });
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area !== "local") return;
        const change = changes[PENDING_KEY];
        if (change && change.newValue) {
          chrome.storage.local.remove(PENDING_KEY);
          handlePending(change.newValue);
        }
      });
    } catch (e) {
      // Not running in an extension context; nothing to consume.
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

        // Sidebar: head (brand, search, actions) + tool navigation
        const sidebar = DT.ui.dom.el("aside", { class: "dt-sidebar" }, [
          DT.ui.header.render(),
          DT.ui.nav.render(),
        ]);
        root.appendChild(sidebar);

        // Content column: main scrollable area + footer
        mainEl = DT.ui.dom.el("main", { class: "dt-main", id: "dt-main" });
        const content = DT.ui.dom.el("div", { class: "dt-content" }, [
          mainEl,
          DT.ui.footer.render(),
        ]);
        root.appendChild(content);

        // Honor the saved sidebar layout (collapse toggle)
        if (DT.core.prefs.isSidebarCollapsed()) {
          root.classList.add("dt-shell--collapsed");
        }

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

        // Then honor any pending navigation (context menu / omnibox)
        consumePendingNav();
      });
    },
  };
})();
