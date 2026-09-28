# Module Map

## Layers (bottom → top)

1. `utils/`  — pure helpers. No DOM. No state. Reusable anywhere.
2. `core/`   — app state, storage, theme, routing, registry. Owns the shell.
3. `ui/`     — DOM rendering. Reads core state, emits user intent via router.
4. `tools/`  — 10 self-contained tool modules. Isolated DOM. Register on load.
5. `popup/`  — entry point. Boots `DT.core.app`.

## Namespace

Everything lives under `window.DT`:

- `DT.utils.escape`    — HTML escaping helper
- `DT.utils.debounce`  — delay repeated calls
- `DT.utils.clipboard` — safe clipboard write
- `DT.utils.icons`     — inline SVG registry
- `DT.core.storage`    — chrome.storage.local wrapper (Promise)
- `DT.core.theme`      — light/dark engine
- `DT.core.registry`   — tool metadata + filtering
- `DT.core.router`     — view state + navigation
- `DT.core.app`        — bootstrap
- `DT.ui.dom`          — element creation helpers
- `DT.ui.toast`        — toast notifications
- `DT.ui.header`       — top bar
- `DT.ui.nav`          — category tabs
- `DT.ui.grid`         — tool card grid
- `DT.ui.toolview`     — tool mount container
- `DT.ui.footer`       — version + local badge
- `DT.tools.<id>`      — each tool object

## Tool contract

Every tool exposes:

    {
      id: 'json',
      name: 'JSON Formatter',
      category: 'Data',
      icon: 'braces',
      description: 'Format, validate, and minify JSON.',
      mount(container) { /* build UI, attach listeners */ },
      unmount() { /* remove listeners, clear state */ }
    }

See `TOOL_INTERFACE.md` for the full contract.

## Load order

`popup.html` loads:

1. utils → 2. core → 3. ui → 4. tools → 5. popup.js

CSS loads:

1. variables → 2. themes → 3. base → 4. components → 5. layout → 6. responsive → 7. popup