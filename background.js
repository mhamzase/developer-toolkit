/**
 * File: background.js
 * Module: Service Worker — Action Handler
 * Purpose: Open Developer Toolkit in a centered window on the user's active screen.
 * Behavior:
 *   - Detects which monitor the user is currently on.
 *   - Centers the app window on that monitor's work area.
 *   - Focuses existing window if already open.
 * Notes:
 *   - Uses chrome.windows.getLastFocused() + system.display.getInfo()
 *   - No network. Permissions: storage, system.display,
 *     contextMenus, sidePanel.
 */

const APP_URL    = chrome.runtime.getURL('popup/popup.html');
const WINDOW_KEY = 'dt:appWindowId';

const APP_WIDTH  = 1000;
const APP_HEIGHT = 720;

/* --------------------------------------------------------------
 * Screen helpers
 * -------------------------------------------------------------- */

/**
 * Get all displays. Returns [] on failure.
 * @returns {Promise<Array>}
 */
async function getDisplays() {
  try {
    if (chrome.system && chrome.system.display && chrome.system.display.getInfo) {
      const list = await chrome.system.display.getInfo();
      return Array.isArray(list) ? list : [];
    }
  } catch (e) {
    console.warn('[DT] display.getInfo failed:', e);
  }
  return [];
}

/**
 * Find the display whose bounds contain the given point.
 * @param {Array} displays
 * @param {number} x
 * @param {number} y
 * @returns {Object|null}
 */
function displayContaining(displays, x, y) {
  for (let i = 0; i < displays.length; i++) {
    const b = displays[i].bounds || displays[i].workArea;
    if (!b) continue;
    if (x >= b.left && x < b.left + b.width &&
        y >= b.top  && y < b.top  + b.height) {
      return displays[i];
    }
  }
  return null;
}

/**
 * Find the display closest to the given point (fallback).
 * @param {Array} displays
 * @param {number} x
 * @param {number} y
 * @returns {Object|null}
 */
function displayClosestTo(displays, x, y) {
  if (!displays.length) return null;

  let best = null;
  let bestDist = Infinity;

  displays.forEach(function (d) {
    const b = d.bounds || d.workArea;
    if (!b) return;
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist < bestDist) { bestDist = dist; best = d; }
  });

  return best;
}

/**
 * Determine which display the user is currently on.
 * Order of preference:
 *   1. Display containing the last-focused Chrome window's center
 *   2. Display closest to the last-focused Chrome window's center
 *   3. Primary display
 *   4. First display
 *   5. Fallback (single-screen default)
 * @returns {Promise<{left:number, top:number, width:number, height:number}>}
 */
async function getActiveWorkArea() {
  const fallback = { left: 0, top: 0, width: 1280, height: 800 };

  const displays = await getDisplays();
  if (!displays.length) return fallback;

  /* Find where the user currently is (last focused Chrome window) */
  let focusedBounds = null;
  try {
    const lastWin = await chrome.windows.getLastFocused({ populate: false });
    if (lastWin && lastWin.left != null && lastWin.top != null) {
      focusedBounds = {
        left:   lastWin.left,
        top:    lastWin.top,
        width:  lastWin.width  || 0,
        height: lastWin.height || 0
      };
    }
  } catch (e) {
    // No focused window (rare) — fall through.
  }

  let target = null;

  if (focusedBounds) {
    const cx = focusedBounds.left + focusedBounds.width  / 2;
    const cy = focusedBounds.top  + focusedBounds.height / 2;

    target = displayContaining(displays, cx, cy) ||
             displayClosestTo(displays, cx, cy);
  }

  if (!target) {
    target = displays.find(function (d) { return d.isPrimary; }) || displays[0];
  }

  const wa = target.workArea || target.bounds;
  if (!wa || !wa.width || !wa.height) return fallback;

  return {
    left:   wa.left   || 0,
    top:    wa.top    || 0,
    width:  wa.width,
    height: wa.height
  };
}

/**
 * Compute centered top-left coordinates for a window of the given size.
 * @param {{left:number, top:number, width:number, height:number}} area
 * @param {number} winWidth
 * @param {number} winHeight
 * @returns {{left:number, top:number, width:number, height:number}}
 */
