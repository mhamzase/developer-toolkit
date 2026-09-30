/**
 * File: js/ui/grid.js
 * Module: UI — Tool Grid
 * Purpose: Render tool cards with Favorites, Recently Used chips, and All tools.
 * Notes:
 *   - Favorites → full cards
 *   - Recently used → compact chips
 *   - All tools → full cards, ALL tools every time (no filtering)
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

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

  function buildCard(tool) {
    const dom = DT.ui.dom;
    const isFav = DT.core.prefs.isFavorite(tool.id);

    /* Icon */
    const iconNode = DT.utils.icons.get(tool.icon);
    const iconWrap = dom.el("div", { class: "dt-tool-card__icon-wrap" });
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

    /* Star toggle */
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

    return dom.el("div", { class: "dt-tool-card-wrap" }, [card, star]);
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

  /* ---------------- Public ---------------- */

  DT.ui.grid = {
    render: function (mount) {
      const dom = DT.ui.dom;
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

      /* Filtering or searching → flat list of cards */
      if (!isDefaultView) {
        mount.appendChild(buildGrid(all));
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

      /* -------- Favorites -------- */
      if (favTools.length) {
        mount.appendChild(
          buildSection("Favorites", favTools.length, buildGrid(favTools)),
        );
      }

      /* -------- Recently used (chips) -------- */
      if (recTools.length) {
        mount.appendChild(
          buildSection("Recently used", null, buildChipRow(recTools)),
        );
      }

      /* -------- All tools (always ALL of them) -------- */
      const label = favTools.length || recTools.length ? "All tools" : "";
      if (label) {
        mount.appendChild(buildSection(label, all.length, buildGrid(all)));
      } else {
        mount.appendChild(buildGrid(all));
      }
    },
  };
})();
