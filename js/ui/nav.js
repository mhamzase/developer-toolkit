/**
 * File: js/ui/nav.js
 * Module: UI — Navigation (sidebar)
 * Purpose: Sidebar navigation for the Clean Pro shell.
 *   - "All Tools" home item with the total count
 *   - Favorites group (only when the user has favorites)
 *   - One group per category: the group label opens the filtered
 *     home grid, each tool item opens the tool directly, so any
 *     tool is reachable in one click from anywhere in the app.
 * Notes: Re-paints on router and favorites/recents changes.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  DT.ui.nav = {
    render: function () {
      const dom = DT.ui.dom;
      const track = dom.el('div', { class: 'dt-nav__track' });

      function openTool(tool) {
        DT.core.prefs.recordRecent(tool.id);
        DT.core.router.go('tool', { toolId: tool.id });
      }

      function toolItem(tool, activeToolId) {
        const iconNode = DT.utils.icons.get(tool.icon);
        const iconWrap = dom.el('span', {
          class: 'dt-side-item__icon',
          'data-cat': DT.core.registry.categorySlug(tool.category)
        });
        if (iconNode) iconWrap.appendChild(iconNode);

        const item = dom.el('button', {
          type: 'button',
          class: 'dt-side-item' + (tool.id === activeToolId ? ' dt-side-item--active' : ''),
          'data-tool-id': tool.id,
          title: tool.description || tool.name
        }, [
          iconWrap,
          dom.el('span', { class: 'dt-side-item__label', text: tool.name })
        ]);
        item.addEventListener('click', function () { openTool(tool); });
        return item;
      }

      function groupLabel(text, opts) {
        opts = opts || {};
        const children = [dom.el('span', { class: 'dt-side-group__label-text', text: text })];
        if (typeof opts.count === 'number') {
          children.push(dom.el('span', { class: 'dt-side-group__count', text: String(opts.count) }));
        }
        const label = dom.el(opts.onClick ? 'button' : 'div', {
          type: opts.onClick ? 'button' : undefined,
          class: 'dt-side-group__label' + (opts.active ? ' dt-side-group__label--active' : '')
        }, children);
        if (opts.onClick) label.addEventListener('click', opts.onClick);
        return label;
      }

      function paint() {
        dom.clear(track);
        const state = DT.core.router.state;
        const all = DT.core.registry.all();
        const activeToolId = state.view === 'tool' ? state.toolId : null;

        /* ----- All Tools (home) ----- */
        const homeIcon = DT.utils.icons.get('grid');
        const homeIconWrap = dom.el('span', { class: 'dt-side-item__icon' });
        if (homeIcon) homeIconWrap.appendChild(homeIcon);
        const home = dom.el('button', {
          type: 'button',
          class: 'dt-side-item dt-side-item--home' +
            (state.view === 'list' && state.filter === 'All' ? ' dt-side-item--active' : ''),
          title: 'All tools'
        }, [
          homeIconWrap,
          dom.el('span', { class: 'dt-side-item__label', text: 'All Tools' }),
          dom.el('span', { class: 'dt-side-item__count', text: String(all.length) })
        ]);
        home.addEventListener('click', function () {
          DT.core.router.go('list', { filter: 'All' });
        });
        track.appendChild(home);

        /* ----- Favorites ----- */
        const byId = {};
        all.forEach(function (t) { byId[t.id] = t; });
        const favTools = DT.core.prefs.getFavorites()
          .map(function (id) { return byId[id]; })
          .filter(Boolean);

        if (favTools.length) {
          const favGroup = dom.el('div', { class: 'dt-side-group' }, [
            groupLabel('Favorites', { count: favTools.length })
          ]);
          favTools.forEach(function (t) { favGroup.appendChild(toolItem(t, activeToolId)); });
          track.appendChild(favGroup);
        }

        /* ----- Categories with their tools ----- */
        DT.core.registry.categories().forEach(function (cat) {
          if (cat === 'All') return;
          const tools = all.filter(function (t) { return t.category === cat; });
          if (!tools.length) return;

          const group = dom.el('div', { class: 'dt-side-group' }, [
            groupLabel(cat, {
              count: tools.length,
              active: state.view === 'list' && state.filter === cat,
              onClick: function () { DT.core.router.go('list', { filter: cat }); }
            })
          ]);
          tools.forEach(function (t) { group.appendChild(toolItem(t, activeToolId)); });
          track.appendChild(group);
        });
      }

      /* Repaint when navigation state or favorites change */
      DT.core.router.on(function () { paint(); });
      DT.core.prefs.on(function () { paint(); });
      paint();

      return dom.el('nav', { class: 'dt-nav', 'aria-label': 'Tools' }, [track]);
    }
  };
})();
