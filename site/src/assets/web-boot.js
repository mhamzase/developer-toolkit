/**
 * File: site/src/assets/web-boot.js
 * Purpose: Website bootstrap for tool pages: mount the page's single
 * tool into its workspace container.
 *
 * The extension mounts tools through its router and tool view; the
 * website has exactly one tool per page, so this file is the whole
 * bootstrap: find the mount node, look the tool up in the shared
 * registry, and mount it. It must load AFTER the extension scripts
 * (utils, core, ui kit, and the tool file itself).
 */
(function () {
  "use strict";

  function hideLoading() {
    var loader = document.getElementById("dt-tool-loading");
    if (loader) loader.style.display = "none";
  }

  function boot() {
    var mountEl = document.getElementById("dt-tool-mount");
    if (!mountEl) return;

    var toolId = mountEl.getAttribute("data-tool-id");
    var registry = window.DT && window.DT.core && window.DT.core.registry;
    var tool = registry && toolId ? registry.get(toolId) : null;

    if (!tool || typeof tool.mount !== "function") {
      hideLoading();
      mountEl.innerHTML =
        '<p class="z-tool-error">This tool could not be loaded. ' +
        'Please try the <a href="../">full tool list</a> instead.</p>';
      return;
    }

    try {
      tool.mount(mountEl);
      hideLoading();
    } catch (err) {
      /* A broken tool must not take the page chrome down with it. */
      if (window.console && console.error) console.error("[Zase] tool mount failed:", err);
      hideLoading();
      mountEl.innerHTML =
        '<p class="z-tool-error">This tool failed to start in your browser. ' +
        "The Chrome extension version works fully offline and may serve you better.</p>";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
