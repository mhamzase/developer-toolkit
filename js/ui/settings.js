/**
 * File: js/ui/settings.js
 * Module: UI — Settings Menu
 * Purpose: Gear button + small dropdown for app settings.
 */

(function () {
  "use strict";

  const DT = (window.DT = window.DT || {});
  DT.ui = DT.ui || {};

  let menu = null;
  let isOpen = false;
  let outsideHandler = null;

  const ICON_GEAR =
    '<svg xmlns="http://www.w3.org/2000/svg" class="dt-icon" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' +
    "</svg>";

  /* ---------------- Menu ---------------- */

  /**
   * Build a toggle row.
   * @param {string} id
   * @param {string} label
   * @param {string} hint
   * @param {boolean} checked
   * @param {string} [badge] — optional small badge text (e.g. "Recommended")
   */
  function toggleRow(id, label, hint, checked, badge) {
    const dom = DT.ui.dom;

    const cb = dom.el("input", { type: "checkbox", id: id });
    cb.checked = !!checked;

    /* Label line — with optional badge */
    const labelLine = badge
      ? dom.el("div", { class: "dt-settings__row-label-wrap" }, [
          dom.el("span", { class: "dt-settings__row-label", text: label }),
          dom.el("span", { class: "dt-settings__row-badge", text: badge }),
        ])
      : dom.el("div", { class: "dt-settings__row-label", text: label });

    return {
      el: dom.el("label", { class: "dt-settings__row", for: id }, [
        cb,
        dom.el("div", { class: "dt-settings__row-main" }, [
          labelLine,
          dom.el("div", { class: "dt-settings__row-hint", text: hint }),
        ]),
      ]),
      input: cb,
    };
  }

  function buildMenu() {
    const dom = DT.ui.dom;
    const settings = DT.core.session.getSettings();

    /* Toggle rows */
    const persistRow = toggleRow(
      "dt-set-persist",
      "Save tool inputs",
      "Restore text when you come back",
      settings.persistInput,
    );

    /* Wire toggle */
    persistRow.input.addEventListener("change", function () {
      DT.core.session.set("persistInput", persistRow.input.checked);
      DT.ui.toast.success(persistRow.input.checked ? "Enabled" : "Disabled");
    });

    /* Theme mode: Light / Dark / System */
    const themeModes = [
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
      { id: 'system', label: 'System' },
    ];
    const themeBtns = [];
    const themeGroup = dom.el("div", { class: "dt-settings__seg", role: "group", "aria-label": "Theme" });
    function paintThemeSeg() {
      const mode = DT.core.theme.getMode ? DT.core.theme.getMode() : DT.core.theme.current;
      themeBtns.forEach(function (b) {
        b.el.classList.toggle("dt-settings__seg-btn--on", b.id === mode);
      });
    }
    themeModes.forEach(function (m) {
      const btn = dom.el("button", {
        type: "button",
        class: "dt-settings__seg-btn",
        text: m.label,
      });
      btn.addEventListener("click", function () {
        DT.core.theme.setMode(m.id);
        paintThemeSeg();
      });
      themeBtns.push({ id: m.id, el: btn });
      themeGroup.appendChild(btn);
    });
    const themeRow = dom.el("div", { class: "dt-settings__theme" }, [
      dom.el("div", { class: "dt-settings__row-main" }, [
        dom.el("div", { class: "dt-settings__row-label", text: "Theme" }),
        dom.el("div", {
          class: "dt-settings__row-hint",
          text: "System follows your OS appearance",
        }),
      ]),
      themeGroup,
    ]);
    paintThemeSeg();
    if (typeof DT.core.theme.on === "function") DT.core.theme.on(paintThemeSeg);

    /* Side Panel: open the same app docked in Chrome's side panel */
    let sidePanelRow = null;
    try {
      if (window.chrome && chrome.sidePanel && chrome.sidePanel.open) {
        const sideBtn = dom.el("button", {
          type: "button",
          class: "dt-btn dt-btn--secondary dt-btn--sm dt-btn--block",
          text: "Open in Side Panel",
        });
        sideBtn.addEventListener("click", function () {
          chrome.windows.getCurrent(function (win) {
            chrome.sidePanel
              .open({ windowId: win.id })
              .then(function () { close(); })
              .catch(function () {
                DT.ui.toast.error("Side Panel could not be opened");
              });
          });
        });
        sidePanelRow = sideBtn;
      }
    } catch (e) {
      sidePanelRow = null;
    }

    /* Danger zone */
    const clearBtn = dom.el("button", {
      type: "button",
      class: "dt-btn dt-btn--danger dt-btn--sm dt-btn--block",
      text: "Clear all saved data",
    });
    clearBtn.addEventListener("click", function () {
      DT.ui.confirm
        .open({
          title: "Clear all saved data?",
          message:
            "This removes favorites, recents, saved inputs, and color swatches, and resets settings to defaults. This cannot be undone.",
          confirmText: "Clear everything",
          cancelText: "Cancel",
          danger: true,
        })
        .then(function (ok) {
          if (!ok) return;
          DT.core.session.clearAllSaved().then(function () {
            DT.ui.toast.success("All data cleared");
            close();
            setTimeout(function () {
              location.reload();
            }, 400);
          });
        });
    });

    const el = dom.el("div", { class: "dt-settings" }, [
      dom.el("div", { class: "dt-settings__head" }, [
        dom.el("div", { class: "dt-settings__title", text: "Settings" }),
      ]),
        dom.el('div', { class: 'dt-settings__body' }, [
          themeRow,
          dom.el('div', { class: 'dt-settings__divider' }),
          persistRow.el,
          ...(sidePanelRow
            ? [dom.el('div', { class: 'dt-settings__divider' }), sidePanelRow]
            : []),
          dom.el('div', { class: 'dt-settings__divider' }),
          clearBtn
        ])
    ]);

    el.style.display = "none";
    el.style.pointerEvents = "none";

    return el;
  }

  /* ---------------- Open / close ---------------- */

  function close() {
    if (!isOpen || !menu) return;
    isOpen = false;
    menu.classList.remove("dt-settings--open");
    menu.style.pointerEvents = "none";
    setTimeout(function () {
      if (menu) menu.style.display = "none";
    }, 180);

    if (outsideHandler) {
      document.removeEventListener("mousedown", outsideHandler, true);
      outsideHandler = null;
    }
  }

  function open(anchor) {
    if (!menu) {
      menu = buildMenu();
      document.body.appendChild(menu);
    }
    if (isOpen) return;
    isOpen = true;

    /* Position near the anchor, clamped to the viewport. The anchor
       now lives in the left sidebar, so position by left edge and
       flip above the anchor when there is not enough room below. */
    const rect = anchor.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.display = "block";
    const menuW = menu.offsetWidth || 280;
    const menuH = menu.offsetHeight || 320;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuW - 8));
    let top = rect.bottom + 6;
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 6);
    }
    menu.style.left = left + "px";
    menu.style.right = "auto";
    menu.style.top = top + "px";
    menu.style.pointerEvents = "auto";
    requestAnimationFrame(function () {
      menu.classList.add("dt-settings--open");
    });

    /* Outside click closes */
    outsideHandler = function (e) {
      if (
        !menu.contains(e.target) &&
        e.target !== anchor &&
        !anchor.contains(e.target)
      ) {
        close();
      }
    };
    document.addEventListener("mousedown", outsideHandler, true);

    /* Escape closes */
    const escHandler = function (e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escHandler, true);
      }
    };
    document.addEventListener("keydown", escHandler, true);
  }

  /* ---------------- Public ---------------- */

  DT.ui.settings = {
    render: function () {
      const dom = DT.ui.dom;
      const btn = dom.el("button", {
        type: "button",
        class: "dt-btn dt-btn--ghost dt-btn--icon",
        "aria-label": "Settings",
        title: "Settings",
      });
      const icon = dom.svg(ICON_GEAR);
      if (icon) btn.appendChild(icon);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (isOpen) close();
        else open(btn);
      });
      return btn;
    },
  };
})();
