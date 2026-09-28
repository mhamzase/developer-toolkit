/**
 * File: js/ui/palette.js
 * Module: UI — Command Palette
 * Purpose: Centered overlay for quick tool jumping via keyboard.
 * Shortcut: Ctrl+K / Cmd+K to open. Arrow keys + Enter + Escape.
 * Notes: Mounted once at app init. Global listener via document keydown.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let root = null;          // overlay root (created once)
  let input = null;
  let listEl = null;
  let emptyEl = null;
  let selectedIndex = 0;
  let results = [];
  let isOpen = false;
  let prevActive = null;    // for focus restore

  const MAX_RESULTS = 30;

  /* ---------------- Icons ---------------- */

  const ICON_SEARCH =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-palette__search-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="11" cy="11" r="7"/>' +
      '<line x1="21" y1="21" x2="16.65" y2="16.65"/>' +
    '</svg>';

  /* ---------------- Build ---------------- */

  function buildOverlay() {
    const dom = DT.ui.dom;

    /* Input wrapper */
    const searchIcon = dom.svg(ICON_SEARCH);

    input = dom.el('input', {
      type: 'text',
      class: 'dt-palette__input',
      id: 'dt-palette-input',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Search tools…'
    });

    const inputRow = dom.el('div', { class: 'dt-palette__input-row' },
      searchIcon ? [searchIcon, input] : [input]
    );

    /* Results list */
    listEl = dom.el('div', { class: 'dt-palette__list', id: 'dt-palette-list', role: 'listbox' });

    /* Empty state */
    emptyEl = dom.el('div', { class: 'dt-palette__empty', style: { display: 'none' } }, [
      dom.el('div', { class: 'dt-palette__empty-title', text: 'No tools found' }),
      dom.el('div', { class: 'dt-palette__empty-hint', text: 'Try a different search term.' })
    ]);

    /* Panel */
    const panel = dom.el('div', {
      class: 'dt-palette__panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Tool command palette'
    }, [inputRow, listEl, emptyEl]);

    /* Overlay */
    root = dom.el('div', {
      class: 'dt-palette',
      id: 'dt-palette',
      hidden: 'hidden'
    }, [panel]);

    /* Click on backdrop closes */
    root.addEventListener('mousedown', function (e) {
      if (e.target === root) close();
    });

    /* Click on a result */
    listEl.addEventListener('click', function (e) {
      const item = e.target.closest('.dt-palette__item');
      if (!item) return;
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx)) {
        selectedIndex = idx;
        confirm();
      }
    });

    /* Hover highlights */
    listEl.addEventListener('mousemove', function (e) {
      const item = e.target.closest('.dt-palette__item');
      if (!item) return;
      const idx = parseInt(item.dataset.index, 10);
      if (!isNaN(idx) && idx !== selectedIndex) {
        selectedIndex = idx;
        paintSelection();
      }
    });

    /* Input events */
    input.addEventListener('input', function () {
      refresh();
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        confirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'Tab') {
        // Trap focus inside the palette
        e.preventDefault();
      }
    });

    document.body.appendChild(root);
  }

  /* ---------------- Query ---------------- */

  function buildResults(query) {
    const q = String(query || '').trim().toLowerCase();
    const all = DT.core.registry.all();

    if (!q) {
      // Empty query: favorites first, then recents, then rest (alphabetical)
      const favIds = DT.core.prefs.getFavorites();
      const recIds = DT.core.prefs.getRecents();
      const byId = {};
      all.forEach(function (t) { byId[t.id] = t; });

      const favs = favIds.map(function (id) { return byId[id]; }).filter(Boolean);
      const recs = recIds.map(function (id) { return byId[id]; }).filter(Boolean);
      const rest = all.filter(function (t) {
        return favIds.indexOf(t.id) === -1 && recIds.indexOf(t.id) === -1;
      });

      return favs.concat(recs).concat(rest).slice(0, MAX_RESULTS);
    }

    // Filter by name/description/category
    return all.filter(function (t) {
      return (
        t.name.toLowerCase().indexOf(q) !== -1 ||
        (t.description || '').toLowerCase().indexOf(q) !== -1 ||
        (t.category || '').toLowerCase().indexOf(q) !== -1
      );
    }).slice(0, MAX_RESULTS);
  }

  /* ---------------- Rendering ---------------- */

  function refresh() {
    results = buildResults(input.value);

    if (!results.length) {
      listEl.style.display = 'none';
      emptyEl.style.display = '';
      listEl.innerHTML = '';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = '';

    const dom = DT.ui.dom;
    dom.clear(listEl);

    selectedIndex = 0;

    results.forEach(function (tool, i) {
      const iconNode = DT.utils.icons.get(tool.icon);
      const iconWrap = dom.el('div', { class: 'dt-palette__item-icon' });
      if (iconNode) iconWrap.appendChild(iconNode);

      const isFav = DT.core.prefs.isFavorite(tool.id);

      const item = dom.el('div', {
        class: 'dt-palette__item' + (i === 0 ? ' dt-palette__item--selected' : '') + (isFav ? ' dt-palette__item--fav' : ''),
        role: 'option',
        'data-index': String(i),
        'data-tool-id': tool.id,
        'aria-selected': i === 0 ? 'true' : 'false'
      }, [
        iconWrap,
        dom.el('div', { class: 'dt-palette__item-main' }, [
          dom.el('div', { class: 'dt-palette__item-name', text: tool.name }),
          dom.el('div', { class: 'dt-palette__item-desc', text: tool.description || '' })
        ]),
        dom.el('div', { class: 'dt-palette__item-meta' }, [
          dom.el('span', { class: 'dt-palette__item-cat', text: tool.category || '' })
        ])
      ]);

      listEl.appendChild(item);
    });

    scrollSelectionIntoView();
  }

  function paintSelection() {
    const dom = DT.ui.dom;
    const items = dom.qsa('.dt-palette__item', listEl);
    items.forEach(function (el, i) {
      const on = i === selectedIndex;
      el.classList.toggle('dt-palette__item--selected', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    scrollSelectionIntoView();
  }

  function scrollSelectionIntoView() {
    const dom = DT.ui.dom;
    const el = dom.qs('.dt-palette__item--selected', listEl);
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function moveSelection(delta) {
    if (!results.length) return;
    selectedIndex = (selectedIndex + delta + results.length) % results.length;
    paintSelection();
  }

  function confirm() {
    const tool = results[selectedIndex];
    if (!tool) return;
    openTool(tool.id);
  }

  function openTool(toolId) {
    close();
    DT.core.prefs.recordRecent(toolId);
    DT.core.router.go('tool', { toolId: toolId });
  }

  /* ---------------- Open / close ---------------- */

  function open() {
    if (isOpen) return;
    isOpen = true;

    prevActive = document.activeElement;

    root.hidden = false;
    root.classList.add('dt-palette--open');

    input.value = '';
    refresh();

    // Focus input after overlay paint
    requestAnimationFrame(function () {
      input.focus();
      input.select();
    });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    root.classList.remove('dt-palette--open');
    root.hidden = true;

    // Restore focus
    if (prevActive && typeof prevActive.focus === 'function') {
      try { prevActive.focus(); } catch (e) { /* ignore */ }
    }
    prevActive = null;
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  /* ---------------- Global keyboard ---------------- */

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function handleGlobalKey(e) {
    // Ctrl+K / Cmd+K → toggle palette
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }

    // Escape from anywhere → close if open
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
      return;
    }

    // "/" when not typing → open palette too (nice extra)
    if (e.key === '/' && !isOpen && !isEditable(e.target) &&
        !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      open();
    }
  }

  /* ---------------- Public API ---------------- */

  DT.ui.palette = {
    /** Build the palette once and wire the global shortcut. */
    init: function () {
      if (root) return; // already built
      buildOverlay();
      document.addEventListener('keydown', handleGlobalKey, true);
    },

    open: open,
    close: close,
    toggle: toggle,

    isOpen: function () { return isOpen; }
  };
})();