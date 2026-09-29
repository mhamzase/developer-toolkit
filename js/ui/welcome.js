/**
 * File: js/ui/welcome.js
 * Module: UI — Welcome
 * Purpose: One-time first-run welcome screen.
 * Notes:
 *   - Only shows once (persisted in chrome.storage).
 *   - Uses inline styles for visibility (no [hidden] conflicts).
 *   - Idempotent: safe if init() is called more than once.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  const SEEN_KEY = 'dt:welcomeSeen';

  let overlay = null;
  let isOpen = false;
  let initialized = false;

  const ICON_SPARKLE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3v3"/>' +
      '<path d="M12 18v3"/>' +
      '<path d="M3 12h3"/>' +
      '<path d="M18 12h3"/>' +
      '<path d="m5.6 5.6 2.1 2.1"/>' +
      '<path d="m16.3 16.3 2.1 2.1"/>' +
      '<path d="m5.6 18.4 2.1-2.1"/>' +
      '<path d="m16.3 7.7 2.1-2.1"/>' +
    '</svg>';

  /* ---------------- Build ---------------- */

  function build() {
    /* Remove any orphan welcome overlays */
    document.querySelectorAll('.dt-welcome').forEach(function (el) { el.remove(); });

    const dom = DT.ui.dom;

    /* Hero */
    const heroIcon = dom.svg(ICON_SPARKLE);
    const heroIconWrap = dom.el('div', { class: 'dt-welcome__hero-icon' });
    if (heroIcon) heroIconWrap.appendChild(heroIcon);

    const hero = dom.el('div', { class: 'dt-welcome__hero' }, [
      heroIconWrap,
      dom.el('div', { class: 'dt-welcome__hero-text' }, [
        dom.el('div', { class: 'dt-welcome__title', text: 'Welcome to Developer Toolkit' }),
        dom.el('div', { class: 'dt-welcome__subtitle', text: '16 tools. All local. No tracking. No sign-up.' })
      ])
    ]);

    /* Feature list */
    const features = [
      ['🔒', 'Everything runs in your browser', 'Nothing is ever sent anywhere.'],
      ['⚡', 'Press Ctrl + K to jump anywhere', 'Search tools and open them instantly.'],
      ['⭐', 'Pin your favorites', 'Hover a card and click the star.'],
      ['?', 'Press ? for shortcuts', 'See all keyboard shortcuts anytime.']
    ];

    const featureList = dom.el('div', { class: 'dt-welcome__features' });
    features.forEach(function (f) {
      featureList.appendChild(dom.el('div', { class: 'dt-welcome__feature' }, [
        dom.el('span', { class: 'dt-welcome__feature-icon', text: f[0] }),
        dom.el('div', { class: 'dt-welcome__feature-text' }, [
          dom.el('div', { class: 'dt-welcome__feature-title', text: f[1] }),
          dom.el('div', { class: 'dt-welcome__feature-desc', text: f[2] })
        ])
      ]));
    });

    /* Theme picker */
    const themeLight = dom.el('button', {
      type: 'button',
      class: 'dt-welcome__theme-btn',
      'data-theme': 'light'
    }, [
      dom.el('div', { class: 'dt-welcome__theme-swatch dt-welcome__theme-swatch--light' }),
      dom.el('div', { class: 'dt-welcome__theme-label', text: 'Light' })
    ]);

    const themeDark = dom.el('button', {
      type: 'button',
      class: 'dt-welcome__theme-btn',
      'data-theme': 'dark'
    }, [
      dom.el('div', { class: 'dt-welcome__theme-swatch dt-welcome__theme-swatch--dark' }),
      dom.el('div', { class: 'dt-welcome__theme-label', text: 'Dark' })
    ]);

    function paintThemeSelection() {
      const current = DT.core.theme.current;
      themeLight.classList.toggle('dt-welcome__theme-btn--on', current === 'light');
      themeDark.classList.toggle('dt-welcome__theme-btn--on', current === 'dark');
    }

    themeLight.addEventListener('click', function () {
      DT.core.theme.set('light');
      paintThemeSelection();
    });
    themeDark.addEventListener('click', function () {
      DT.core.theme.set('dark');
      paintThemeSelection();
    });

    const themeRow = dom.el('div', { class: 'dt-welcome__theme-row' }, [
      dom.el('div', { class: 'dt-welcome__theme-label-text', text: 'Choose your theme' }),
      dom.el('div', { class: 'dt-welcome__theme-options' }, [themeLight, themeDark])
    ]);

    paintThemeSelection();

    /* Actions */
    const btnStart = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--primary dt-btn--lg',
      text: 'Get started'
    });

    const actions = dom.el('div', { class: 'dt-welcome__actions' }, [btnStart]);

    /* Panel */
    const panel = dom.el('div', {
      class: 'dt-welcome__panel',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Welcome to Developer Toolkit',
      tabindex: '-1'
    }, [hero, featureList, themeRow, actions]);

    /* Overlay */
    const ov = dom.el('div', { class: 'dt-welcome' }, [panel]);
    ov.style.display = 'none';
    ov.style.pointerEvents = 'none';

    /* Close on Get Started */
    btnStart.addEventListener('click', function () {
      close(true);
    });

    /* Close on click outside (also mark as seen) */
    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) close(true);
    });

    /* Escape closes */
    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(true);
      }
    });

    document.body.appendChild(ov);
    return ov;
  }

  /* ---------------- Open / close ---------------- */

  function open() {
    if (isOpen) return;

    if (!overlay || !document.body.contains(overlay)) {
      overlay = build();
    }

    isOpen = true;
    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';

    requestAnimationFrame(function () {
      if (!overlay) return;
      overlay.classList.add('dt-welcome--open');
      const panel = overlay.querySelector('.dt-welcome__panel');
      if (panel) panel.focus();
    });
  }

  function close(markSeen) {
    if (!isOpen || !overlay) return;
    isOpen = false;

    overlay.classList.remove('dt-welcome--open');
    overlay.style.pointerEvents = 'none';

    setTimeout(function () {
      if (overlay) overlay.style.display = 'none';
    }, 200);

    if (markSeen) {
      DT.core.storage.set(SEEN_KEY, true);
    }
  }

  /* ---------------- Public ---------------- */

  DT.ui.welcome = {
    /** Show the welcome screen only on first run. */
    init: function () {
      if (initialized) return;
      initialized = true;

      /* Clean up orphan overlays from previous boots */
      document.querySelectorAll('.dt-welcome').forEach(function (el) { el.remove(); });

      DT.core.storage.get(SEEN_KEY, false).then(function (seen) {
        if (!seen) {
          /* Small delay so the shell finishes rendering first */
          setTimeout(open, 200);
        }
      });
    },

    open: open,
    close: close,
    isOpen: function () { return isOpen; },

    /** Manually re-show the welcome (useful for testing). */
    reset: function () {
      DT.core.storage.remove(SEEN_KEY).then(function () {
        console.log('[DT] Welcome will show on next open.');
      });
    }
  };
})();