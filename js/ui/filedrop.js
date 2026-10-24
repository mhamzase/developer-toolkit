/**
 * File: js/ui/filedrop.js
 * Module: UI — File Drop (Phase 2A shared file component)
 * Purpose: One file picker for every tool that needs a file:
 *          click to browse or drag and drop, with the chosen
 *          file's name and size shown in place. The file itself
 *          never leaves the machine; the tool decides how to
 *          read it (arrayBuffer, text, data URL).
 * Usage:
 *   const drop = DT.ui.fileDrop({
 *     accept: '.json,.txt',           // optional
 *     maxBytes: 5 * 1024 * 1024,       // optional, 0 = no limit
 *     label: 'Drop a file here',       // optional
 *     onFile: function (file) { ... } // required
 *   });
 *   container.appendChild(drop.el);
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  DT.ui.fileDrop = function (opts) {
    opts = opts || {};
    const dom = DT.ui.dom;

    const input = dom.el('input', {
      type: 'file',
      class: 'dt-visually-hidden',
      tabindex: '-1'
    });
    if (opts.accept) input.setAttribute('accept', opts.accept);

    const label = dom.el('div', {
      class: 'dt-filedrop__label',
      text: opts.label || 'Drop a file here, or click to browse'
    });
    const meta = dom.el('div', { class: 'dt-filedrop__meta', text: '' });
    meta.style.display = 'none';

    const el = dom.el('div', {
      class: 'dt-filedrop',
      role: 'button',
      tabindex: '0',
      'aria-label': opts.label || 'Choose a file'
    }, [label, meta, input]);

    let currentFile = null;

    function handle(file) {
      if (!file) return;
      if (opts.maxBytes && file.size > opts.maxBytes) {
        DT.ui.toast.error('File is too large (max ' + formatSize(opts.maxBytes) + ')');
        return;
      }
      currentFile = file;
      meta.textContent = file.name + ' · ' + formatSize(file.size);
      meta.style.display = '';
      label.textContent = 'Drop another file, or click to change';
      el.classList.add('dt-filedrop--has-file');
      if (typeof opts.onFile === 'function') opts.onFile(file);
    }

    el.addEventListener('click', function () { input.click(); });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        input.click();
      }
    });
    input.addEventListener('change', function () {
      handle(input.files && input.files[0]);
      input.value = '';
    });

    ['dragenter', 'dragover'].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        el.classList.add('dt-filedrop--over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      el.addEventListener(ev, function (e) {
        e.preventDefault();
        el.classList.remove('dt-filedrop--over');
      });
    });
    el.addEventListener('drop', function (e) {
      const files = e.dataTransfer && e.dataTransfer.files;
      handle(files && files[0]);
    });

    return {
      el: el,
      /** The currently selected File, or null. */
      file: function () { return currentFile; },
      /** Reset the picker back to its empty state. */
      clear: function () {
        currentFile = null;
        meta.textContent = '';
        meta.style.display = 'none';
        label.textContent = opts.label || 'Drop a file here, or click to browse';
        el.classList.remove('dt-filedrop--has-file');
      }
    };
  };

  /* Shared reader: file bytes as a Base64 string (chunked, so
     large files do not blow the call stack). */
  DT.ui.fileDrop.bytesToBase64 = function (buffer) {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };

  DT.ui.fileDrop.formatSize = formatSize;
})();
