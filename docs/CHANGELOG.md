# Changelog

All notable changes to Developer Toolkit.

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