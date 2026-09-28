# Changelog

All notable changes to Developer Toolkit.

## [1.0.0] — 2026-09-25

### Added
- Foundation: Manifest V3, popup shell, theme engine, storage, router
- Core tools (10):
  - JSON Formatter — format, minify, validate, line/col errors
  - JWT Decoder — header/payload/signature, expiry badge, local-only notice
  - Base64 — UTF-8 safe, URL-safe mode
  - URL Encoder/Decoder — component + full URL modes, URL breakdown
  - UUID Generator — crypto-based v4, batch up to 500
  - Timestamp Converter — sec/ms auto-detect, timezone-aware
  - Case Converter — 9 cases, Unicode word splitting
  - Color Tools — HEX/RGB/HSL, saved swatches (persisted)
  - Hash Generator — SHA-256/384/512 via Web Crypto
  - Text Utilities — counts, sort, dedupe, trim, line ops
- UI: header, search, category tabs, tool grid, tool view, footer
- Theme: light + dark, persisted
- Icons: 16/32/48/128 generated
- Docs: MODULES.md, TOOL_INTERFACE.md, QA.md

### Security
- 100% client-side. No network. No analytics. No remote code.
- Permissions: `storage` only.
- CSP locked to `'self'`.

### Notes
- All tools use safe DOM APIs. No `innerHTML` with user data. No `eval`.