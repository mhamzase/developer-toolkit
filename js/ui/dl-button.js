/**
 * File: js/ui/dl-button.js
 * Module: UI — Download Button Helper
 * Purpose: Build a standard Download button for any tool.
 * Usage:
 *   const btn = DT.ui.dlButton({
 *     getText: () => refs.output.value,
 *     filename: () => DT.utils.download.withTimestamp('json', 'json'),
 *     mime: 'application/json;charset=utf-8',
 *     label: 'Download'
 *   });
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  const ICON_DOWNLOAD =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon dt-icon--sm" ' +
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
      '<polyline points="7 10 12 15 17 10"/>' +
      '<line x1="12" y1="15" x2="12" y2="3"/>' +
    '</svg>';

  DT.ui.dlButton = function (opts) {
    const dom = DT.ui.dom;
    const btn = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--secondary dt-btn--sm',
      'aria-label': opts.label || 'Download',
      title: opts.label || 'Download'
    });

    const icon = dom.svg(ICON_DOWNLOAD);
    if (icon) btn.appendChild(icon);
    btn.appendChild(dom.txt(opts.label || 'Download'));

    btn.addEventListener('click', function () {
      const text = typeof opts.getText === 'function' ? opts.getText() : opts.getText;
      if (!text) {
        DT.ui.toast.info(opts.emptyMsg || 'Nothing to download');
        return;
      }
      const filename = typeof opts.filename === 'function' ? opts.filename() : opts.filename;
      const mime = opts.mime || 'text/plain;charset=utf-8';
      const ok = DT.utils.download.text(text, filename, mime);
      if (ok) DT.ui.toast.success('Downloaded');
      else DT.ui.toast.error('Download failed');
    });

    return btn;
  };
})();