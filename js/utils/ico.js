/**
 * File: js/utils/ico.js
 * Module: Utils — ICO Writer
 * Purpose: Build a Windows .ico file from PNG images. Modern
 *          browsers accept PNG-compressed entries inside an ICO
 *          container, so the file is just a small directory
 *          header followed by the PNG bytes, no BMP encoding
 *          and no compression library needed.
 * Format: ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per
 *         image + the PNG data blocks back to back.
 */

(function () {
  'use strict';

  const DT = (window.DT = window.DT || {});
  DT.utils = DT.utils || {};

  DT.utils.ico = {
    /**
     * @param {Array<{size:number, png:Uint8Array}>} images
     *        Square PNGs; size is the pixel width (16, 32, 48...).
     * @returns {Uint8Array} the .ico file bytes
     */
    build: function (images) {
      const list = (images || []).filter(function (im) {
        return im && im.png && im.png.length && im.size > 0 && im.size <= 256;
      });
      const headerSize = 6 + list.length * 16;
      let total = headerSize;
      list.forEach(function (im) { total += im.png.length; });

      const out = new Uint8Array(total);
      const view = new DataView(out.buffer);
      let offset = 0;

      /* ICONDIR: reserved, type (1 = icon), image count */
      view.setUint16(offset, 0, true); offset += 2;
      view.setUint16(offset, 1, true); offset += 2;
      view.setUint16(offset, list.length, true); offset += 2;

      /* Entries; image data starts right after the directory */
      let dataOffset = headerSize;
      list.forEach(function (im) {
        const dim = im.size >= 256 ? 0 : im.size; // 256 is stored as 0
        out[offset++] = dim;         // width
        out[offset++] = dim;         // height
        out[offset++] = 0;           // palette colors (none)
        out[offset++] = 0;           // reserved
        view.setUint16(offset, 1, true); offset += 2;   // color planes
        view.setUint16(offset, 32, true); offset += 2;  // bits per pixel
        view.setUint32(offset, im.png.length, true); offset += 4;
        view.setUint32(offset, dataOffset, true); offset += 4;
        dataOffset += im.png.length;
      });

      /* PNG payloads */
      list.forEach(function (im) {
        out.set(im.png, offset);
        offset += im.png.length;
      });

      return out;
    }
  };
})();
