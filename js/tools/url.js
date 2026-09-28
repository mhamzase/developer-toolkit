/**
 * File: js/tools/url.js
 * Module: Tool — URL Encoder / Decoder
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) { node.addEventListener(event, fn); listeners.push([node, event, fn]); }
  function mode() { return refs.mode.value; }

  function encodeNow() {
    const raw = refs.input.value;
    if (!raw) { DT.ui.toast.info('Input is empty'); return; }
    try {
      const out = mode() === 'component' ? encodeURIComponent(raw) : encodeURI(raw);
      refs.output.value = out;
      clearAnalysis();
      paintStats(raw, out);
      DT.ui.toast.success('Encoded');
    } catch (e) {
      refs.output.value = '';
      paintStats(raw, '');
      DT.ui.toast.error('Encode failed');
    }
  }

  function decodeNow() {
    const raw = refs.input.value;
    if (!raw) { DT.ui.toast.info('Input is empty'); return; }
    try {
      const out = mode() === 'component' ? decodeURIComponent(raw) : decodeURI(raw);
      refs.output.value = out;
      paintStats(raw, out);
      analyze(raw);
      DT.ui.toast.success('Decoded');
    } catch (e) {
      refs.output.value = '';
      clearAnalysis();
      paintStats(raw, '');
      DT.ui.toast.error('Malformed URI sequence');
    }
  }

  function copyOutput() {
    const v = refs.output.value;
    if (!v) { DT.ui.toast.info('Nothing to copy'); return; }
    DT.utils.clipboard.copy(v).then(() => DT.ui.toast.success('Copied')).catch(() => DT.ui.toast.error('Copy failed'));
  }

  function clearAll() {
    refs.input.value = ''; refs.output.value = '';
    paintStats('', ''); clearAnalysis(); refs.input.focus();
  }

  function swap() {
    if (!refs.output.value) { DT.ui.toast.info('Output is empty'); return; }
    refs.input.value = refs.output.value;
    refs.output.value = '';
    paintStats(refs.input.value, '');
    clearAnalysis();
    refs.input.focus();
  }

  function paintStats(inText, outText) {
    refs.inputStats.textContent = (inText ? String(inText).length : 0) + ' chars';
    refs.outputStats.textContent = (outText ? String(outText).length : 0) + ' chars';
  }

  function clearAnalysis() { DT.ui.dom.clear(refs.analysisSlot); }

  function analyze(raw) {
    clearAnalysis();
    const dom = DT.ui.dom;
    let url;
    try { url = new URL(raw); } catch (e) { return; }

    const rows = [];
    rows.push(['Protocol', url.protocol.replace(':', '')]);
    rows.push(['Host', url.host]);
    if (url.pathname && url.pathname !== '/') rows.push(['Path', url.pathname]);
    if (url.search) rows.push(['Query', url.search.slice(1)]);
    if (url.hash) rows.push(['Hash', url.hash.slice(1)]);

    const body = dom.el('div', { class: 'dt-panel__body', style: { padding: '12px 16px' } });
    rows.forEach((r) => {
      body.appendChild(dom.el('div', { class: 'dt-row', style: { gap: '10px', alignItems: 'baseline', padding: '4px 0' } }, [
        dom.el('span', { class: 'dt-badge', text: r[0] }),
        dom.el('span', { class: 'dt-help', style: { wordBreak: 'break-all' }, text: r[1] })
      ]));
    });

    const search = url.searchParams;
    const keys = [];
    search.forEach((_, k) => { if (keys.indexOf(k) === -1) keys.push(k); });
    if (keys.length) {
      body.appendChild(dom.el('div', { class: 'dt-label', text: 'Query params', style: { marginTop: '10px', marginBottom: '4px' } }));
      keys.forEach((k) => {
        search.getAll(k).forEach((v) => {
          body.appendChild(dom.el('div', { class: 'dt-row', style: { gap: '10px', alignItems: 'baseline', padding: '4px 0' } }, [
            dom.el('span', { class: 'dt-badge dt-badge--accent', text: k }),
            dom.el('span', { class: 'dt-help', style: { wordBreak: 'break-all' }, text: v || '(empty)' })
          ]));
        });
      });
    }

    refs.analysisSlot.appendChild(dom.el('div', { class: 'dt-panel' }, [
      dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'URL breakdown' })]),
      body
    ]));
  }

  DT.tools.url = {
    id: 'url',
    name: 'URL Encoder',
    category: 'Encoding',
    icon: 'link',
    description: 'Encode or decode URLs and components.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      const modeSel = dom.el('select', { class: 'dt-select dt-select--sm', id: 'dt-url-mode' }, [
        dom.el('option', { value: 'component', text: 'Component' }),
        dom.el('option', { value: 'full', text: 'Full URL' })
      ]);
      modeSel.style.width = '130px';

      const btnEncode = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--primary dt-btn--sm', text: 'Encode' });
      const btnDecode = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Decode' });
      const btnSwap = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: '↑ Send to input' });
      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [
          dom.el('span', { class: 'dt-toolbar__label', text: 'Mode' }),
          modeSel, btnEncode, btnDecode, btnSwap
        ]),
        btnClear
      ]);

      const input = dom.el('textarea', { class: 'dt-textarea', id: 'dt-url-input', rows: '6', spellcheck: 'false', placeholder: 'Paste URL or text…  (Ctrl+Enter = Encode, Ctrl+Shift+Enter = Decode)' });
      input.style.whiteSpace = 'pre-wrap';
      input.style.wordBreak = 'break-all';

      const inputStats = dom.el('div', { class: 'dt-help', text: '0 chars' });

      const inputPanel = dom.el('div', { class: 'dt-panel dt-panel--editor' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Input' })]),
        dom.el('div', { class: 'dt-panel__body' }, [input]),
        dom.el('div', { class: 'dt-panel__foot' }, [inputStats])
      ]);

      const output = dom.el('textarea', { class: 'dt-textarea', id: 'dt-url-output', rows: '6', spellcheck: 'false', readonly: 'readonly', placeholder: 'Result appears here…' });
      output.style.whiteSpace = 'pre-wrap';
      output.style.wordBreak = 'break-all';

      const outputStats = dom.el('div', { class: 'dt-help', text: '0 chars' });
      const btnCopy = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Copy' });

      const outputPanel = dom.el('div', { class: 'dt-panel dt-panel--editor' }, [
        dom.el('div', { class: 'dt-panel__head' }, [
          dom.el('div', { class: 'dt-panel__title', text: 'Output' }),
          dom.el('div', { class: 'dt-panel__actions' }, [btnCopy])
        ]),
        dom.el('div', { class: 'dt-panel__body' }, [output]),
        dom.el('div', { class: 'dt-panel__foot' }, [outputStats])
      ]);

      const analysisSlot = dom.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } });

      workspace.appendChild(toolbar);
      workspace.appendChild(inputPanel);
      workspace.appendChild(outputPanel);
      workspace.appendChild(analysisSlot);
      container.appendChild(workspace);

      refs = { input, output, mode: modeSel, inputStats, outputStats, analysisSlot };

      on(input, 'input', () => paintStats(input.value, output.value));
      on(input, 'keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) decodeNow(); else encodeNow(); }
      });
      on(btnEncode, 'click', encodeNow);
      on(btnDecode, 'click', decodeNow);
      on(btnSwap, 'click', swap);
      on(btnClear, 'click', clearAll);
      on(btnCopy, 'click', copyOutput);

      input.focus();
    },

    unmount() {
      while (listeners.length) { const entry = listeners.pop(); entry[0].removeEventListener(entry[1], entry[2]); }
      refs = null;
    }
  };
})();