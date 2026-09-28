/**
 * File: js/tools/password.js
 * Module: Tool — Password Generator
 * Purpose: Generate cryptographically strong passwords locally.
 * Notes: Uses crypto.getRandomValues. No network. No Math.random.
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

  /* ---------------- Character sets ---------------- */

  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>?/|~'
  };

  const AMBIGUOUS = 'Il1O0o|`\'"';

  /**
   * Build the full character pool from the current options.
   * @returns {{pool:string, required:string[]}}
   */
  function buildPool() {
    const opts = readOptions();
    let pool = '';
    const required = [];

    if (opts.upper)   { pool += SETS.upper;   required.push(SETS.upper); }
    if (opts.lower)   { pool += SETS.lower;   required.push(SETS.lower); }
    if (opts.digits)  { pool += SETS.digits;  required.push(SETS.digits); }
    if (opts.symbols) { pool += SETS.symbols; required.push(SETS.symbols); }

    if (opts.excludeAmbiguous) {
      pool = stripChars(pool, AMBIGUOUS);
      for (let i = 0; i < required.length; i++) required[i] = stripChars(required[i], AMBIGUOUS);
    }

    // Filter out empty sets
    const filtered = required.filter(s => s.length > 0);

    return { pool, required: filtered };
  }

  function stripChars(str, remove) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      if (remove.indexOf(str[i]) === -1) out += str[i];
    }
    return out;
  }

  function readOptions() {
    return {
      upper: refs.optUpper.checked,
      lower: refs.optLower.checked,
      digits: refs.optDigits.checked,
      symbols: refs.optSymbols.checked,
      excludeAmbiguous: refs.optAmbiguous.checked
    };
  }

  /* ---------------- Random helpers ---------------- */

  /**
   * Return a uniformly random integer in [0, max).
   * Uses rejection sampling to avoid modulo bias.
   * @param {number} max
   * @returns {number}
   */
  function randomInt(max) {
    if (max <= 0) return 0;
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    const buf = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
  }

  /** Return a uniformly random character from a string. */
  function randomChar(str) {
    return str[randomInt(str.length)];
  }

  /** Fisher-Yates shuffle using crypto randomness. */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ---------------- Generation ---------------- */

  /**
   * Generate one password ensuring at least one char from each required set.
   * @param {number} length
   * @param {string} pool
   * @param {string[]} required
   * @returns {string}
   */
  function generateOne(length, pool, required) {
    const chars = [];

    // 1. One from each required set
    required.forEach(set => chars.push(randomChar(set)));

    // 2. Fill the rest from the full pool
    while (chars.length < length) {
      chars.push(randomChar(pool));
    }

    // 3. Trim if we over-allocated (length < required count)
    chars.length = length;

    // 4. Shuffle so required chars aren't always first
    shuffle(chars);

    return chars.join('');
  }

  /**
   * Compute entropy in bits.
   * @param {number} length
   * @param {number} poolSize
   * @returns {number}
   */
  function entropyBits(length, poolSize) {
    if (poolSize <= 1) return 0;
    return length * Math.log2(poolSize);
  }

  function strengthInfo(bits) {
    if (bits < 40) return { level: 'weak',   label: 'Weak',   color: 'danger'  };
    if (bits < 60) return { level: 'fair',   label: 'Fair',   color: 'warning' };
    if (bits < 80) return { level: 'good',   label: 'Good',   color: 'info'    };
    if (bits < 112) return { level: 'strong', label: 'Strong', color: 'success' };
    return { level: 'excellent', label: 'Excellent', color: 'success' };
  }

  /* ---------------- Actions ---------------- */

  function generateNow() {
    const length = clampLength(parseInt(refs.length.value, 10) || 16);
    const count = clampCount(parseInt(refs.count.value, 10) || 1);
    const { pool, required } = buildPool();

    if (!pool) {
      DT.ui.toast.error('Enable at least one character set');
      return;
    }
    if (required.length > length) {
      DT.ui.toast.error('Length too short for the selected sets (need ≥ ' + required.length + ')');
      return;
    }

    const passwords = [];
    for (let i = 0; i < count; i++) {
      passwords.push(generateOne(length, pool, required));
    }

    refs.currentPasswords = passwords;
    renderPasswords(passwords);
    updateStrength(length, pool.length);

    DT.ui.toast.success(count === 1 ? 'Password generated' : count + ' passwords generated');
  }

  function renderPasswords(passwords) {
    const dom = DT.ui.dom;
    dom.clear(refs.outputSlot);

    if (!passwords.length) {
      refs.outputSlot.appendChild(dom.el('div', { class: 'dt-empty' }, [
        dom.el('div', { class: 'dt-empty__title', text: 'No password yet' }),
        dom.el('div', { class: 'dt-empty__text', text: 'Click Generate.' })
      ]));
      return;
    }

    const list = dom.el('div', { class: 'dt-passwords' });

    passwords.forEach((pwd, i) => {
      const code = dom.el('code', { class: 'dt-password-value', text: pwd });

      const btnCopy = dom.el('button', {
        type: 'button',
        class: 'dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm',
        'aria-label': 'Copy password',
        title: 'Copy'
      });
      const icon = dom.svg(
        '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
        'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
          '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' +
        '</svg>'
      );
      if (icon) btnCopy.appendChild(icon);
      btnCopy.addEventListener('click', () => {
        DT.utils.clipboard.copy(pwd)
          .then(() => DT.ui.toast.success('Copied'))
          .catch(() => DT.ui.toast.error('Copy failed'));
      });

      const row = dom.el('div', { class: 'dt-password-row' }, [
        dom.el('span', { class: 'dt-password-row__index', text: String(i + 1) }),
        code,
        btnCopy
      ]);

      list.appendChild(row);
    });

    refs.outputSlot.appendChild(list);
  }

  function updateStrength(length, poolSize) {
    const bits = entropyBits(length, poolSize);
    const info = strengthInfo(bits);

    const dom = DT.ui.dom;
    dom.clear(refs.strengthSlot);

    if (poolSize < 2) {
      refs.strengthSlot.appendChild(dom.el('span', { class: 'dt-help', text: 'Enable character sets' }));
      return;
    }

    const bar = dom.el('div', { class: 'dt-strength-bar' });
    const fill = dom.el('div', { class: 'dt-strength-bar__fill dt-strength-bar__fill--' + info.color });
    fill.style.width = Math.min(100, (bits / 128) * 100) + '%';
    bar.appendChild(fill);

    const label = dom.el('div', { class: 'dt-strength-label' }, [
      dom.el('span', { class: 'dt-badge dt-badge--' + info.color, text: info.label }),
      dom.el('span', { class: 'dt-help', text: Math.round(bits) + ' bits of entropy' })
    ]);

    refs.strengthSlot.appendChild(bar);
    refs.strengthSlot.appendChild(label);
  }

  function clampLength(n) {
    if (isNaN(n)) return 16;
    if (n < 4) return 4;
    if (n > 128) return 128;
    return n;
  }

  function clampCount(n) {
    if (isNaN(n)) return 1;
    if (n < 1) return 1;
    if (n > 50) return 50;
    return n;
  }

  function copyAll() {
    if (!refs.currentPasswords || !refs.currentPasswords.length) {
      DT.ui.toast.info('Nothing to copy');
      return;
    }
    DT.utils.clipboard.copy(refs.currentPasswords.join('\n'))
      .then(() => DT.ui.toast.success('Copied ' + refs.currentPasswords.length))
      .catch(() => DT.ui.toast.error('Copy failed'));
  }

  function clearAll() {
    refs.currentPasswords = [];
    renderPasswords([]);
    updateStrength(0, 0);
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.password = {
    id: 'password',
    name: 'Password Generator',
    category: 'Generators',
    icon: 'lock',
    description: 'Strong crypto-random passwords with strength meter.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      /* --- Toolbar --- */
      const lengthLabel = dom.el('span', { class: 'dt-toolbar__label', text: 'Length' });
      const length = dom.el('input', {
        type: 'number', class: 'dt-input', id: 'dt-pwd-length',
        min: '4', max: '128', value: '16', inputmode: 'numeric'
      });
      length.style.width = '70px';

      const countLabel = dom.el('span', { class: 'dt-toolbar__label', text: 'Count' });
      const count = dom.el('input', {
        type: 'number', class: 'dt-input', id: 'dt-pwd-count',
        min: '1', max: '50', value: '1', inputmode: 'numeric'
      });
      count.style.width = '60px';

      const btnGen = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--primary dt-btn--sm', text: 'Generate' });
      const btnCopyAll = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--secondary dt-btn--sm', text: 'Copy all' });
      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [lengthLabel, length, countLabel, count, btnGen, btnCopyAll]),
        btnClear
      ]);

      /* --- Options panel --- */
      const optUpper = dom.el('input', { type: 'checkbox', id: 'dt-pwd-upper' });
      const optLower = dom.el('input', { type: 'checkbox', id: 'dt-pwd-lower' });
      const optDigits = dom.el('input', { type: 'checkbox', id: 'dt-pwd-digits' });
      const optSymbols = dom.el('input', { type: 'checkbox', id: 'dt-pwd-symbols' });
      const optAmbiguous = dom.el('input', { type: 'checkbox', id: 'dt-pwd-ambig' });

      optUpper.checked = true;
      optLower.checked = true;
      optDigits.checked = true;
      optSymbols.checked = true;
      optAmbiguous.checked = false;

      function optRow(cb, label, hint) {
        const text = hint ? [dom.txt(label), dom.el('span', { class: 'dt-help', text: ' · ' + hint })] : [dom.txt(label)];
        return dom.el('label', { class: 'dt-pwd-opt', for: cb.id }, [cb, dom.el('span', {}, text)]);
      }

      const optionsGrid = dom.el('div', { class: 'dt-pwd-options' }, [
        optRow(optUpper,    'Uppercase', 'A–Z'),
        optRow(optLower,    'Lowercase', 'a–z'),
        optRow(optDigits,   'Digits',    '0–9'),
        optRow(optSymbols,  'Symbols',   '!@#$…'),
        optRow(optAmbiguous,'Exclude ambiguous', 'Il1O0o|')
      ]);

      const optionsPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Character sets' })]),
        dom.el('div', { class: 'dt-panel__body', style: { padding: '12px 16px' } }, [optionsGrid])
      ]);

      /* --- Strength panel --- */
      const strengthSlot = dom.el('div', { class: 'dt-strength' });
      const strengthPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Strength' })]),
        dom.el('div', { class: 'dt-panel__body', style: { padding: '12px 16px' } }, [strengthSlot])
      ]);

      /* --- Output panel --- */
      const outputSlot = dom.el('div', { id: 'dt-pwd-output', style: { padding: '8px 12px' } });
      const outputPanel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [dom.el('div', { class: 'dt-panel__title', text: 'Passwords' })]),
        outputSlot
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(optionsPanel);
      workspace.appendChild(strengthPanel);
      workspace.appendChild(outputPanel);
      container.appendChild(workspace);

      refs = {
        length, count,
        optUpper, optLower, optDigits, optSymbols, optAmbiguous,
        strengthSlot, outputSlot,
        currentPasswords: []
      };

      /* --- Events --- */
      on(btnGen, 'click', generateNow);
      on(btnCopyAll, 'click', copyAll);
      on(btnClear, 'click', clearAll);

      on(length, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); generateNow(); } });
      on(count, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); generateNow(); } });

      // Update strength when options or length change
      [optUpper, optLower, optDigits, optSymbols, optAmbiguous].forEach(cb => {
        on(cb, 'change', () => {
          const lengthVal = clampLength(parseInt(length.value, 10) || 16);
          const { pool } = buildPool();
          updateStrength(lengthVal, pool.length);
        });
      });
      on(length, 'input', () => {
        const lengthVal = clampLength(parseInt(length.value, 10) || 16);
        const { pool } = buildPool();
        updateStrength(lengthVal, pool.length);
      });

      /* --- Initial paint --- */
      renderPasswords([]);
      updateStrength(16, 0);

      /* --- Auto-generate on mount --- */
      generateNow();

      length.focus();
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