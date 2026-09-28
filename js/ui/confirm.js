/**
 * File: js/ui/confirm.js
 * Module: UI — Confirm Dialog
 * Purpose: Custom confirmation modal (replaces native window.confirm).
 * Usage:
 *   DT.ui.confirm.open({ title, message, confirmText, cancelText, danger })
 *     .then(ok => { ... });
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let overlay = null;
  let resolveFn = null;

  const ICON_DANGER =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
      '<line x1="12" y1="9" x2="12" y2="13"/>' +
      '<line x1="12" y1="17" x2="12.01" y2="17"/>' +
    '</svg>';

  const ICON_INFO =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/>' +
      '<line x1="12" y1="16" x2="12" y2="12"/>' +
      '<line x1="12" y1="8" x2="12.01" y2="8"/>' +
    '</svg>';

  function build() {
    const dom = DT.ui.dom;

    const iconWrap = dom.el('div', { class: 'dt-confirm__icon' });
    const titleEl  = dom.el('div', { class: 'dt-confirm__title' });
    const msgEl    = dom.el('div', { class: 'dt-confirm__message' });

    const cancelBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--secondary',
      text: 'Cancel'
    });

    const confirmBtn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--primary',
      text: 'Confirm'
    });

    const actions = dom.el('div', { class: 'dt-confirm__actions' }, [cancelBtn, confirmBtn]);

    const panel = dom.el('div', {
      class: 'dt-confirm__panel',
      role: 'alertdialog',
      'aria-modal': 'true',
      tabindex: '-1'
    }, [
      dom.el('div', { class: 'dt-confirm__body' }, [
        iconWrap,
        dom.el('div', { class: 'dt-confirm__text' }, [titleEl, msgEl])
      ]),
      actions
    ]);

    const ov = dom.el('div', { class: 'dt-confirm', hidden: 'hidden' }, [panel]);

    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) close(false);
    });

    cancelBtn.addEventListener('click', function () { close(false); });
    confirmBtn.addEventListener('click', function () { close(true); });

    ov.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    });

    ov._titleEl    = titleEl;
    ov._msgEl      = msgEl;
    ov._iconWrap   = iconWrap;
    ov._confirmBtn = confirmBtn;
    ov._cancelBtn  = cancelBtn;
    ov._panel      = panel;

    document.body.appendChild(ov);
    return ov;
  }

  function open(opts) {
    opts = opts || {};

    if (!overlay) overlay = build();
    if (resolveFn) close(false); // safety: close any pending

    /* Content */
    overlay._titleEl.textContent   = opts.title   || 'Are you sure?';
    overlay._msgEl.textContent     = opts.message || '';
    overlay._msgEl.style.display   = opts.message ? '' : 'none';
    overlay._confirmBtn.textContent = opts.confirmText || 'Confirm';
    overlay._cancelBtn.textContent  = opts.cancelText  || 'Cancel';

    /* Icon tone */
    DT.ui.dom.clear(overlay._iconWrap);
    const iconSvg = DT.ui.dom.svg(opts.danger ? ICON_DANGER : ICON_INFO);
    if (iconSvg) overlay._iconWrap.appendChild(iconSvg);
    overlay._iconWrap.classList.toggle('dt-confirm__icon--danger', !!opts.danger);
    overlay._iconWrap.classList.toggle('dt-confirm__icon--info',   !opts.danger);

    /* Confirm button tone */
    overlay._confirmBtn.classList.remove('dt-btn--primary', 'dt-btn--danger-solid');
    overlay._confirmBtn.classList.add(opts.danger ? 'dt-btn--danger-solid' : 'dt-btn--primary');

    /* Show */
    overlay.hidden = false;
    requestAnimationFrame(function () {
      overlay.classList.add('dt-confirm--open');
      overlay._panel.focus();
      /* Focus the safe option (cancel) for danger dialogs */
      (opts.danger ? overlay._cancelBtn : overlay._confirmBtn).focus();
    });

    return new Promise(function (resolve) {
      resolveFn = resolve;
    });
  }

  function close(result) {
    if (!overlay) return;
    const fn = resolveFn;
    resolveFn = null;

    overlay.classList.remove('dt-confirm--open');
    setTimeout(function () { overlay.hidden = true; }, 180);

    if (fn) fn(!!result);
  }

  DT.ui.confirm = {
    open: open,
    isOpen: function () { return !!resolveFn; }
  };
})();