/**
 * File: js/tools/case.js
 * Module: Tool — Case Converter
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) { node.addEventListener(event, fn); listeners.push([node, event, fn]); }

  function splitWords(input) {
    let s = String(input || '');
    s = s.replace(/[_\-./\\]+/g, ' ');
    s = s.replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2');
    s = s.replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, '$1 $2');
    s = s.replace(/(\p{L})(\p{N})/gu, '$1 $2');
    s = s.replace(/(\p{N})(\p{L})/gu, '$1 $2');
    return s.trim().split(/\s+/).filter(Boolean);
  }

  const CASES = [
    { id: 'upper', label: 'UPPER CASE', fn: w => w.join(' ').toUpperCase() },
    { id: 'lower', label: 'lower case', fn: w => w.join(' ').toLowerCase() },
    { id: 'title', label: 'Title Case', fn: w => w.map(x => { const l = x.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); }).join(' ') },
    { id: 'camel', label: 'camelCase', fn: w => w.map((x, i) => { const l = x.toLowerCase(); return i === 0 ? l : l.charAt(0).toUpperCase() + l.slice(1); }).join('') },
    { id: 'pascal', label: 'PascalCase', fn: w => w.map(x => { const l = x.toLowerCase(); return l.charAt(0).toUpperCase() + l.slice(1); }).join('') },
    { id: 'snake', label: 'snake_case', fn: w => w.map(x => x.toLowerCase()).join('_') },
    { id: 'kebab', label: 'kebab-case', fn: w => w.map(x => x.toLowerCase()).join('-') },
    { id: 'constant', label: 'CONSTANT_CASE', fn: w => w.map(x => x.toUpperCase()).join('_') },
    { id: 'dot', label: 'dot.case', fn: w => w.map(x => x.toLowerCase()).join('.') }
  ];

  function renderRows(container) {
    const dom = DT.ui.dom;
    DT.ui.dom.clear(container);
    if (!refs.rowsById) refs.rowsById = {};

    const list = dom.el('div', { class: 'dt-case-list' });
    CASES.forEach((c) => {
      const value = dom.el('div', { class: 'dt-result__value', text: '—' });
      const btn = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm', 'aria-label': 'Copy ' + c.label, title: 'Copy' });
      const icon = dom.svg('<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>');
      if (icon) btn.appendChild(icon);
      btn.addEventListener('click', () => {
        const text = value.textContent || '';
        if (!text || text === '—') { DT.ui.toast.info('Nothing to copy'); return; }
        DT.utils.clipboard.copy(text).then(() => DT.ui.toast.success(c.label + ' copied')).catch(() => DT.ui.toast.error('Copy failed'));
      });

      const row = dom.el('div', { class: 'dt-case-row' }, [
        dom.el('div', { class: 'dt-result__label', text: c.label }),
        value, btn
      ]);
      list.appendChild(row);
      refs.rowsById[c.id] = { value, fn: c.fn };
    });
    container.appendChild(list);
  }

  function updateAll() {
    if (!refs || !refs.rowsById) return;
    const raw = refs.input.value;
    const words = splitWords(raw);
    CASES.forEach((c) => {
      const entry = refs.rowsById[c.id];
      if (!entry) return;
      if (!raw.trim() || !words.length) {
        entry.value.textContent = '—';
        entry.value.classList.add('dt-case-row__value--empty');
        return;
      }
      entry.value.classList.remove('dt-case-row__value--empty');
      entry.value.textContent = c.fn(words);
    });
  }

  function clearAll() { refs.input.value = ''; updateAll(); refs.input.focus(); }
  function pasteSample() { refs.input.value = 'user_profile-picture URL'; updateAll(); }

  DT.tools.case = {
    id: 'case',
    name: 'Case Converter',
    category: 'Conversion',
    icon: 'type',
    description: 'UPPER, lower, Title, camel, snake, kebab and more.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      const btnSample = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Sample' });
      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [btnSample]),
        btnClear
      ]);

      const input = dom.el('textarea', { class: 'dt-textarea', id: 'dt-case-input', rows: '4', spellcheck: 'false', placeholder: 'Type or paste text — variants update live…' });
      input.style.whiteSpace = 'pre-wrap';
      input.style.fontFamily = 'var(--font-sans)';
      input.style.fontSize = 'var(--fs-sm)';

      const inputPanel = dom.el('div', { class: 'dt-panel dt-panel--editor' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Input' })]),
        dom.el('div', { class: 'dt-panel__body' }, [input])
      ]);

      const listSlot = dom.el('div', { id: 'dt-case-list' });

      const resultsPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Conversions' })]),
        dom.el('div', { class: 'dt-panel__body', style: { padding: '8px 12px' } }, [listSlot])
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(resultsPanel);
      container.appendChild(workspace);

      refs = { input, listSlot, rowsById: {} };
      renderRows(listSlot);

      on(input, 'input', updateAll);
      on(btnSample, 'click', pasteSample);
      on(btnClear, 'click', clearAll);

      input.focus();
    },

    unmount() {
      while (listeners.length) { const entry = listeners.pop(); entry[0].removeEventListener(entry[1], entry[2]); }
      refs = null;
    }
  };
})();