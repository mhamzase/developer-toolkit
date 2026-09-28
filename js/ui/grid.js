/**
 * File: js/ui/grid.js
 * Module: UI — Tool Grid
 * Purpose: Render tool cards for the current filter + query.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  DT.ui.grid = {
    /**
     * Render grid into a container.
     * @param {HTMLElement} mount
     */
    render: function (mount) {
      const dom = DT.ui.dom;
      const state = DT.core.router.state;
      const tools = DT.core.registry.filter({
        filter: state.filter,
        query: state.query
      });

      if (tools.length === 0) {
        mount.appendChild(dom.el('div', { class: 'dt-empty' }, [
          dom.el('div', { class: 'dt-empty__title', text: 'No tools found' }),
          dom.el('div', { class: 'dt-empty__text', text: 'Try a different category or search term.' })
        ]));
        return;
      }

      const grid = dom.el('div', { class: 'dt-grid' });

      tools.forEach(function (tool) {
        const iconNode = DT.utils.icons.get(tool.icon);
        const iconWrap = dom.el('div', { class: 'dt-tool-card__icon-wrap' });
        if (iconNode) iconWrap.appendChild(iconNode);

        const card = dom.el('button', {
          type: 'button',
          class: 'dt-tool-card',
          'data-tool-id': tool.id,
          title: tool.description || tool.name
        }, [
          iconWrap,
          dom.el('div', { class: 'dt-tool-card__title', text: tool.name }),
          dom.el('div', { class: 'dt-tool-card__desc', text: tool.description || '' })
        ]);

        card.addEventListener('click', function () {
          DT.core.router.go('tool', { toolId: tool.id });
        });

        grid.appendChild(card);
      });

      mount.appendChild(grid);
    }
  };
})();