function centerInArea(area, winWidth, winHeight) {
  const w = Math.min(winWidth,  area.width  - 40);
  const h = Math.min(winHeight, area.height - 40);

  return {
    left:   Math.round(area.left + (area.width  - w) / 2),
    top:    Math.round(area.top  + (area.height - h) / 2),
    width:  w,
    height: h
  };
}

/* --------------------------------------------------------------
 * Open / focus
 * -------------------------------------------------------------- */

async function openOrFocusApp() {
  /* 1. Existing window? Focus it. */
  let existingId = null;
  try {
    const stored = await chrome.storage.session.get(WINDOW_KEY);
    existingId = stored && stored[WINDOW_KEY];
  } catch (e) {
    existingId = null;
  }

  if (existingId != null) {
    try {
      const win = await chrome.windows.get(existingId, { populate: false });
      if (win && typeof win.id === 'number') {
        await chrome.windows.update(existingId, { focused: true, drawAttention: true });
        return;
      }
    } catch (e) {
      // Window gone — fall through to create.
    }
  }

  /* 2. Create a new window centered on the active screen. */
  const area = await getActiveWorkArea();
  const pos  = centerInArea(area, APP_WIDTH, APP_HEIGHT);

  const created = await chrome.windows.create({
    url:     APP_URL,
    type:    'popup',
    width:   pos.width,
    height:  pos.height,
    left:    pos.left,
    top:     pos.top,
    focused: true
  });

  try {
    await chrome.storage.session.set({ [WINDOW_KEY]: created.id });
  } catch (e) {
    console.warn('[DT] Could not store window id:', e);
  }

  /* 3. Some Chrome/OS combos ignore left/top on create.
   *    Re-apply via update as a safety net.
   *    Only do this if the window is clearly off from where we asked. */
  try {
    const after = await chrome.windows.get(created.id, { populate: false });
    if (after &&
        (Math.abs(after.left - pos.left) > 40 ||
         Math.abs(after.top  - pos.top)  > 40)) {
      await chrome.windows.update(created.id, {
        left: pos.left,
        top:  pos.top
      });
    }
  } catch (e) {
    // Not fatal.
  }
}

/* --------------------------------------------------------------
 * Events
 * -------------------------------------------------------------- */

chrome.action.onClicked.addListener(function () {
  openOrFocusApp().catch(function (e) {
    console.error('[DT] Failed to open app window:', e);
  });
});

chrome.windows.onRemoved.addListener(async function (closedId) {
  try {
    const stored = await chrome.storage.session.get(WINDOW_KEY);
    if (stored && stored[WINDOW_KEY] === closedId) {
      await chrome.storage.session.remove(WINDOW_KEY);
    }
  } catch (e) {
    // ignore
  }
});

/* --------------------------------------------------------------
 * Phase 3 integrations: context menus, omnibox, commands,
 * side panel. The page side of pending navigation lives in
 * js/core/app.js (dt:pendingNav).
 * -------------------------------------------------------------- */

const PENDING_KEY = 'dt:pendingNav';

/** Ask the app to open a tool, optionally prefilled with text. */
async function openTool(toolId, text) {
  try {
    await chrome.storage.local.set({ [PENDING_KEY]: { toolId: toolId, text: text || '' } });
  } catch (e) {
    // Storage failure should not block opening the window.
  }
  await openOrFocusApp();
}

const MENU_SELECTION = {
  'dt-sel-jwt': 'jwt',
  'dt-sel-base64': 'base64',
  'dt-sel-url': 'url',
  'dt-sel-hash': 'hash'
};

function createContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({
      id: 'dt-open',
      title: 'Open Developer Toolkit',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'dt-sidepanel',
      title: 'Open Developer Toolkit in Side Panel',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'dt-sel-parent',
      title: 'Developer Toolkit',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dt-sel-jwt',
      parentId: 'dt-sel-parent',
      title: 'Decode as JWT',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dt-sel-base64',
      parentId: 'dt-sel-parent',
      title: 'Decode as Base64',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dt-sel-url',
      parentId: 'dt-sel-parent',
      title: 'Decode as URL',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'dt-sel-hash',
      parentId: 'dt-sel-parent',
      title: 'Hash with SHA-256',
      contexts: ['selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(function () {
  createContextMenus();
  try {
    if (chrome.sidePanel && chrome.sidePanel.setOptions) {
      chrome.sidePanel.setOptions({ path: 'popup/popup.html', enabled: true });
    }
  } catch (e) {
    // Side panel is optional; the window flow still works.
  }
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'dt-open') {
    openOrFocusApp().catch(function () {});
    return;
  }
  if (info.menuItemId === 'dt-sidepanel') {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.windowId != null) {
        chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (e) {
      // Opening from a menu is best-effort.
    }
    return;
  }
  const toolId = MENU_SELECTION[info.menuItemId];
  if (toolId && info.selectionText) {
    openTool(toolId, info.selectionText.trim()).catch(function () {});
  }
});

/* Omnibox: type "dt" in the address bar, then a tool name. */
const OMNIBOX_TOOLS = [
  ['json', 'JSON Formatter', 'format validate minify sort keys tree csv yaml xml'],
  ['jwt', 'JWT Decoder', 'token decode header payload'],
  ['base64', 'Base64', 'encode decode'],
  ['url', 'URL Encoder', 'uri encode decode query'],
  ['uuid', 'UUID and ID Generator', 'guid v4 v7 ulid nano id'],
  ['timestamp', 'Timestamp Converter', 'unix epoch date timezone'],
  ['case', 'Case Converter', 'camel snake kebab pascal'],
  ['color', 'Color Tools', 'hex rgb hsl oklch contrast palette'],
  ['hash', 'Hash Generator', 'md5 sha1 sha256 hmac'],
  ['text', 'Text Utilities', 'word count sort lines slug'],
  ['regex', 'Regex Tester', 'regular expression match replace patterns'],
  ['diff', 'Diff Checker', 'compare text word'],
  ['password', 'Password Generator', 'random passphrase pin strong'],
  ['lorem', 'Lorem Ipsum', 'placeholder text filler'],
  ['http', 'HTTP Status Codes', 'reference 200 404 500'],
  ['cron', 'Cron Parser', 'schedule expression builder'],
  ['base', 'Number Base Converter', 'binary octal decimal hex'],
  ['chmod', 'chmod Calculator', 'unix permissions octal rwx'],
  ['sql', 'SQL Formatter', 'query format beautify'],
  ['markdown', 'Markdown Preview', 'md render html'],
  ['qr', 'QR Code Generator', 'qr code link offline']
];

if (chrome.omnibox) {
  chrome.omnibox.setDefaultSuggestion({
    description: 'Developer Toolkit: type a tool name, e.g. json, jwt, cron'
  });
  chrome.omnibox.onInputChanged.addListener(function (text, suggest) {
    const q = String(text || '').trim().toLowerCase();
    if (!q) return;
    const hits = OMNIBOX_TOOLS.filter(function (t) {
      return t[1].toLowerCase().includes(q) || t[2].includes(q) || t[0].includes(q);
    }).slice(0, 6);
    suggest(hits.map(function (t) {
      return { content: t[0], description: t[1] + ' - Developer Toolkit' };
    }));
  });
  chrome.omnibox.onInputEntered.addListener(function (text) {
    const q = String(text || '').trim().toLowerCase();
    const byId = OMNIBOX_TOOLS.find(function (t) { return t[0] === q; });
    const byName = OMNIBOX_TOOLS.find(function (t) {
      return t[1].toLowerCase().includes(q) || t[2].includes(q);
    });
    const hit = byId || byName;
    if (hit) {
      openTool(hit[0], '').catch(function () {});
    } else {
      openOrFocusApp().catch(function () {});
    }
  });
}

/* Keyboard command (Alt+Shift+D) opens the app window. */
chrome.commands.onCommand.addListener(function (command) {
  if (command === 'open-toolkit') {
    openOrFocusApp().catch(function (e) {
      console.error('[DT] Command open failed:', e);
    });
  }
});