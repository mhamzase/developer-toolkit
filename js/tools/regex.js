/**
 * File: js/tools/regex.js
 * Module: Tool — Regex Tester
 * Purpose: Test regular expressions with live matching, flags, groups, positions.
 * Notes: Uses native RegExp. No network. No eval.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.tools = DT.tools || {};

  let refs = null;
  const listeners = [];

  function on(node, event, fn) {
    node.addEventListener(event, fn);
    listeners.push([node, event, fn]);
  }

  /* ---------------- Flags ---------------- */

  const FLAGS = [
    { id: 'g', label: 'g', title: 'Global — find all matches' },
    { id: 'i', label: 'i', title: 'Ignore case' },
    { id: 'm', label: 'm', title: 'Multiline — ^ and $ match line breaks' },
    { id: 's', label: 's', title: 'Dotall — . matches newlines' },
    { id: 'u', label: 'u', title: 'Unicode' },
    { id: 'y', label: 'y', title: 'Sticky — match from lastIndex' }
  ];

  function flagsString() {
    return FLAGS.filter(f => refs.flags[f.id].checked).map(f => f.id).join('');
  }

  /* ---------------- Matching ---------------- */

  /**
   * Run the regex against the test string.
   * @returns {{ok:true, matches:Array, duration:number}
   *          | {ok:false, error:string}}
   */
  function runMatch() {
    const pattern = refs.pattern.value;
    if (!pattern) return { ok: true, matches: [] };

    const flags = flagsString();
    let re;
    const start = performance.now();
    try {
      re = new RegExp(pattern, flags);
    } catch (e) {
      return { ok: false, error: e.message || 'Invalid regex.' };
    }

    const text = refs.text.value;
    const matches = [];
    const MAX = 5000;

    if (re.global || re.sticky) {
      let m;
      let guard = 0;
      while ((m = re.exec(text)) !== null && matches.length < MAX) {
        matches.push(snapshot(m, text));
        if (m[0] === '') re.lastIndex++; // avoid infinite loop on zero-width
        guard++;
        if (guard > MAX * 2) break;
      }
    } else {
      const m = re.exec(text);
      if (m) matches.push(snapshot(m, text));
    }

    const duration = performance.now() - start;
    return { ok: true, matches, duration };
  }

  function snapshot(m, text) {
    const groups = [];
    for (let i = 1; i < m.length; i++) {
      groups.push({ index: i, value: m[i] });
    }
    // Named groups
    const named = [];
    if (m.groups) {
      Object.keys(m.groups).forEach(k => named.push({ name: k, value: m.groups[k] }));
    }

    return {
      value: m[0],
      index: m.index,
      length: m[0].length,
      groups,
      named
    };
  }

  /* ---------------- Rendering ---------------- */

  function paintStats(result) {
    const el = refs.matchStats;
    DT.ui.dom.clear(el);

    if (!result.ok) {
      el.appendChild(DT.ui.dom.el('span', { class: 'dt-stat dt-stat--danger' }, [
        DT.ui.dom.txt('Error ')
      ]));
      return;
    }

    const n = result.matches.length;
    const dur = result.duration.toFixed(2);

    el.appendChild(DT.ui.dom.el('span', { class: 'dt-stat' }, [
      DT.ui.dom.txt('Matches '),
      DT.ui.dom.el('span', { class: 'dt-stat__value', text: String(n) })
    ]));
    el.appendChild(DT.ui.dom.el('span', { class: 'dt-stat' }, [
      DT.ui.dom.txt('Time '),
      DT.ui.dom.el('span', { class: 'dt-stat__value', text: dur + ' ms' })
    ]));
  }

  function renderMatches(result) {
    const dom = DT.ui.dom;
    const slot = refs.matchesSlot;
    dom.clear(slot);

    if (!result.ok) {
      slot.appendChild(dom.el('div', { class: 'dt-alert dt-alert--error' }, [
        dom.el('div', { style: { fontWeight: '600' }, text: 'Invalid regex' }),
        dom.el('div', { text: result.error })
      ]));
      return;
    }

    if (!result.matches.length) {
      slot.appendChild(dom.el('div', { class: 'dt-empty' }, [
        dom.el('div', { class: 'dt-empty__title', text: 'No matches' }),
        dom.el('div', { class: 'dt-empty__text', text: 'Try a different pattern or flags.' })
      ]));
      return;
    }

    const list = dom.el('div', { class: 'dt-regex-matches' });
    result.matches.forEach((m, i) => {
      const head = dom.el('div', { class: 'dt-regex-match__head' }, [
        dom.el('span', { class: 'dt-badge dt-badge--accent', text: '#' + (i + 1) }),
        dom.el('span', { class: 'dt-help', text: 'index ' + m.index + ' · length ' + m.length })
      ]);

      const value = dom.el('code', { class: 'dt-regex-match__value', text: m.value || '(empty)' });

      const body = dom.el('div', { class: 'dt-regex-match__body' }, [head, value]);

      // Groups
      if (m.groups.length) {
        const groupWrap = dom.el('div', { class: 'dt-regex-groups' });
        m.groups.forEach(g => {
          groupWrap.appendChild(dom.el('div', { class: 'dt-regex-group' }, [
            dom.el('span', { class: 'dt-regex-group__label', text: '$' + g.index }),
            dom.el('code', { class: 'dt-regex-group__value', text: g.value == null ? '(undefined)' : (g.value || '(empty)') })
          ]));
        });
        body.appendChild(groupWrap);
      }

      // Named groups
      if (m.named.length) {
        const namedWrap = dom.el('div', { class: 'dt-regex-groups' });
        m.named.forEach(g => {
          namedWrap.appendChild(dom.el('div', { class: 'dt-regex-group' }, [
            dom.el('span', { class: 'dt-regex-group__label dt-regex-group__label--named', text: g.name }),
            dom.el('code', { class: 'dt-regex-group__value', text: g.value == null ? '(undefined)' : (g.value || '(empty)') })
          ]));
        });
        body.appendChild(namedWrap);
      }

      const card = dom.el('div', { class: 'dt-regex-match' }, [body]);
      list.appendChild(card);
    });

    slot.appendChild(list);
  }

  function renderHighlight(result) {
    const dom = DT.ui.dom;
    const slot = refs.highlightSlot;
    dom.clear(slot);

    if (!result.ok) return;

    const text = refs.text.value;
    if (!text) {
      slot.appendChild(dom.el('div', { class: 'dt-help', text: 'No test string.' }));
      return;
    }

    if (!result.matches.length) {
      const pre = dom.el('pre', { class: 'dt-regex-highlight' });
      pre.appendChild(document.createTextNode(text));
      slot.appendChild(pre);
      return;
    }

    const pre = dom.el('pre', { class: 'dt-regex-highlight' });

    // Build highlight using DOM nodes (safe — no innerHTML)
    let cursor = 0;
    result.matches.forEach((m, i) => {
      if (m.index > cursor) {
        pre.appendChild(document.createTextNode(text.slice(cursor, m.index)));
      }
      const span = dom.el('mark', {
        class: 'dt-regex-hit' + (i % 2 ? ' dt-regex-hit--alt' : ''),
        title: 'Match #' + (i + 1)
      });
      span.appendChild(document.createTextNode(m.value || '\u200B'));
      pre.appendChild(span);
      cursor = m.index + m.length;
    });
    if (cursor < text.length) {
      pre.appendChild(document.createTextNode(text.slice(cursor)));
    }

    slot.appendChild(pre);
  }

  function update() {
    const result = runMatch();
    paintStats(result);
    renderMatches(result);
    renderHighlight(result);
  }

  /* ---------------- Actions ---------------- */

  function clearAll() {
    refs.pattern.value = '';
    refs.text.value = '';
    update();
    refs.pattern.focus();
  }

  function copyMatches() {
    const result = runMatch();
    if (!result.ok || !result.matches.length) {
      DT.ui.toast.info('No matches to copy');
      return;
    }
    const out = result.matches.map((m, i) =>
      '#' + (i + 1) + '  index ' + m.index + '  "' + m.value + '"' +
      (m.groups.length ? '\n    groups: ' + m.groups.map(g => '$' + g.index + '="' + (g.value || '') + '"').join(', ') : '')
    ).join('\n');
    DT.utils.clipboard.copy(out)
      .then(() => DT.ui.toast.success('Matches copied'))
      .catch(() => DT.ui.toast.error('Copy failed'));
  }

  function loadSample() {
    refs.pattern.value = '(\\w+)@(\\w+)\\.com';
    refs.flags.g.checked = true;
    refs.flags.i.checked = true;
    refs.text.value = 'Contact alice@example.com or bob@test.com for support.\nInvalid: not-an-email, charlie@.';
    update();
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.regex = {
    id: 'regex',
    name: 'Regex Tester',
    category: 'Regex',
    icon: 'regex',
    description: 'Test patterns with flags, groups, and live highlighting.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      /* --- Pattern row --- */
      const pattern = dom.el('input', {
        type: 'text',
        class: 'dt-input dt-input--mono',
        id: 'dt-regex-pattern',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'e.g. (\\w+)@(\\w+)\\.com'
      });

      /* --- Flags --- */
      const flagsWrap = dom.el('div', { class: 'dt-regex-flags' });
      const flags = {};
      FLAGS.forEach(f => {
        const cb = dom.el('input', { type: 'checkbox', id: 'dt-regex-flag-' + f.id });
        const lbl = dom.el('label', {
          class: 'dt-regex-flag',
          for: 'dt-regex-flag-' + f.id,
          title: f.title
        }, [cb, dom.txt(f.label)]);
        flags[f.id] = cb;
        flagsWrap.appendChild(lbl);
      });
      flags.g.checked = true;

      const patternPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [
          dom.el('div', { class: 'dt-panel__title', text: 'Pattern' }),
          dom.el('div', { class: 'dt-panel__actions' }, [flagsWrap])
        ]),
        dom.el('div', { class: 'dt-panel__body', style: { padding: '12px 16px' } }, [pattern])
      ]);

      /* --- Toolbar --- */
      const btnCopy = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Copy matches' });
      const btnSample = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Load sample' });
      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [btnCopy, btnSample]),
        btnClear
      ]);

      /* --- Test string --- */
      const text = dom.el('textarea', {
        class: 'dt-textarea',
        id: 'dt-regex-text',
        rows: '6',
        spellcheck: 'false',
        placeholder: 'Paste test string here…'
      });
      text.style.whiteSpace = 'pre-wrap';

      const textPanel = dom.el('div', { class: 'dt-panel dt-panel--editor' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Test string' })]),
        dom.el('div', { class: 'dt-panel__body' }, [text])
      ]);

      /* --- Highlight preview --- */
      const highlightSlot = dom.el('div', { id: 'dt-regex-highlight', style: { padding: '12px 16px' } });
      const highlightPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Highlighted' })]),
        highlightSlot
      ]);

      /* --- Matches --- */
      const matchesSlot = dom.el('div', { id: 'dt-regex-matches', style: { padding: '8px 12px' } });
      const matchStats = dom.el('div', { class: 'dt-stats' });
      const matchesPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [
          dom.el('div', { class: 'dt-panel__title', text: 'Matches' })
        ]),
        matchesSlot,
        dom.el('div', { class: 'dt-panel__foot' }, [matchStats])
      ]);

      workspace.appendChild(patternPanel);
      workspace.appendChild(toolbar);
      workspace.appendChild(textPanel);
      workspace.appendChild(highlightPanel);
      workspace.appendChild(matchesPanel);
      container.appendChild(workspace);

      refs = { pattern, text, flags, highlightSlot, matchesSlot, matchStats };

      /* --- Events --- */
      const updateDebounced = DT.utils.debounce(update, 120);

      on(pattern, 'input', updateDebounced);
      on(text, 'input', updateDebounced);
      FLAGS.forEach(f => on(flags[f.id], 'change', update));

      on(btnCopy, 'click', copyMatches);
      on(btnSample, 'click', loadSample);
      on(btnClear, 'click', clearAll);

      pattern.focus();
      update();
    },

    unmount() {
      while (listeners.length) {
        const entry = listeners.pop();
        entry[0].removeEventListener(entry[1], entry[2]);
      }
      refs = null;
    }
  };
})();