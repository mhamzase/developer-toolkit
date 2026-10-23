# Changelog

All notable changes to Developer Toolkit.

## [1.1.0] — 2026-10-24

### Changed (Clean Pro redesign, Phase 1)
- **New shell:** left sidebar (brand, search, settings, theme on top; All Tools, Favorites, and per-category tool links below) replaces the header + category tabs. Any tool is now one click away from anywhere; the sidebar collapses to an icon rail under 900px and to a top bar with a tool strip under 640px.
- **Typography:** Sora (UI) and JetBrains Mono (code/data) bundled locally as variable fonts, replacing Nunito. The mono font is now actually shipped, so code looks the same on every OS. Base font size raised 13px to 14px.
- **Colors:** neutral zinc surfaces with the indigo accent kept; each tool category gets its own soft icon-tile color (home cards, list rows, sidebar, tool header).
- **Home:** view title + count header with a grid/list view toggle (persisted). Favorites no longer repeat inside All tools.
- **Tool header:** category icon tile, name, description, and a favorite star on every tool screen.
- **Theme:** Light / Dark / System modes in Settings (System follows the OS live); the header toggle still switches light/dark directly.
- **Search:** every tool now carries `keywords`; registry search and the Ctrl+K palette match name, description, category, and keywords (for example, "token" finds JWT Decoder).

### Fixed
- Version is single-sourced: the footer reads `chrome.runtime.getManifest().version` instead of a second hardcoded copy.
- Settings menu positioning is viewport-clamped and flips upward when needed (its anchor moved to the left sidebar).
- Docs updated to 16 tools (MODULES, QA: smoke tests added for Regex, Diff, Password, Lorem, HTTP, Cron; manifest permission check corrected to storage + system.display).

### Added
- MIT LICENSE and a .gitignore.


## [1.0.0] — 2026-10-02

### Added
- **16 tools:** JSON Formatter, JWT Decoder, Base64, URL Encoder/Decoder, UUID Generator, Timestamp Converter, Case Converter, Color Tools, Hash Generator, Text Utilities, Regex Tester, Diff Checker, Password Generator, Lorem Ipsum, HTTP Status Codes, Cron Parser
- Detached window mode (opens centered on the active screen)
- Light + dark theme, persisted
- Favorites and recently-used chips on home grid
- Command palette (Ctrl+K)
- Help overlay (?)
- Settings panel with save-inputs toggle and clear-data
- Custom confirm dialog and undo toasts
- Export / download output from every tool
- First-run welcome screen
- Local persistence for tool inputs (opt-in)
- Screen-wide eyedropper in Color Tools

### Security
- 100% client-side. No network. No analytics. No remote code.
- Permissions: `storage`, `system.display`
- CSP locked to `'self'`
- JWT / Hash / Password tools never persist their input

### Notes
- All tool CSS is scoped per-tool under `css/tools/`
- All tool JS is scoped per-tool under `js/tools/`
- Nunito font bundled locally (4 TTF files)