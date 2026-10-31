/**
 * File: js/ui/panel.js
 * Module: UI — Panel Kit (Phase 2A: one frame for every tool)
 * Purpose: The shared building blocks every tool screen is made of,
 *          so all tools look and behave the same way:
 *   - head(title, actions)     standard panel header
 *   - stats() + paintStats()   one stats format everywhere:
 *                              "N chars · M lines" (+ words on request)
 *   - bindStats(textarea)      stats element that updates itself
 *   - pasteBtn(textarea, fn)   standard Paste button for input heads
 *   - wrapBtn(textarea)        standard Wrap on/off toggle for outputs
 *   - error()                  the one inline error box (dt-alert--error)
 *                              which also marks its panel with a red frame
 * Notes: Buttons are small ghost/secondary buttons matching the
 *        existing dt-btn styles. Clipboard reads can be denied by
 *        the browser; failures fall back to a friendly toast.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  function countLines(text) {
    if (!text) return 0;
    let n = 1;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return n;
  }

  function countWords(text) {
    if (!text) return 0;
    const m = String(text).match(/[\p{L}\p{N}\p{M}]+/gu);
    return m ? m.length : 0;
  }

  DT.ui.panel = {
    /** Standard panel header: title on the left, actions on the right. */
    head: function (title, actions) {
      const dom = DT.ui.dom;
      const kids = [dom.el('div', { class: 'dt-panel__title', text: title })];
      if (actions && actions.length) {
        kids.push(dom.el('div', { class: 'dt-panel__actions' }, actions));
      }
      return dom.el('div', { class: 'dt-panel__head' }, kids);
    },

    /** Empty stats element for a panel foot (or head). */
    stats: function () {
      const el = DT.ui.dom.el('div', { class: 'dt-panel__stats', text: '0 chars · 0 lines' });
      return el;
    },

    /**
     * Paint stats in the one shared format.
     * @param {HTMLElement} el
     * @param {string} text
     * @param {{words?:boolean}} [opts]
     */
    paintStats: function (el, text, opts) {
      if (!el) return;
      const t = text || '';
      let out = t.length + ' chars · ' + countLines(t) + ' lines';
      if (opts && opts.words) out += ' · ' + countWords(t) + ' words';
      el.textContent = out;
    },

    /**
     * Stats element that follows a textarea/input on its own.
     * The caller still owns removing the listener (tools track their
     * listeners in unmount); this helper returns both parts.
     */
    bindStats: function (field, opts) {
      const el = DT.ui.panel.stats();
      const paint = function () { DT.ui.panel.paintStats(el, field.value, opts); };
      field.addEventListener('input', paint);
      paint();
      return { el: el, paint: paint, dispose: function () { field.removeEventListener('input', paint); } };
    },

    /**
     * Paste button: reads the clipboard into a field, then calls
     * after(text) so the tool can refresh its own state.
     */
    pasteBtn: function (field, after) {
      const dom = DT.ui.dom;
      const btn = dom.el('button', {
        type: 'button',
        class: 'dt-btn dt-btn--ghost dt-btn--sm',
        text: 'Paste',
        title: 'Paste from clipboard'
      });
      btn.addEventListener('click', function () {
        if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
          DT.ui.toast.info('Clipboard paste is not available here, use Ctrl+V');
          field.focus();
          return;
        }
        navigator.clipboard.readText().then(function (text) {
          field.value = text || '';
          field.dispatchEvent(new window.Event('input', { bubbles: true }));
          field.focus();
          if (typeof after === 'function') after(field.value);
        }).catch(function () {
          DT.ui.toast.info('Could not read the clipboard, use Ctrl+V');
          field.focus();
        });
      });
      return btn;
    },

    /**
     * Wrap toggle for an output textarea. Starts ON (soft wrap);
     * pressing it switches the textarea to no-wrap (horizontal
     * scroll) and marks the button pressed.
     */
    wrapBtn: function (field) {
      const dom = DT.ui.dom;
      const btn = dom.el('button', {
        type: 'button',
        class: 'dt-btn dt-btn--ghost dt-btn--sm dt-panel__wrap-btn',
        text: 'Wrap',
        title: 'Toggle soft wrap',
        'aria-pressed': 'true'
      });
      btn.addEventListener('click', function () {
        const off = field.getAttribute('data-wrap') === 'off';
        if (off) {
          field.removeAttribute('data-wrap');
          btn.setAttribute('aria-pressed', 'true');
          btn.classList.remove('dt-panel__wrap-btn--off');
        } else {
          field.setAttribute('data-wrap', 'off');
          btn.setAttribute('aria-pressed', 'false');
          btn.classList.add('dt-panel__wrap-btn--off');
        }
      });
      return btn;
    },

    /**
     * The one inline error box. show() renders the shared alert
     * style and, when a panel element is given, frames that panel
     * in the danger color until clear() runs.
     * @param {HTMLElement} [panelEl]
     */
    error: function (panelEl) {
      const dom = DT.ui.dom;
      const el = dom.el('div', { class: 'dt-panel__error', role: 'alert' });
      el.style.display = 'none';
      return {
        el: el,
        show: function (title, message) {
          DT.ui.dom.clear(el);
          const kids = [];
          if (title) kids.push(dom.el('div', { style: { fontWeight: '600' }, text: title }));
          if (message) kids.push(dom.el('div', { text: message }));
          el.appendChild(dom.el('div', { class: 'dt-alert dt-alert--error' }, kids));
          el.style.display = '';
          if (panelEl) panelEl.classList.add('dt-panel--error');
        },
        clear: function () {
          DT.ui.dom.clear(el);
          el.style.display = 'none';
          if (panelEl) panelEl.classList.remove('dt-panel--error');
        }
      };
    },

    /** Right-aligned keyboard hint for a panel foot, e.g. "Ctrl+Enter to format". */
    hint: function (text) {
      return DT.ui.dom.el('span', { class: 'dt-panel__hint', text: text });
    }
  };
})();
