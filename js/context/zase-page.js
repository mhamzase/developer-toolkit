/**
 * File: js/context/zase-page.js
 * Module: Context — In-page runner for right-click actions
 * Purpose: Runs ONE right-click Transform or Generate action inside
 *          the page the user clicked on, copies the result, and
 *          confirms with a small toast. Injected on demand by
 *          background.js via chrome.scripting (never a persistent
 *          content script).
 * Notes:
 *   - The background worker first stores { action, text } on
 *     window.__ZASE_PENDING__; this file consumes and deletes it.
 *   - Fully self-contained: no DT namespace, no shared CSS. The
 *     toast lives in a Shadow DOM root so its styles can neither
 *     leak into the page nor be broken by the page's styles.
 *   - Everything runs locally in the page. Nothing is sent anywhere.
 */

(function () {
  'use strict';

  var pending = window.__ZASE_PENDING__;
  try { delete window.__ZASE_PENDING__; } catch (e) { window.__ZASE_PENDING__ = undefined; }
  if (!pending || !pending.action) return;

  var action = String(pending.action);
  var input = pending.text == null ? '' : String(pending.text);

  /* ---------------- Toast (Shadow DOM, fully scoped) ---------------- */

  var HOST_ID = 'zase-action-toast-host';

  function showToast(message, isError, holdMs) {
    try {
      var host = document.getElementById(HOST_ID);
      if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        /* The host itself is inert: zero size, no pointer events.
           All visuals live inside the shadow root. */
        host.style.cssText =
          'position:fixed;right:18px;bottom:18px;z-index:2147483647;pointer-events:none;';
        (document.body || document.documentElement).appendChild(host);
        host.attachShadow({ mode: 'open' });
      }
      var root = host.shadowRoot;
      root.innerHTML =
        '<style>' +
        '.pill{display:flex;align-items:center;gap:8px;max-width:min(420px,80vw);' +
        'background:#16182b;color:#f4f4f8;border:1px solid rgba(196,181,253,.45);' +
        'border-radius:12px;padding:10px 14px;font:500 13px/1.45 -apple-system,' +
        '"Segoe UI",Roboto,Helvetica,Arial,sans-serif;box-shadow:0 12px 32px ' +
        'rgba(10,10,30,.35);opacity:0;transform:translateY(8px);' +
        'transition:opacity .22s ease,transform .22s ease;word-break:break-word}' +
        '.pill.on{opacity:1;transform:translateY(0)}' +
        '.pill.err{border-color:rgba(252,165,165,.6)}' +
        '.ic{flex:0 0 auto;display:inline-flex}' +
        '</style>' +
        '<div class="pill' + (isError ? ' err' : '') + '" role="status">' +
        '<span class="ic">' + (isError ? ICON_ERR : ICON_OK) + '</span>' +
        '<span class="msg"></span></div>';
      root.querySelector('.msg').textContent = message;
      var pill = root.querySelector('.pill');
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { pill.classList.add('on'); });
      });
      setTimeout(function () {
        pill.classList.remove('on');
        setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 260);
      }, holdMs || 2800);
    } catch (e) {
      /* A page that blocks even this still got its clipboard result. */
    }
  }

  var ICON_OK =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10" fill="#7C3AED"/>' +
    '<path d="M8 12.5l2.6 2.6L16.2 9.5" stroke="#fff" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_ERR =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="10" fill="#B91C1C"/>' +
    '<path d="M9 9l6 6M15 9l-6 6" stroke="#fff" stroke-width="2.2" ' +
    'stroke-linecap="round"/></svg>';

  /* ---------------- Clipboard ---------------- */

  function copyText(text) {
    function fallback() {
      return new Promise(function (resolve, reject) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
          (document.body || document.documentElement).appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
          ta.remove();
          if (ok) resolve(); else reject(new Error('copy blocked'));
        } catch (e) { reject(e); }
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(fallback);
    }
    return fallback();
  }

  function done(label, output) {
    return copyText(output).then(
      function () { showToast(label + ' \u00b7 copied', false); },
      function () { showToast('Done, but the page blocked copying', true); }
    );
  }

  function fail(message) {
    showToast(message, true, 3400);
  }

  /* ---------------- Encoding helpers ---------------- */

  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s+/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function base64UrlToUtf8(part) {
    var b64 = String(part).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return base64ToUtf8(b64);
  }

  /* ---------------- Case helpers ---------------- */

  function splitWords(str) {
    return String(str)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean);
  }

  function toTitle(str) {
    return String(str).toLowerCase().replace(/(^|[\s\-_/])(\S)/g, function (m, sep, ch) {
      return sep + ch.toUpperCase();
    });
  }

  /* ---------------- MD5 (compact, UTF-8 input) ---------------- */

  function md5(str) {
    function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
    function add(x, y) {
      var l = (x & 0xffff) + (y & 0xffff);
      var m = (x >> 16) + (y >> 16) + (l >> 16);
      return (m << 16) | (l & 0xffff);
    }
    function cmn(q, a, b, x, s, t) { return add(rl(add(add(a, q), add(x, t)), s), b); }
    function ff(a, b, c, d, x, s, t) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
    function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
    function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
    function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | ~d), a, b, x, s, t); }

    var bytes = new TextEncoder().encode(str);
    var bitLen = bytes.length * 8;
    var padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    var view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, bitLen >>> 0, true);
    view.setUint32(padded.length - 4, Math.floor(bitLen / 4294967296), true);

    var a0 = 1732584193, b0 = -271733879, c0 = -1732584194, d0 = 271733878;
    var K = [];
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

    var S = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    var FNS = [ff, gg, hh, ii];

    for (var block = 0; block < padded.length; block += 64) {
      var M = [];
      for (var j = 0; j < 16; j++) M[j] = view.getUint32(block + j * 4, true) | 0;
      var A = a0, B = b0, C = c0, D = d0;
      for (var r = 0; r < 64; r++) {
        var round = r >> 4;
        var g = round === 0 ? r : round === 1 ? (5 * r + 1) % 16 : round === 2 ? (3 * r + 5) % 16 : (7 * r) % 16;
        /* Compute with the CURRENT registers first, then rotate the
           tuple so the next step's accumulator sits in A again:
           (A, B, C, D) becomes (D, result, B, C). Rotating before
           the call would feed the round function shifted values. */
        var res = FNS[round](A, B, C, D, M[g], S[r], K[r]);
        var oldB = B, oldC = C, oldD = D;
        A = oldD;
        B = res;
        C = oldB;
        D = oldC;
      }
      a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
    }

    function hex(n) {
      var out = '';
      for (var k = 0; k < 4; k++) out += ('0' + ((n >> (k * 8)) & 0xff).toString(16)).slice(-2);
      return out;
    }
    return hex(a0) + hex(b0) + hex(c0) + hex(d0);
  }

  /* ---------------- Generators ---------------- */

  function randomInt(max) {
    var arr = new Uint32Array(1);
    var limit = Math.floor(4294967296 / max) * max;
    do { crypto.getRandomValues(arr); } while (arr[0] >= limit);
    return arr[0] % max;
  }

  function genPassword() {
    var sets = [
      'abcdefghjkmnpqrstuvwxyz',
      'ABCDEFGHJKMNPQRSTUVWXYZ',
      '23456789',
      '!@#$%^&*()-_=+'
    ];
    var all = sets.join('');
    var chars = sets.map(function (s) { return s[randomInt(s.length)]; });
    while (chars.length < 20) chars.push(all[randomInt(all.length)]);
    /* Fisher-Yates shuffle so the guaranteed characters land anywhere. */
    for (var i = chars.length - 1; i > 0; i--) {
      var j = randomInt(i + 1);
      var t = chars[i]; chars[i] = chars[j]; chars[j] = t;
    }
    return chars.join('');
  }

  function genUuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var h = Array.from(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
      h.slice(16, 20) + '-' + h.slice(20);
  }

  var LOREM_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do ' +
    'eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim ' +
    'veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
    'consequat duis aute irure in reprehenderit voluptate velit esse cillum eu ' +
    'fugiat nulla pariatur').split(' ');

  function genLorem() {
    function sentence() {
      var n = 8 + randomInt(7);
      var words = [];
      for (var i = 0; i < n; i++) words.push(LOREM_WORDS[randomInt(LOREM_WORDS.length)]);
      var s = words.join(' ');
      return s.charAt(0).toUpperCase() + s.slice(1) + '.';
    }
    return sentence() + ' ' + sentence();
  }

  /* ---------------- Actions ---------------- */

  function run() {
    var text = input.trim();

    switch (action) {
      case 'b64-encode': return done('Base64 encoded', utf8ToBase64(input));
      case 'b64-decode':
        try { return done('Base64 decoded', base64ToUtf8(text)); }
        catch (e) { return fail('That selection is not valid Base64'); }
      case 'url-encode': return done('URL encoded', encodeURIComponent(input));
      case 'url-decode':
        try { return done('URL decoded', decodeURIComponent(text)); }
        catch (e) { return fail('That selection is not valid URL encoding'); }
      case 'case-upper': return done('UPPERCASE', input.toUpperCase());
      case 'case-lower': return done('lowercase', input.toLowerCase());
      case 'case-title': return done('Title Case', toTitle(input));
      case 'case-camel': {
        var w = splitWords(input);
        return done('camelCase', w.map(function (word, i) {
          var lower = word.toLowerCase();
          return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        }).join(''));
      }
      case 'case-snake':
        return done('snake_case', splitWords(input).map(function (w) { return w.toLowerCase(); }).join('_'));
      case 'case-kebab':
        return done('kebab-case', splitWords(input).map(function (w) { return w.toLowerCase(); }).join('-'));
      case 'hash-md5': return done('MD5', md5(input));
      case 'hash-sha256': {
        if (!(window.crypto && crypto.subtle)) {
          return fail('SHA-256 needs a secure (HTTPS) page');
        }
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then(function (buf) {
          var hex = Array.from(new Uint8Array(buf), function (b) {
            return ('0' + b.toString(16)).slice(-2);
          }).join('');
          return done('SHA-256', hex);
        }, function () { fail('SHA-256 failed on this page'); });
      }
      case 'json-format':
        try { return done('JSON formatted', JSON.stringify(JSON.parse(text), null, 2)); }
        catch (e) { return fail('Not valid JSON: ' + e.message); }
      case 'json-minify':
        try { return done('JSON minified', JSON.stringify(JSON.parse(text))); }
        catch (e) { return fail('Not valid JSON: ' + e.message); }
      case 'jwt-decode': {
        try {
          var parts = text.split('.');
          if (parts.length < 2) throw new Error('shape');
          var payload = JSON.parse(base64UrlToUtf8(parts[1]));
          return done('JWT payload', JSON.stringify(payload, null, 2));
        } catch (e) { return fail('That selection is not a valid JWT'); }
      }
      case 'timestamp': {
        if (/^\d{10}$/.test(text) || /^\d{13}$/.test(text)) {
          var ms = text.length === 10 ? Number(text) * 1000 : Number(text);
          return done('Date', new Date(ms).toLocaleString());
        }
        var parsed = Date.parse(text);
        if (!isNaN(parsed)) return done('Unix seconds', String(Math.floor(parsed / 1000)));
        return fail('Select an epoch number or a date');
      }
      case 'count': {
        var words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        var lines = text ? text.split(/\r\n|\r|\n/).length : 0;
        showToast(words + ' words · ' + input.length + ' characters · ' + lines + ' lines', false, 4000);
        return Promise.resolve();
      }
      case 'gen-password': return done('Password', genPassword());
      case 'gen-uuid': return done('UUID', genUuid());
      case 'gen-lorem': return done('Lorem ipsum', genLorem());
      default: return Promise.resolve();
    }
  }

  Promise.resolve().then(run).catch(function () {
    fail('Something went wrong with that action');
  });
})();
