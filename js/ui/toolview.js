/**
 * File: js/ui/toolview.js
 * Module: UI — Tool View
 * Purpose: Container that mounts a selected tool. Handles unmount on leave.
 * Notes (v2): The bar shows a category-tinted icon tile, the tool name
 *        and description, and a favorite star, so switching context
 *        stays visible while the sidebar handles navigation.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let activeTool = null;

  const ICON_BACK =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polyline points="15 18 9 12 15 6"/>' +
    "</svg>";

  function safeUnmount() {
    if (activeTool) {
      try {
        if (typeof activeTool.unmount === "function") activeTool.unmount();
      } catch (e) {
        console.error("[DT] tool unmount failed:", e);
      }
      activeTool = null;
    }
  }

  DT.ui.toolview = {
    /** Unmount currently active tool (called when leaving tool view). */
    unmountActive: safeUnmount,

    /**
     * Render tool view into a container.
     * @param {HTMLElement} mount
     */
    render: function (mount) {
      const dom = DT.ui.dom;
      const toolId = DT.core.router.state.toolId;
      const tool = DT.core.registry.get(toolId);

      // Top bar
      const backBtn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm",
        "aria-label": "Back to all tools",
        title: "Back",
      });
      const backIcon = dom.svg(ICON_BACK);
      if (backIcon) backBtn.appendChild(backIcon);
      backBtn.addEventListener("click", function () {
        DT.core.router.go("list");
      });

      /* Icon tile (tinted by category) + title/description + favorite star */
      const iconWrap = dom.el("div", {
        class: "dt-toolview__icon",
        "data-cat": tool ? DT.core.registry.categorySlug(tool.category) : "",
      });
      if (tool) {
        const iconNode = DT.utils.icons.get(tool.icon);
        if (iconNode) iconWrap.appendChild(iconNode);
      }

      const titleBlock = dom.el("div", { class: "dt-toolview__meta" }, [
        dom.el("div", {
          class: "dt-toolview__title",
          text: tool ? tool.name : "Tool",
        }),
        dom.el("div", {
          class: "dt-toolview__desc",
          text: tool ? tool.description || "" : "",
        }),
      ]);

      const barChildren = [backBtn, iconWrap, titleBlock];

      if (tool) {
        const isFav = DT.core.prefs.isFavorite(tool.id);
        const starBtn = dom.el("button", {
          type: "button",
          class:
            "dt-btn dt-btn--ghost dt-btn--icon dt-toolview__star" +
            (isFav ? " dt-toolview__star--on" : ""),
          "aria-label": isFav ? "Remove from favorites" : "Add to favorites",
          title: isFav ? "Remove from favorites" : "Add to favorites",
        });
        const starIcon = DT.utils.icons.get("star");
        if (starIcon) starBtn.appendChild(starIcon);
        starBtn.addEventListener("click", function () {
          /* Paint locally: a re-render would remount the tool and
             lose whatever the user has typed into it. The sidebar
             and home grid repaint themselves via prefs.on(). */
          const nowFav = DT.core.prefs.toggleFavorite(tool.id);
          starBtn.classList.toggle("dt-toolview__star--on", nowFav);
          starBtn.setAttribute("aria-label", nowFav ? "Remove from favorites" : "Add to favorites");
          starBtn.setAttribute("title", nowFav ? "Remove from favorites" : "Add to favorites");
          DT.ui.toast.success(nowFav ? "Added to favorites" : "Removed from favorites");
        });
        barChildren.push(starBtn);
      }

      const bar = dom.el("div", { class: "dt-toolview__bar" }, barChildren);
      const body = dom.el("div", { class: "dt-toolview__body" });
      const view = dom.el("section", { class: "dt-toolview" }, [bar, body]);

      mount.appendChild(view);

      if (!tool) {
        body.appendChild(
          dom.el("div", { class: "dt-empty" }, [
            dom.el("div", { class: "dt-empty__title", text: "Tool not found" }),
            dom.el("div", {
              class: "dt-empty__text",
              text: "This tool is not registered.",
            }),
          ]),
        );
        return;
      }

      // If switching to a different tool, unmount the previous one.
      if (activeTool && activeTool.id !== tool.id) safeUnmount();
      activeTool = tool;

      try {
        if (typeof tool.mount === "function") tool.mount(body);
      } catch (e) {
        console.error("[DT] tool mount failed:", e);
        body.appendChild(
          dom.el("div", {
            class: "dt-error",
            text:
              "Failed to load tool: " +
              (e && e.message ? e.message : "unknown error"),
          }),
        );
      }

      // If tool hasn't rendered anything yet (stub), show a friendly note.
      if (body.children.length === 0) {
        body.appendChild(
          dom.el("div", { class: "dt-empty" }, [
            dom.el("div", { class: "dt-empty__title", text: "Coming soon" }),
            dom.el("div", {
              class: "dt-empty__text",
              text: "This tool is being built.",
            }),
          ]),
        );
      }
    },
  };
})();
