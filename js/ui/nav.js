/**
 * File: js/ui/nav.js
 * Module: UI — Navigation (sidebar)
 * Purpose: Sidebar navigation for the Clean Pro shell.
 *   - "All Tools" home item with the total count
 *   - Favorites group (only when the user has favorites)
 *   - One group per category: the group label opens the filtered
 *     home grid, each tool item opens the tool directly, so any
 *     tool is reachable in one click from anywhere in the app.
 * Notes: Router changes update only the active highlight in
 * place; a repaint happens when the favorites set changes, and
 * it preserves the sidebar scroll position.
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
        const labelAttrs = {
          type: opts.onClick ? 'button' : undefined,
          class: 'dt-side-group__label' + (opts.active ? ' dt-side-group__label--active' : '')
        };
        if (opts.slug) labelAttrs['data-cat-slug'] = opts.slug;
        const label = dom.el(opts.onClick ? 'button' : 'div', labelAttrs, children);
        if (opts.onClick) label.addEventListener('click', opts.onClick);
        return label;
      }

      let favSignature = null;

      function paint() {
        const scroller = track.parentElement;
        const savedScroll = scroller ? scroller.scrollTop : 0;
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
          'data-nav-home': '1',
          class: 'dt-side-item dt-side-item--home' +
            (state.view === 'list' && state.filter === 'All' ? ' dt-side-item--active' : ''),
          title: 'All tools'
        }, [
          homeIconWrap,
          dom.el('span', { class: 'dt-side-item__label', text: 'All Tools' })
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
            groupLabel('Favorites')
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
              slug: DT.core.registry.categorySlug(cat),
              active: state.view === 'list' && state.filter === cat,
              onClick: function () { DT.core.router.go('list', { filter: cat }); }
            })
          ]);
          tools.forEach(function (t) { group.appendChild(toolItem(t, activeToolId)); });
          track.appendChild(group);
        });
        if (scroller) scroller.scrollTop = savedScroll;
        favSignature = DT.core.prefs.getFavorites().join(',');
      }

      /**
       * Route changes only move the highlight. Rebuilding the whole
       * sidebar for that destroyed the clicked button (focus loss)
       * and reset the scroll position, so update classes in place.
       */
      function updateActive() {
        if (!track.children.length) { paint(); return; }
        const state = DT.core.router.state;
        const activeToolId = state.view === 'tool' ? state.toolId : null;
        track.querySelectorAll('.dt-side-item').forEach(function (item) {
          let active = false;
          if (item.hasAttribute('data-nav-home')) {
            active = state.view === 'list' && state.filter === 'All';
          } else if (item.hasAttribute('data-tool-id')) {
            active = item.getAttribute('data-tool-id') === activeToolId;
          }
          item.classList.toggle('dt-side-item--active', active);
        });
        const activeSlug = state.view === 'list'
          ? DT.core.registry.categorySlug(state.filter)
          : null;
        track.querySelectorAll('[data-cat-slug]').forEach(function (label) {
          label.classList.toggle(
            'dt-side-group__label--active',
            label.getAttribute('data-cat-slug') === activeSlug
          );
        });
      }

      /* Router changes move only the highlight. Of the prefs
         changes, only the favorites set alters the sidebar
         structure; recents updates (fired on every tool open) are
         ignored here, and a favorites repaint preserves scroll. */
      DT.core.router.on(function () { updateActive(); });
      DT.core.prefs.on(function () {
        if (DT.core.prefs.getFavorites().join(',') !== favSignature) paint();
      });
      paint();

      return dom.el('nav', { class: 'dt-nav', 'aria-label': 'Tools' }, [track]);
    }
  };
})();
