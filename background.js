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
 *   - No network. Permissions: storage, system.display.
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

chrome.runtime.onInstalled.addListener(function () {
  // Placeholder for future onboarding.
});