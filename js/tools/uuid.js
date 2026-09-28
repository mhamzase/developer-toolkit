/**
 * File: js/tools/uuid.js
 * Module: Tool — UUID Generator
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) { node.addEventListener(event, fn); listeners.push([node, event, fn]); }

  function uuidV4() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [];
    for (let i = 0; i < 16; i++) hex.push((bytes[i] + 0x100).toString(16).slice(1));
    return hex[0] + hex[1] + hex[2] + hex[3] + '-' + hex[4] + hex[5] + '-' + hex[6] + hex[7] + '-' + hex[8] + hex[9] + '-' + hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
  }

  function generateMany(n) {
    const out = [];
    const seen = Object.create(null);
    let guard = 0;
    while (out.length < n && guard < n * 4) {
      guard++;
      const id = uuidV4();
      if (!seen[id]) { seen[id] = true; out.push(id); }
    }
    return out;
  }

  function clearList() { DT.ui.dom.clear(refs.listSlot); }

  function emptyState() {
    const dom = DT.ui.dom;
    return dom.el('div', { class: 'dt-empty' }, [
      dom.el('div', { class: 'dt-empty__title', text: 'No UUIDs yet' }),
      dom.el('div', { class: 'dt-empty__text', text: 'Click Generate to create one.' })
    ]);
  }

  function renderList(ids) {
    const dom = DT.ui.dom;
    clearList();

    const wrap = dom.el('div', { class: 'dt-uuid-list' });
    ids.forEach((id, index) => {
      const code = dom.el('code', { class: 'dt-uuid-row__value', text: id });
      const btn = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm', 'aria-label': 'Copy UUID', title: 'Copy' });
      const icon = dom.svg('<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>');
      if (icon) btn.appendChild(icon);
      btn.addEventListener('click', () => {
        DT.utils.clipboard.copy(id).then(() => DT.ui.toast.success('Copied')).catch(() => DT.ui.toast.error('Copy failed'));
      });
      const row = dom.el('div', { class: 'dt-uuid-row' }, [
        dom.el('span', { class: 'dt-uuid-row__index', text: String(index + 1) }),
        code, btn
      ]);
      wrap.appendChild(row);
    });
    refs.listSlot.appendChild(wrap);
  }

  function parseCount() {
    const raw = parseInt(refs.count.value, 10);
    if (isNaN(raw) || raw < 1) return 1;
    if (raw > 500) return 500;
    return raw;
  }

  function generateNow() {
    const n = parseCount();
    const ids = generateMany(n);
    refs.currentIds = ids;
    renderList(ids);
    DT.ui.toast.success('Generated ' + ids.length + ' UUID' + (ids.length === 1 ? '' : 's'));
  }

  function copyAll() {
    if (!refs.currentIds || !refs.currentIds.length) { DT.ui.toast.info('Nothing to copy'); return; }
    DT.utils.clipboard.copy(refs.currentIds.join('\n')).then(() => DT.ui.toast.success('Copied ' + refs.currentIds.length + ' UUIDs')).catch(() => DT.ui.toast.error('Copy failed'));
  }

  function clearAll() {
    refs.currentIds = [];
    clearList();
    refs.listSlot.appendChild(emptyState());
  }

  DT.tools.uuid = {
    id: 'uuid',
    name: 'UUID Generator',
    category: 'Generators',
    icon: 'hash',
    description: 'Generate one or many UUID v4 values.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      const countLabel = dom.el('span', { class: 'dt-toolbar__label', text: 'Count' });
      const count = dom.el('input', { type: 'number', class: 'dt-input', id: 'dt-uuid-count', min: '1', max: '500', value: '1', inputmode: 'numeric' });
      count.style.width = '90px';

      const btnGen = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--primary dt-btn--sm', text: 'Generate' });
      const btnCopyAll = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Copy all' });
      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [countLabel, count, btnGen, btnCopyAll]),
        btnClear
      ]);

      const hint = dom.el('div', { class: 'dt-help', text: 'Version 4 UUIDs, generated with crypto.getRandomValues. Max 500 per batch.' });

      const listSlot = dom.el('div', { id: 'dt-uuid-list', style: { display: 'flex', flexDirection: 'column', gap: '12px' } });
      listSlot.appendChild(emptyState());

      workspace.appendChild(toolbar);
      workspace.appendChild(hint);
      workspace.appendChild(listSlot);
      container.appendChild(workspace);

      refs = { count, listSlot, currentIds: [] };

      on(btnGen, 'click', generateNow);
      on(btnCopyAll, 'click', copyAll);
      on(btnClear, 'click', clearAll);
      on(count, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); generateNow(); } });

      count.focus();
    },

    unmount() {
      while (listeners.length) { const entry = listeners.pop(); entry[0].removeEventListener(entry[1], entry[2]); }
      refs = null;
    }
  };
})();