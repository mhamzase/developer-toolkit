/**
 * File: js/ui/nav.js
 * Module: UI — Navigation
 * Purpose: Category tabs. Re-renders on router state change.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  DT.ui.nav = {
    render: function () {
      const dom = DT.ui.dom;
      const cats = DT.core.registry.categories();
      const track = dom.el('div', { class: 'dt-nav__track' });

      function paint() {
        dom.clear(track);
        const current = DT.core.router.state.filter;
        cats.forEach(function (cat) {
          const selected = current === cat;
          const tab = dom.el('button', {
            type: 'button',
            class: 'dt-tab',
            'aria-selected': selected ? 'true' : 'false',
            text: cat
          });
          tab.addEventListener('click', function () {
            DT.core.router.setFilter(cat);
          });
          track.appendChild(tab);
        });
      }

      // Repaint when filter changes (including via search or programmatic)
      DT.core.router.on(function () { paint(); });
      paint();

      return dom.el('nav', { class: 'dt-nav', 'aria-label': 'Tool categories' }, [track]);
    }
  };
})();