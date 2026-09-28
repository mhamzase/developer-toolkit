/**
 * File: js/ui/toast.js
 * Module: UI — Toast
 * Purpose: Single-at-a-time toasts with dedup + optional action button.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let current = null;
  let removeTimer = null;

  function host() { return document.getElementById('dt-toasts'); }

  function dismissCurrent() {
    if (removeTimer) { clearTimeout(removeTimer); removeTimer = null; }
    if (!current) return;
    const node = current.node;
    current = null;
    if (!node || !node.parentNode) return;
    node.classList.add('dt-toast--out');
    setTimeout(function () {
      if (node.parentNode) node.parentNode.removeChild(node);
    }, 200);
  }

  function show(message, type, duration, action) {
    type = type || 'info';
    duration = duration || 2600;

    const container = host();
    if (!container) return;

    const dom = DT.ui.dom;
    const hasAction = !!(action && action.actionText && typeof action.onAction === 'function');

    /* Dedup — same message + type, no action button involved */
    if (current &&
        current.message === message &&
        current.type === type &&
        !hasAction &&
        !current.hasAction) {
      if (removeTimer) clearTimeout(removeTimer);
      removeTimer = setTimeout(dismissCurrent, duration);
      return;
    }

    /* Replace current */
    dismissCurrent();

    const dot  = dom.el('span', { class: 'dt-toast__dot' });
    const text = dom.el('span', { class: 'dt-toast__text', text: message });
    const kids = [dot, text];

    let actionBtn = null;
    if (hasAction) {
      actionBtn = dom.el('button', {
        type: 'button',
        class: 'dt-toast__action',
        text: action.actionText
      });
      kids.push(actionBtn);
    }

    const node = dom.el('div', {
      class: 'dt-toast dt-toast--' + type,
      role: 'status'
    }, kids);

    container.appendChild(node);
    current = { node: node, message: message, type: type, hasAction: hasAction };

    if (actionBtn) {
      actionBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        try { action.onAction(); } catch (err) { console.error('[DT toast action]', err); }
        dismissCurrent();
      });
    }

    if (!hasAction) {
      removeTimer = setTimeout(dismissCurrent, duration);
      node.addEventListener('click', dismissCurrent);
    } else {
      /* Auto-dismiss action toasts after a longer window */
      removeTimer = setTimeout(dismissCurrent, duration);
    }
  }

  DT.ui.toast = {
    show: show,
    info:    function (m, d) { show(m, 'info', d); },
    success: function (m, d) { show(m, 'success', d); },
    error:   function (m, d) { show(m, 'error', d); },
    dismiss: dismissCurrent,

    /**
     * Toast with an Undo button.
     * @param {string} message
     * @param {Function} onUndo
     * @param {number} [duration]
     */
    undo: function (message, onUndo, duration) {
      show(message, 'info', duration || 5000, {
        actionText: 'Undo',
        onAction: onUndo
      });
    }
  };
})();