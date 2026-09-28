/**
 * File: js/tools/http.js
 * Module: Tool — HTTP Status Codes
 * Purpose: Searchable reference for HTTP status codes.
 * Notes: Static data. No network. No input state needed.
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

  /* ---------------- Data ---------------- */

  const CODES = [
    // 1xx Informational
    { code: 100, name: 'Continue',                 class: '1xx', desc: 'Client should continue with its request.' },
    { code: 101, name: 'Switching Protocols',      class: '1xx', desc: 'Server is switching protocols per Upgrade header.' },
    { code: 102, name: 'Processing',               class: '1xx', desc: 'Server has received and is processing the request (WebDAV).' },
    { code: 103, name: 'Early Hints',              class: '1xx', desc: 'Preload hint while the server prepares a response.' },

    // 2xx Success
    { code: 200, name: 'OK',                       class: '2xx', desc: 'Standard success — request succeeded.' },
    { code: 201, name: 'Created',                  class: '2xx', desc: 'Resource successfully created.' },
    { code: 202, name: 'Accepted',                 class: '2xx', desc: 'Request accepted but not yet processed.' },
    { code: 203, name: 'Non-Authoritative Information', class: '2xx', desc: 'Returned metadata is from a local or third-party copy.' },
    { code: 204, name: 'No Content',               class: '2xx', desc: 'Success, but no content to return.' },
    { code: 205, name: 'Reset Content',            class: '2xx', desc: 'Client should reset the document view.' },
    { code: 206, name: 'Partial Content',          class: '2xx', desc: 'Partial response to a Range request.' },
    { code: 207, name: 'Multi-Status',             class: '2xx', desc: 'Multiple status codes for multiple resources (WebDAV).' },
    { code: 208, name: 'Already Reported',         class: '2xx', desc: 'Members already enumerated in a prior response (WebDAV).' },
    { code: 226, name: 'IM Used',                  class: '2xx', desc: 'Response is a delta-encoded result of instance manipulations.' },

    // 3xx Redirection
    { code: 300, name: 'Multiple Choices',         class: '3xx', desc: 'Multiple options for the resource.' },
    { code: 301, name: 'Moved Permanently',        class: '3xx', desc: 'Resource has permanently moved to a new URL.' },
    { code: 302, name: 'Found',                    class: '3xx', desc: 'Temporary redirect — same as 303 in practice.' },
    { code: 303, name: 'See Other',                class: '3xx', desc: 'Redirect to a different URL using GET.' },
    { code: 304, name: 'Not Modified',             class: '3xx', desc: 'Cached resource is still valid — no body returned.' },
    { code: 305, name: 'Use Proxy',                class: '3xx', desc: 'Deprecated — resource must be accessed via proxy.' },
    { code: 307, name: 'Temporary Redirect',       class: '3xx', desc: 'Temporary redirect — preserve the method.' },
    { code: 308, name: 'Permanent Redirect',       class: '3xx', desc: 'Permanent redirect — preserve the method.' },

    // 4xx Client Error
    { code: 400, name: 'Bad Request',              class: '4xx', desc: 'Server cannot process the request due to client error.' },
    { code: 401, name: 'Unauthorized',             class: '4xx', desc: 'Authentication required or has failed.' },
    { code: 402, name: 'Payment Required',         class: '4xx', desc: 'Reserved for future use.' },
    { code: 403, name: 'Forbidden',                class: '4xx', desc: 'Server understood but refuses to authorize.' },
    { code: 404, name: 'Not Found',                class: '4xx', desc: 'Requested resource not found.' },
    { code: 405, name: 'Method Not Allowed',       class: '4xx', desc: 'HTTP method not allowed for this resource.' },
    { code: 406, name: 'Not Acceptable',           class: '4xx', desc: 'Cannot produce a response matching Accept headers.' },
    { code: 407, name: 'Proxy Authentication Required', class: '4xx', desc: 'Must authenticate with the proxy first.' },
    { code: 408, name: 'Request Timeout',          class: '4xx', desc: 'Server timed out waiting for the request.' },
    { code: 409, name: 'Conflict',                 class: '4xx', desc: 'Request conflicts with current state of the resource.' },
    { code: 410, name: 'Gone',                     class: '4xx', desc: 'Resource is permanently gone.' },
    { code: 411, name: 'Length Required',          class: '4xx', desc: 'Content-Length header required.' },
    { code: 412, name: 'Precondition Failed',      class: '4xx', desc: 'Precondition in request headers evaluated to false.' },
    { code: 413, name: 'Payload Too Large',        class: '4xx', desc: 'Request entity is larger than server will accept.' },
    { code: 414, name: 'URI Too Long',             class: '4xx', desc: 'Requested URI is too long.' },
    { code: 415, name: 'Unsupported Media Type',   class: '4xx', desc: 'Payload format is not supported.' },
    { code: 416, name: 'Range Not Satisfiable',    class: '4xx', desc: 'Range header cannot be fulfilled.' },
    { code: 417, name: 'Expectation Failed',       class: '4xx', desc: 'Expect header cannot be met.' },
    { code: 418, name: "I'm a Teapot",             class: '4xx', desc: 'April Fools RFC — server refuses to brew coffee.' },
    { code: 421, name: 'Misdirected Request',      class: '4xx', desc: 'Request was directed at a server that cannot respond.' },
    { code: 422, name: 'Unprocessable Entity',     class: '4xx', desc: 'Request is well-formed but semantically invalid (WebDAV).' },
    { code: 423, name: 'Locked',                   class: '4xx', desc: 'Resource is locked (WebDAV).' },
    { code: 424, name: 'Failed Dependency',        class: '4xx', desc: 'Request failed due to a previous request (WebDAV).' },
    { code: 425, name: 'Too Early',                class: '4xx', desc: 'Server unwilling to risk processing a replayed request.' },
    { code: 426, name: 'Upgrade Required',         class: '4xx', desc: 'Client must upgrade to a different protocol.' },
    { code: 428, name: 'Precondition Required',    class: '4xx', desc: 'Origin server requires the request to be conditional.' },
    { code: 429, name: 'Too Many Requests',        class: '4xx', desc: 'Rate limited — too many requests in a short time.' },
    { code: 431, name: 'Request Header Fields Too Large', class: '4xx', desc: 'Header fields are too large.' },
    { code: 451, name: 'Unavailable For Legal Reasons', class: '4xx', desc: 'Resource is unavailable due to legal reasons.' },

    // 5xx Server Error
    { code: 500, name: 'Internal Server Error',    class: '5xx', desc: 'Unexpected condition prevented the request from completing.' },
    { code: 501, name: 'Not Implemented',          class: '5xx', desc: 'Server does not support the requested functionality.' },
    { code: 502, name: 'Bad Gateway',              class: '5xx', desc: 'Invalid response from an upstream server.' },
    { code: 503, name: 'Service Unavailable',      class: '5xx', desc: 'Server is temporarily unavailable — overloaded or under maintenance.' },
    { code: 504, name: 'Gateway Timeout',          class: '5xx', desc: 'Upstream server did not respond in time.' },
    { code: 505, name: 'HTTP Version Not Supported', class: '5xx', desc: 'HTTP protocol version is not supported.' },
    { code: 506, name: 'Variant Also Negotiates',  class: '5xx', desc: 'Content negotiation is circular.' },
    { code: 507, name: 'Insufficient Storage',     class: '5xx', desc: 'Server cannot store the representation (WebDAV).' },
    { code: 508, name: 'Loop Detected',            class: '5xx', desc: 'Infinite loop detected while processing (WebDAV).' },
    { code: 510, name: 'Not Extended',             class: '5xx', desc: 'Further extensions to the request are required.' },
    { code: 511, name: 'Network Authentication Required', class: '5xx', desc: 'Client must authenticate to gain network access.' }
  ];

  const CLASS_COLORS = {
    '1xx': 'info',
    '2xx': 'success',
    '3xx': 'warning',
    '4xx': 'danger',
    '5xx': 'danger'
  };

  const CLASS_LABELS = {
    '1xx': '1xx — Informational',
    '2xx': '2xx — Success',
    '3xx': '3xx — Redirection',
    '4xx': '4xx — Client Error',
    '5xx': '5xx — Server Error'
  };

  /* ---------------- Rendering ---------------- */

  function filterCodes(query, classFilter) {
    const q = String(query || '').trim().toLowerCase();
    return CODES.filter((c) => {
      if (classFilter !== 'All' && c.class !== classFilter) return false;
      if (!q) return true;
      return (
        String(c.code).indexOf(q) !== -1 ||
        c.name.toLowerCase().indexOf(q) !== -1 ||
        c.desc.toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function buildRow(entry) {
    const dom = DT.ui.dom;

    const tone = CLASS_COLORS[entry.class] || 'accent';
    const codeBadge = dom.el('span', {
      class: 'dt-http-code dt-http-code--' + tone,
      text: String(entry.code)
    });

    const name = dom.el('div', { class: 'dt-http-name', text: entry.name });
    const desc = dom.el('div', { class: 'dt-http-desc', text: entry.desc });

    const btnCopy = dom.el('button', {
      type: 'button',
      class: 'dt-btn dt-btn--ghost dt-btn--icon dt-btn--sm',
      'aria-label': 'Copy code',
      title: 'Copy code + name'
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
      DT.utils.clipboard.copy(entry.code + ' ' + entry.name)
        .then(() => DT.ui.toast.success('Copied'))
        .catch(() => DT.ui.toast.error('Copy failed'));
    });

    const textWrap = dom.el('div', { class: 'dt-http-text' }, [name, desc]);

    return dom.el('div', { class: 'dt-http-row' }, [
      codeBadge,
      textWrap,
      btnCopy
    ]);
  }

  function renderList() {
    const dom = DT.ui.dom;
    const slot = refs.listSlot;
    dom.clear(slot);

    const query = refs.search.value;
    const classFilter = refs.classFilter.value;
    const results = filterCodes(query, classFilter);

    if (!results.length) {
      slot.appendChild(dom.el('div', { class: 'dt-empty' }, [
        dom.el('div', { class: 'dt-empty__title', text: 'No matching codes' }),
        dom.el('div', { class: 'dt-empty__text', text: 'Try a different search or class filter.' })
      ]));
      updateStats(0);
      return;
    }

    // Group by class when showing "All"; else show flat list
    if (classFilter === 'All' && !query.trim()) {
      const groups = ['1xx', '2xx', '3xx', '4xx', '5xx'];
      groups.forEach((cls) => {
        const rows = results.filter(r => r.class === cls);
        if (!rows.length) return;

        const section = dom.el('div', { class: 'dt-http-section' });
        section.appendChild(dom.el('div', {
          class: 'dt-http-section__head',
          text: CLASS_LABELS[cls]
        }));

        const body = dom.el('div', { class: 'dt-http-section__body' });
        rows.forEach(r => body.appendChild(buildRow(r)));
        section.appendChild(body);

        slot.appendChild(section);
      });
    } else {
      const body = dom.el('div', { class: 'dt-http-section__body' });
      results.forEach(r => body.appendChild(buildRow(r)));
      slot.appendChild(body);
    }

    updateStats(results.length);
  }

  function updateStats(count) {
    const dom = DT.ui.dom;
    const el = refs.statsSlot;
    dom.clear(el);
    el.appendChild(dom.el('span', { class: 'dt-stat' }, [
      dom.txt('Showing '),
      dom.el('span', { class: 'dt-stat__value', text: String(count) })
    ]));
    el.appendChild(dom.el('span', { class: 'dt-stat' }, [
      dom.txt('Total '),
      dom.el('span', { class: 'dt-stat__value', text: String(CODES.length) })
    ]));
  }

  function clearSearch() {
    refs.search.value = '';
    refs.classFilter.value = 'All';
    renderList();
    refs.search.focus();
  }

  /* ---------------- Tool registration ---------------- */

  DT.tools.http = {
    id: 'http',
    name: 'HTTP Status Codes',
    category: 'Reference',
    icon: 'http',
    description: 'Searchable reference for all HTTP status codes.',

    mount(container) {
      const dom = DT.ui.dom;
      const workspace = dom.el('div', { class: 'dt-workspace' });

      /* --- Toolbar: search + class filter + clear --- */
      const search = dom.el('input', {
        type: 'search',
        class: 'dt-input',
        id: 'dt-http-search',
        autocomplete: 'off',
        spellcheck: 'false',
        placeholder: 'Search code, name, or description…'
      });
      search.style.minWidth = '220px';

      const classFilter = dom.el('select', {
        class: 'dt-select dt-select--sm',
        id: 'dt-http-class'
      }, [
        dom.el('option', { value: 'All', text: 'All classes' }),
        dom.el('option', { value: '1xx', text: '1xx' }),
        dom.el('option', { value: '2xx', text: '2xx' }),
        dom.el('option', { value: '3xx', text: '3xx' }),
        dom.el('option', { value: '4xx', text: '4xx' }),
        dom.el('option', { value: '5xx', text: '5xx' })
      ]);
      classFilter.style.width = '130px';

      const btnClear = dom.el('button', { type: 'button', class: 'dt-btn dt-btn--ghost dt-btn--sm', text: 'Clear' });

      const toolbar = dom.el('div', { class: 'dt-toolbar' }, [
        dom.el('div', { class: 'dt-toolbar__group' }, [
          dom.el('span', { class: 'dt-toolbar__label', text: 'Find' }),
          search,
          classFilter
        ]),
        btnClear
      ]);

      /* --- Results panel --- */
      const listSlot = dom.el('div', { id: 'dt-http-list' });
      const statsSlot = dom.el('div', { class: 'dt-stats' });

      const panel = dom.el('div', { class: 'dt-panel' }, [
        dom.el('div', { class: 'dt-panel__head' }, [
          dom.el('div', { class: 'dt-panel__title', text: 'Status codes' })
        ]),
        listSlot,
        dom.el('div', { class: 'dt-panel__foot' }, [statsSlot])
      ]);

      workspace.appendChild(toolbar);
      workspace.appendChild(panel);
      container.appendChild(workspace);

      refs = { search, classFilter, listSlot, statsSlot };

      /* --- Events --- */
      const updateDebounced = DT.utils.debounce(renderList, 120);

      on(search, 'input', updateDebounced);
      on(classFilter, 'change', renderList);
      on(btnClear, 'click', clearSearch);

      on(search, 'keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          clearSearch();
        }
      });

      /* --- Initial --- */
      renderList();
      search.focus();
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