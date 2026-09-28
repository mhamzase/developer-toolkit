/**
 * File: js/ui/toast.js
 * Module: UI — Toast
 * Purpose: Single-at-a-time toast notifications with deduplication.
 *
 * Behavior:
 *   - Only ONE toast is visible at a time.
 *   - If the same message + type fires again while visible,
 *     the timer is reset (no flicker, no duplicate).
 *   - If a different message arrives, the current toast is
 *     dismissed immediately and the new one replaces it.
 *   - Click a toast to dismiss it early.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  /* ---------------- Internal state ---------------- */
  let current = null;        // { node, message, type }
  let removeTimer = null;    // setTimeout handle for auto-dismiss

  function host() {
    return document.getElementById('dt-toasts');
  }

  /* ---------------- Core dismiss ---------------- */

  /**
   * Dismiss the currently visible toast with an out animation.
   * Safe to call when nothing is visible.
   */
  function dismissCurrent() {
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimer = null;
    }

    if (!current) return;

    const node = current.node;
    current = null;

    if (!node || !node.parentNode) return;

    node.classList.add('dt-toast--out');
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 200);
  }

  /* ---------------- Show ---------------- */

  /**
   * Show a toast.
   * @param {string} message
   * @param {'info'|'success'|'error'} [type]
   * @param {number} [duration] — ms
   */
  function show(message, type, duration) {
    type = type || 'info';
    duration = duration || 2600;

    const container = host();
    if (!container) return;

    /* Same message + type as the one currently showing?
       Just extend its timer — do NOT create a new node. */
    if (current &&
        current.message === message &&
        current.type === type) {
      if (removeTimer) clearTimeout(removeTimer);
      removeTimer = setTimeout(dismissCurrent, duration);
      return;
    }

    /* Different content — replace the current toast. */
    dismissCurrent();

    /* Build new toast node */
    const dot  = DT.ui.dom.el('span', { class: 'dt-toast__dot' });
    const text = DT.ui.dom.el('span', { text: message });
    const node = DT.ui.dom.el('div', {
      class: 'dt-toast dt-toast--' + type,
      role: 'status'
    }, [dot, text]);

    container.appendChild(node);

    current = { node: node, message: message, type: type };

    /* Auto-dismiss */
    removeTimer = setTimeout(dismissCurrent, duration);

    /* Click to dismiss early */
    node.addEventListener('click', dismissCurrent);
  }

  /* ---------------- Public API ---------------- */

  DT.ui.toast = {
    show:    show,
    info:    function (m, d) { show(m, 'info', d); },
    success: function (m, d) { show(m, 'success', d); },
    error:   function (m, d) { show(m, 'error', d); },
    dismiss: dismissCurrent
  };
})();