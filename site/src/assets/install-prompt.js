/**
 * File: site/src/assets/install-prompt.js
 * Purpose: Website twin of the extension's win-ask rate prompt.
 *          After a visitor has had a few successful moments with
 *          the web tools, a slim floating card invites them to add
 *          the free Chrome extension. Tool pages only: build.mjs
 *          adds this script to tool pages alone.
 * Notes:
 *   - A "win" is any success toast, counted by wrapping
 *     DT.ui.toast.success once, exactly like the extension does.
 *   - Wins persist across tool pages in localStorage, so using
 *     three different tools still counts as three wins.
 *   - "Later" snoozes for 14 days and asks for 5 more wins.
 *     "No thanks" and clicking through to the store end it.
 *   - Chromium browsers only: the store button cannot work in
 *     Firefox or Safari, so the card never appears there.
 */
(function () {
  'use strict';

  var STORE_URL =
    'https://chromewebstore.google.com/detail/developer-toolkit-json-jw/fhjlhcecanniahjgnjffdhmfkfikkkdg';
  var STORAGE_KEY = 'zase-install-prompt';

  var FIRST_ASK_AT = 3;
  var SNOOZE_DAYS = 14;
  var SNOOZE_EXTRA_WINS = 5;
  var WIN_DEBOUNCE_MS = 1500;
  var SHOW_DELAY_MS = 900;

  /* Chromium gate: Chrome, Edge, Brave and Opera all carry the
   * Chrome token; Firefox and Safari do not. */
  var ua = navigator.userAgent || '';
  if (!/Chrome\//.test(ua) || /Firefox\//.test(ua)) return;

  /* Asset base (this file lives in /site/ next to chrome.svg and
   * the extension icon), derived from our own script URL so the
   * card works from any tool slug depth. */
  var base = '';
  if (document.currentScript && document.currentScript.src) {
    base = document.currentScript.src.replace(/[^/]*$/, '');
  }

  var state = load();
  var cardEl = null;
  var shownThisSession = false;
  var lastWinAt = 0;

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return Object.assign(
            { wins: 0, nextAskAt: FIRST_ASK_AT, snoozeUntil: 0, status: 'pending' },
            parsed
          );
        }
      }
    } catch (e) { /* private mode etc: start fresh */ }
    return { wins: 0, nextAskAt: FIRST_ASK_AT, snoozeUntil: 0, status: 'pending' };
  }

  function persist() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function onWin() {
    if (state.status !== 'pending' || cardEl) return;
    var now = Date.now();
    if (now - lastWinAt < WIN_DEBOUNCE_MS) return;
    lastWinAt = now;

    state.wins += 1;
    persist();

    if (!shownThisSession && state.wins >= state.nextAskAt && now >= state.snoozeUntil) {
      shownThisSession = true;
      setTimeout(showCard, SHOW_DELAY_MS);
    }
  }

  function hookToast() {
    var toast = window.DT && DT.ui && DT.ui.toast;
    if (!toast || typeof toast.success !== 'function' || toast.success.__installHooked) return;
    var original = toast.success;
    toast.success = function () {
      var result = original.apply(this, arguments);
      onWin();
      return result;
    };
    toast.success.__installHooked = true;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function hideCard() {
    if (cardEl && cardEl.parentNode) cardEl.parentNode.removeChild(cardEl);
    cardEl = null;
  }

  function showCard() {
    if (cardEl || state.status !== 'pending') return;

    var icon = el('img', 'z-install__icon');
    icon.src = base + 'icon-96.png';
    icon.alt = '';
    icon.width = 40;
    icon.height = 40;

    var copy = el('div', 'z-install__copy');
    copy.appendChild(el('p', 'z-install__title', 'This tool also runs offline in Chrome'));
    copy.appendChild(el(
      'p',
      'z-install__text',
      'Get all 36 developer tools in the free Zase extension. Nothing you paste ever leaves your device.'
    ));

    var addBtn = el('a', 'z-btn z-btn--accent z-btn--sm', null);
    addBtn.href = STORE_URL;
    addBtn.target = '_blank';
    addBtn.rel = 'noopener';
    var chromeIcon = el('img', 'z-chrome-icon');
    chromeIcon.src = base + 'chrome.svg';
    chromeIcon.alt = '';
    chromeIcon.width = 16;
    chromeIcon.height = 16;
    addBtn.appendChild(chromeIcon);
    addBtn.appendChild(document.createTextNode('Add to Chrome'));
    addBtn.addEventListener('click', function () {
      state.status = 'clicked';
      persist();
      hideCard();
    });

    var laterBtn = el('button', 'z-btn z-btn--ghost z-btn--sm', 'Later');
    laterBtn.type = 'button';
    laterBtn.addEventListener('click', function () {
      state.snoozeUntil = Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      state.nextAskAt = state.wins + SNOOZE_EXTRA_WINS;
      persist();
      hideCard();
    });

    var neverBtn = el('button', 'z-btn z-btn--ghost z-btn--sm', 'No thanks');
    neverBtn.type = 'button';
    neverBtn.addEventListener('click', function () {
      state.status = 'never';
      persist();
      hideCard();
    });

    var actions = el('div', 'z-install__actions');
    actions.appendChild(addBtn);
    actions.appendChild(laterBtn);
    actions.appendChild(neverBtn);

    cardEl = el('section', 'z-install', null);
    cardEl.setAttribute('aria-label', 'Get the Chrome extension');
    cardEl.appendChild(icon);
    cardEl.appendChild(copy);
    cardEl.appendChild(actions);
    document.body.appendChild(cardEl);

    /* Next frame: play the rise-in transition. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (cardEl) cardEl.classList.add('z-install--show');
      });
    });
  }

  if (state.status === 'pending') hookToast();
})();
