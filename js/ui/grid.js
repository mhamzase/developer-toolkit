/**
 * File: js/ui/grid.js
 * Module: UI — Tool Grid
 * Purpose: Render tool cards with Favorites, Recently Used chips, and All tools.
 * Notes (v2, Clean Pro home):
 *   - A home head row shows the current view title + count and a
 *     grid/list view toggle (choice persists in chrome.storage).
 *   - Favorites → cards/rows of their own; they are NOT repeated
 *     in the All tools section anymore (a star marks them there).
 *   - Recently used → compact chips
 *   - All tools → every non-favorite tool (no filtering)
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  /* Home view mode: 'grid' (cards) or 'list' (compact rows). */
  let viewMode = 'grid';
  let viewModeLoaded = false;

  function loadViewMode() {
    if (viewModeLoaded) return;
    viewModeLoaded = true;
    DT.core.storage.get('dt:homeView', 'grid').then(function (saved) {
      if ((saved === 'list' || saved === 'grid') && saved !== viewMode) {
        viewMode = saved;
        if (DT.core.router.state.view === 'list') DT.core.router.emit();
      }
    });
  }

  function setViewMode(mode) {
    if (mode === viewMode) return;
    viewMode = mode;
    DT.core.storage.set('dt:homeView', mode);
    DT.core.router.emit();
  }

  function catSlug(tool) {
    return DT.core.registry.categorySlug(tool.category);
  }

  /* ---------------- Icons ---------------- */

  const ICON_STAR_OUTLINE =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    "</svg>";

  const ICON_STAR_FILLED =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" ' +
    'fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' +
    "</svg>";

  /* ---------------- Card ---------------- */

  /* Star toggle (shared by cards and rows) */
  function buildStar(tool) {
    const dom = DT.ui.dom;
    const isFav = DT.core.prefs.isFavorite(tool.id);
    const star = dom.el("button", {
      type: "button",
      class: "dt-tool-card__star" + (isFav ? " dt-tool-card__star--on" : ""),
      "aria-label": isFav ? "Remove from favorites" : "Add to favorites",
      title: isFav ? "Unpin from favorites" : "Pin to favorites",
    });
    const starIcon = dom.svg(isFav ? ICON_STAR_FILLED : ICON_STAR_OUTLINE);
    if (starIcon) star.appendChild(starIcon);

    star.addEventListener("click", function (e) {
      e.stopPropagation();
      const nowFav = DT.core.prefs.toggleFavorite(tool.id);
      DT.ui.toast.success(
        nowFav ? "Added to favorites" : "Removed from favorites",
      );
    });
    return star;
  }

  function buildCard(tool) {
    const dom = DT.ui.dom;

    /* Icon (tile tinted by category) */
    const iconNode = DT.utils.icons.get(tool.icon);
    const iconWrap = dom.el("div", {
      class: "dt-tool-card__icon-wrap",
      "data-cat": catSlug(tool),
    });
    if (iconNode) iconWrap.appendChild(iconNode);

    /* Card body */
    const card = dom.el(
      "button",
      {
        type: "button",
        class: "dt-tool-card",
        "data-tool-id": tool.id,
        title: tool.description || tool.name,
      },
      [
        iconWrap,
        dom.el("div", { class: "dt-tool-card__title", text: tool.name }),
        dom.el("div", {
          class: "dt-tool-card__desc",
          text: tool.description || "",
        }),
      ],
    );

    card.addEventListener("click", function () {
      DT.core.prefs.recordRecent(tool.id);
      DT.core.router.go("tool", { toolId: tool.id });
    });

    return dom.el("div", { class: "dt-tool-card-wrap" }, [card, buildStar(tool)]);
  }

  /* ---------------- Row (list view) ---------------- */

  function buildRow(tool) {
    const dom = DT.ui.dom;

    const iconNode = DT.utils.icons.get(tool.icon);
    const iconWrap = dom.el("div", {
      class: "dt-tool-row__icon",
      "data-cat": catSlug(tool),
    });
    if (iconNode) iconWrap.appendChild(iconNode);

    const row = dom.el(
      "button",
      {
        type: "button",
        class: "dt-tool-row",
        "data-tool-id": tool.id,
        title: tool.description || tool.name,
      },
      [
        iconWrap,
        dom.el("div", { class: "dt-tool-row__main" }, [
          dom.el("div", { class: "dt-tool-row__title", text: tool.name }),
          dom.el("div", {
            class: "dt-tool-row__desc",
            text: tool.description || "",
          }),
        ]),
        dom.el("span", { class: "dt-tool-row__cat", text: tool.category || "" }),
      ],
    );

    row.addEventListener("click", function () {
      DT.core.prefs.recordRecent(tool.id);
      DT.core.router.go("tool", { toolId: tool.id });
    });

    return dom.el("div", { class: "dt-tool-card-wrap" }, [row, buildStar(tool)]);
  }

  function buildTools(tools) {
    return viewMode === 'list' ? buildRows(tools) : buildGrid(tools);
  }

  function buildRows(tools) {
    const dom = DT.ui.dom;
    const rows = dom.el("div", { class: "dt-tool-rows" });
    tools.forEach(function (t) {
      rows.appendChild(buildRow(t));
    });
    return rows;
  }

  /* ---------------- Chip ---------------- */

  function buildChip(tool) {
    const dom = DT.ui.dom;

    const iconNode = DT.utils.icons.get(tool.icon);
    const iconWrap = dom.el("span", { class: "dt-chip__icon" });
    if (iconNode) iconWrap.appendChild(iconNode);

    const chip = dom.el(
      "button",
      {
        type: "button",
        class: "dt-chip",
        "data-tool-id": tool.id,
        title: tool.description || tool.name,
      },
      [iconWrap, dom.el("span", { class: "dt-chip__label", text: tool.name })],
    );

    chip.addEventListener("click", function () {
      DT.core.prefs.recordRecent(tool.id);
      DT.core.router.go("tool", { toolId: tool.id });
    });

    return chip;
  }

  /* ---------------- Blocks ---------------- */

  function buildGrid(tools) {
    const dom = DT.ui.dom;
    const grid = dom.el("div", { class: "dt-grid" });
    tools.forEach(function (t) {
      grid.appendChild(buildCard(t));
    });
    return grid;
  }

  function buildChipRow(tools) {
    const dom = DT.ui.dom;
    const row = dom.el("div", { class: "dt-chip-row" });
    tools.forEach(function (t) {
      row.appendChild(buildChip(t));
    });
    return row;
  }

  function buildSection(label, count, bodyEl) {
    const dom = DT.ui.dom;
    const head = dom.el("div", { class: "dt-grid-section__head" }, [
      dom.el("span", { class: "dt-grid-section__title", text: label }),
    ]);
    if (typeof count === "number") {
      head.appendChild(
        dom.el("span", {
          class: "dt-grid-section__count",
          text: String(count),
        }),
      );
    }
    return dom.el("div", { class: "dt-grid-section" }, [head, bodyEl]);
  }

  /* ---------------- Home head (title + view toggle) ---------------- */

  function buildHomeHead(title, count) {
    const dom = DT.ui.dom;

    function toggleBtn(mode, iconName, label) {
      const btn = dom.el("button", {
        type: "button",
        class: "dt-view-toggle__btn" + (viewMode === mode ? " dt-view-toggle__btn--on" : ""),
        "aria-label": label,
        title: label,
      });
      const icon = DT.utils.icons.get(iconName);
      if (icon) btn.appendChild(icon);
      btn.addEventListener("click", function () { setViewMode(mode); });
      return btn;
    }

    return dom.el("div", { class: "dt-home-head" }, [
      dom.el("div", { class: "dt-home-head__title", text: title }),
      dom.el("span", { class: "dt-home-head__count", text: String(count) }),
      dom.el("div", { class: "dt-grow" }),
      dom.el("div", { class: "dt-view-toggle" }, [
        toggleBtn('grid', 'grid', "Grid view"),
        toggleBtn('list', 'list', "List view"),
      ]),
    ]);
  }

  /* ---------------- Public ---------------- */

  DT.ui.grid = {
    render: function (mount) {
      const dom = DT.ui.dom;
      loadViewMode();
      const state = DT.core.router.state;
      const isDefaultView = state.filter === "All" && !state.query.trim();

      const all = DT.core.registry.filter({
        filter: state.filter,
        query: state.query,
      });

      if (all.length === 0) {
        mount.appendChild(
          dom.el("div", { class: "dt-empty" }, [
            dom.el("div", { class: "dt-empty__title", text: "No tools found" }),
            dom.el("div", {
              class: "dt-empty__text",
              text: "Try a different category or search term.",
            }),
          ]),
        );
        return;
      }

      /* Filtering or searching → flat list */
      if (!isDefaultView) {
        mount.appendChild(buildHomeHead(
          state.query ? 'Search results' : state.filter, all.length));
        mount.appendChild(buildTools(all));
        return;
      }

      /* Default view → Favorites cards, Recently used chips, All tools cards */

      const favIds = DT.core.prefs.getFavorites();
      const recIds = DT.core.prefs.getRecents();

      const byId = {};
      all.forEach(function (t) {
        byId[t.id] = t;
      });

      const favTools = favIds
        .map(function (id) {
          return byId[id];
        })
        .filter(Boolean);

      /* Recently used — show all up to 5, even if some are also favorites.
         Chips look different from cards, so overlap is not confusing. */
      const recTools = recIds
        .map(function (id) {
          return byId[id];
        })
        .filter(Boolean);

      mount.appendChild(buildHomeHead('All Tools', all.length));

      /* -------- Favorites -------- */
      if (favTools.length) {
        mount.appendChild(
          buildSection("Favorites", favTools.length, buildTools(favTools)),
        );
      }

      /* -------- Recently used (chips) -------- */
      if (recTools.length) {
        mount.appendChild(
          buildSection("Recently used", null, buildChipRow(recTools)),
        );
      }

      /* -------- All tools (favorites are NOT repeated here) -------- */
      const restTools = all.filter(function (t) {
        return favIds.indexOf(t.id) === -1;
      });
      const label = favTools.length || recTools.length ? "All tools" : "";
      if (label) {
        mount.appendChild(buildSection(label, restTools.length, buildTools(restTools)));
      } else {
        mount.appendChild(buildTools(restTools));
      }
    },
  };
})();
