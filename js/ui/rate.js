/**
 * File: js/ui/rate.js
 * Module: UI — Rate prompt (win-ask)
 * Purpose: Ask for a Chrome Web Store rating once, politely, after
 *          the user has had a few successful moments with the tools.
 * Notes:
 *   - A "win" is any success toast (copy, format, generate,
 *     download). Counting hooks DT.ui.toast.success in one place
 *     instead of touching every tool.
 *   - The card is a slim banner above the footer, never a modal:
 *     it cannot interrupt work in progress.
 *   - "Later" snoozes for 14 days and asks for 5 more wins first.
 *     "No thanks" and rating both close the question for good.
 *   - Extension only: this file is loaded by popup.html alone, so
 *     the website build never sees it.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  /* ------------------------------------------------------------
   * Configuration
   * ------------------------------------------------------------ */

  const STORE_REVIEWS_URL =
    'https://chromewebstore.google.com/detail/developer-toolkit-json-jw/fhjlhcecanniahjgnjffdhmfkfikkkdg/reviews';
  const STORAGE_KEY = 'dt:ratePrompt';

  const FIRST_ASK_AT = 3;        /* wins before the first ask */
  const SNOOZE_DAYS = 14;        /* "Later" quiet period */
  const SNOOZE_EXTRA_WINS = 5;   /* extra wins after a snooze */
  const WIN_DEBOUNCE_MS = 1500;  /* rapid-fire toasts count once */
  const SHOW_DELAY_MS = 900;     /* let the success toast land first */

  const ICON_STAR =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-rate__star" ' +
    'viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"/>' +
    '</svg>';

  /* ------------------------------------------------------------
   * State
   * ------------------------------------------------------------ */

  let state = null;          /* persisted shape, see defaultState() */
  let cardEl = null;         /* the banner node while visible */
  let shownThisSession = false;
  let lastWinAt = 0;

  function defaultState() {
    return { wins: 0, nextAskAt: FIRST_ASK_AT, snoozeUntil: 0, status: 'pending' };
  }

  function persist() {
    DT.core.storage.set(STORAGE_KEY, state);
  }

  /* ------------------------------------------------------------
   * Win counting
   * ------------------------------------------------------------ */

  function onWin() {
    if (!state || state.status !== 'pending' || cardEl) return;

    const now = Date.now();
    if (now - lastWinAt < WIN_DEBOUNCE_MS) return;
    lastWinAt = now;

    state.wins += 1;
    persist();

    if (!shownThisSession &&
        state.wins >= state.nextAskAt &&
        now >= state.snoozeUntil) {
      shownThisSession = true;
      setTimeout(showCard, SHOW_DELAY_MS);
    }
  }

  /* Wrap the shared success toast: every tool already reports its
   * wins there, so one hook covers the whole toolkit. */
  function hookToast() {
    const toast = DT.ui.toast;
    if (!toast || typeof toast.success !== 'function' || toast.success.__rateHooked) return;
    const original = toast.success;
    toast.success = function () {
      const result = original.apply(this, arguments);
      onWin();
      return result;
    };
    toast.success.__rateHooked = true;
  }

  /* ------------------------------------------------------------
   * Card
   * ------------------------------------------------------------ */

  function hideCard() {
    if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
    cardEl = null;
  }

  function showCard() {
    if (cardEl || !state || state.status !== 'pending') return;
    const dom = DT.ui.dom;

    const stars = dom.el('div', { class: 'dt-rate__stars', 'aria-hidden': 'true' });
    for (let i = 0; i < 5; i++) {
      const s = dom.el('span', {});
      s.innerHTML = ICON_STAR;
      stars.appendChild(s);
    }

    const copy = dom.el('div', { class: 'dt-rate__copy' }, [
      dom.el('p', { class: 'dt-rate__title', text: 'Enjoying Developer Toolkit by Zase?' }),
      dom.el('p', {
        class: 'dt-rate__text',
        text: 'If these tools save you time, a quick rating on the Chrome Web Store helps other developers discover them.'
      })
    ]);

    const rateBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--primary dt-btn--sm',
      text: 'Rate it'
    });
    rateBtn.addEventListener('click', function () {
      state.status = 'rated';
      persist();
      window.open(STORE_REVIEWS_URL, '_blank', 'noopener');
      hideCard();
    });

    const laterBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--ghost dt-btn--sm',
      text: 'Later'
    });
    laterBtn.addEventListener('click', function () {
      state.snoozeUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      state.nextAskAt = state.wins + SNOOZE_EXTRA_WINS;
      persist();
      hideCard();
    });

    const neverBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--ghost dt-btn--sm',
      text: 'No thanks'
    });
    neverBtn.addEventListener('click', function () {
      state.status = 'never';
      persist();
      hideCard();
    });

    const actions = dom.el('div', { class: 'dt-rate__actions' }, [rateBtn, laterBtn, neverBtn]);

    cardEl = dom.el('section', { class: 'dt-rate', 'aria-label': 'Rate this extension' }, [
      stars, copy, actions
    ]);

    /* Mount as a banner in the content column, just above the
     * footer, so it never covers a tool the user is working in. */
    const footer = document.querySelector('.dt-footer');
    const content = document.querySelector('.dt-content');
    if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(cardEl, footer);
    } else if (content) {
      content.appendChild(cardEl);
    } else {
      document.body.appendChild(cardEl);
    }
  }

  /* ------------------------------------------------------------
   * Public API
   * ------------------------------------------------------------ */

  DT.ui.rate = {
    init: function () {
      if (!DT.core.storage || !DT.ui.toast) return;
      DT.core.storage.get(STORAGE_KEY, null).then(function (saved) {
        state = saved && typeof saved === 'object'
          ? Object.assign(defaultState(), saved)
          : defaultState();
        if (state.status === 'pending') hookToast();
      });
    }
  };
})();
