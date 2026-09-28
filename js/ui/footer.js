/**
 * File: js/ui/footer.js
 * Module: UI — Footer
 * Purpose: Version, developer credit, GitHub, donate.
 * Notes:
 *   - Brand name lives in the header only (avoid repetition).
 *   - External links open in a new tab.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  /* --------------------------------------------------------------
   * Configuration
   * -------------------------------------------------------------- */
  const VERSION       = '1.0.0';
  const DEVELOPER     = 'Hamza Shabbir';
  const GITHUB_URL    = 'https://github.com/mhamzase';
  const GITHUB_HANDLE = '@mhamzase';
  const DONATE_URL    = 'https://ko-fi.com/your-username'; // update later

  /* --------------------------------------------------------------
   * Icons
   * -------------------------------------------------------------- */

  const ICON_HEART =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' +
    '</svg>';

  const ICON_EXTERNAL =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
      '<polyline points="15 3 21 3 21 9"/>' +
      '<line x1="10" y1="14" x2="21" y2="3"/>' +
    '</svg>';

  const ICON_GITHUB =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
    'viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.236-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.815 1.102.815 2.222 0 1.606-.015 2.898-.015 3.293 0 .32.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>' +
    '</svg>';

  /* --------------------------------------------------------------
   * Render
   * -------------------------------------------------------------- */

  DT.ui.footer = {
    render: function () {
      const dom = DT.ui.dom;

      /* -------- Left side: version only -------- */

      const versionChip = dom.el('span', {
        class: 'dt-footer__version',
        text: 'v' + VERSION
      });

      const left = dom.el('div', { class: 'dt-footer__side' }, [versionChip]);

      /* -------- Right side: credit + github + donate -------- */

      const heartIcon = dom.svg(ICON_HEART);
      const heartWrap = dom.el('span', {
        class: 'dt-footer__heart',
        title: 'Built with care',
        'aria-hidden': 'true'
      }, heartIcon ? [heartIcon] : []);

      const devCredit = dom.el('span', { class: 'dt-footer__credit' }, [
        dom.txt('Developed by '),
        dom.el('span', { class: 'dt-footer__author', text: DEVELOPER }),
        heartWrap
      ]);

      /* GitHub link */
      const githubIcon = dom.svg(ICON_GITHUB);
      const githubBtn = dom.el('a', {
        class: 'dt-btn dt-btn--ghost dt-btn--sm dt-footer__github',
        href: GITHUB_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'GitHub — ' + GITHUB_HANDLE,
        'aria-label': 'Open GitHub profile ' + GITHUB_HANDLE
      }, [
        githubIcon ? githubIcon : dom.txt(''),
        dom.el('span', { class: 'dt-footer__github-text', text: GITHUB_HANDLE })
      ]);

      /* Donate link */
      const donateHeart = dom.svg(ICON_HEART);
      const externalIcon = dom.svg(ICON_EXTERNAL);

      const donateBtn = dom.el('a', {
        class: 'dt-btn dt-btn--primary dt-btn--sm dt-footer__donate',
        href: DONATE_URL,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: 'Support the developer',
        'aria-label': 'Donate to support development'
      }, [
        donateHeart ? donateHeart : dom.txt(''),
        dom.txt('Donate'),
        externalIcon ? externalIcon : dom.txt('')
      ]);

      donateBtn.addEventListener('click', function (e) {
        if (DONATE_URL.indexOf('your-username') !== -1) {
          e.preventDefault();
          DT.ui.toast.info('Donate link not configured yet');
          return;
        }
      });

      const right = dom.el('div', { class: 'dt-footer__side dt-footer__side--right' }, [
        devCredit,
        githubBtn,
        donateBtn
      ]);

      /* -------- Footer -------- */

      return dom.el('footer', { class: 'dt-footer', role: 'contentinfo' }, [left, right]);
    }
  };
})();