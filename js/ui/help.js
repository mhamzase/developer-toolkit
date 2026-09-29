/**
 * File: js/ui/help.js
 * Module: UI — Help Overlay
 * Purpose: Keyboard shortcut reference overlay. Opens on "?" key.
 * Notes:
 *   - Idempotent: safe to call init() or open() multiple times.
 *   - Enforces visibility with explicit display style.
 *   - Cleans any orphan overlays from previous builds.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let overlay = null;
  let isOpen = false;
  let prevActive = null;
  let initialized = false;

  const GROUPS = [
    {
      label: 'Global',
      rows: [
        { keys: ['Ctrl', 'K'],   action: 'Open command palette', mac: ['⌘', 'K'] },
        { keys: ['/'],           action: 'Open command palette (from home)' },
        { keys: ['?'],           action: 'Show this help' },
        { keys: ['Esc'],         action: 'Close overlay / cancel' }
      ]
    },
    {
      label: 'Command palette',
      rows: [
        { keys: ['↑', '↓'],  action: 'Navigate results' },
        { keys: ['Enter'],   action: 'Open selected tool' },
        { keys: ['Esc'],     action: 'Close palette' }
      ]
    },
    {
      label: 'Inside tools',
      rows: [
        { keys: ['Ctrl', 'Enter'],           action: 'Run primary action (where available)' },
        { keys: ['Ctrl', 'Shift', 'Enter'],  action: 'Run secondary action (Base64 / URL decode)' },
        { keys: ['Ctrl', 'Shift', 'E'],      action: 'Pick color from screen (Color tool)' }
      ]
    },
    {
      label: 'Grid',
      rows: [
        { keys: ['Click'], action: 'Open tool' },
        { keys: ['★'],     action: 'Pin / unpin tool to favorites' }
      ]
    }
  ];

  const ICON_CLOSE =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="18" y1="6" x2="6" y2="18"/>' +
      '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '</svg>';

  /* ---------------- Helpers ---------------- */

  function isMac() {
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }

  function keyChip(text) {
    return DT.ui.dom.el('span', { class: 'dt-kbd', text: text });
  }

  function buildKeys(row) {
    const dom = DT.ui.dom;
    const wrap = dom.el('div', { class: 'dt-help__keys' });
    const useMac = isMac() && row.mac;
    const keys = useMac ? row.mac : row.keys;

    keys.forEach(function (k, i) {
      wrap.appendChild(keyChip(k));
      if (i < keys.length - 1) {
        wrap.appendChild(dom.el('span', { class: 'dt-help__plus', text: '+' }));
      }
    });

    return wrap;
  }

  function buildGroup(group) {
    const dom = DT.ui.dom;

    const rows = group.rows.map(function (row) {
      return dom.el('div', { class: 'dt-help__row' }, [
        buildKeys(row),
        dom.el('div', { class: 'dt-help__action', text: row.action })
      ]);
    });

    return dom.el('div', { class: 'dt-help__group' }, [
      dom.el('div', { class: 'dt-help__group-label', text: group.label }),
      dom.el('div', { class: 'dt-help__group-body' }, rows)
    ]);
  }

  /* ---------------- Build (idempotent) ---------------- */

  function build() {
    /* Remove ALL existing help overlays before building a fresh one.
       This prevents duplicates if build() ever gets called twice. */
    document.querySelectorAll('.dt-help').forEach(function (el) { el.remove(); });

    const dom = DT.ui.dom;

    const title = dom.el('div', { class: 'dt-help__title', text: 'Keyboard shortcuts' });

    const closeBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm',
      'aria-label': 'Close',
      title: 'Close (Esc)'
    });
    const closeIcon = dom.svg(ICON_CLOSE);
    if (closeIcon) closeBtn.appendChild(closeIcon);

    const header = dom.el('div', { class: 'dt-help__head' }, [title, closeBtn]);

    const body = dom.el('div', { class: 'dt-help__body' });
    GROUPS.forEach(function (g) { body.appendChild(buildGroup(g)); });

    const footer = dom.el('div', { class: 'dt-help__foot' }, [
      dom.el('span', { class: 'dt-help__foot-text', text: 'Press' }),
      keyChip('?'),
      dom.el('span', { class: 'dt-help__foot-text', text: 'anytime to open this' })
    ]);

    const panel = dom.el('div', {
      class: 'dt-help__panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Keyboard shortcuts',
      tabindex: '-1'
    }, [header, body, footer]);

    const ov = dom.el('div', { class: 'dt-help' }, [panel]);

    /* Start hidden — set inline style so no CSS rule can override it */
    ov.style.display = 'none';
    ov.style.pointerEvents = 'none';

    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) close();
    });

    closeBtn.addEventListener('click', close);

    document.body.appendChild(ov);
    return ov;
  }

  /* ---------------- Open / close ---------------- */

  function open() {
    if (isOpen) return;

    /* Always ensure we have exactly one overlay */
    if (!overlay || !document.body.contains(overlay)) {
      overlay = build();
    }

    isOpen = true;
    prevActive = document.activeElement;

    /* Show: inline styles win over any stylesheet */
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';

    requestAnimationFrame(function () {
      if (!overlay) return;
      overlay.classList.add('dt-help--open');
      const panel = overlay.querySelector('.dt-help__panel');
      if (panel) panel.focus();
    });
  }

  function close() {
    if (!isOpen || !overlay) return;
    isOpen = false;

    overlay.classList.remove('dt-help--open');

    /* Immediately disable interaction so it can't block clicks */
    overlay.style.pointerEvents = 'none';

    /* After the fade-out completes, fully hide it */
    setTimeout(function () {
      if (overlay) {
        overlay.style.display = 'none';
      }
      if (prevActive && typeof prevActive.focus === 'function') {
        try { prevActive.focus(); } catch (e) { /* ignore */ }
      }
      prevActive = null;
    }, 180);
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  /* ---------------- Global key handler ---------------- */

  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function handleKey(e) {
    const isQuestion =
      e.key === '?' ||
      (e.key === '/' && e.shiftKey);

    if (isQuestion && !isEditable(e.target) &&
        !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }

    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      close();
    }
  }

  /* ---------------- Public API ---------------- */

  DT.ui.help = {
    init: function () {
      if (initialized) return;
      initialized = true;

      /* Clean any orphan overlays left over from earlier sessions/builds */
      document.querySelectorAll('.dt-help').forEach(function (el) { el.remove(); });

      document.addEventListener('keydown', handleKey, true);
    },
    open: open,
    close: close,
    toggle: toggle,
    isOpen: function () { return isOpen; }
  };
})();