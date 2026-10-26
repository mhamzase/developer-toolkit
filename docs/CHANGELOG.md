# Changelog

All notable changes to Developer Toolkit.

## [1.0.1] — 2026-10-26
Store-track versioning starts here: releases now count 1.0.1,
1.0.2, ... 1.0.9, then 1.1.0 (the earlier 1.x/2.0.0 numbers were
internal build milestones).

### Added (26 tools total)
- JWT Signer: create HS256/HS384/HS512 tokens locally for API
  testing, with base64url-secret support. The signing companion
  to the JWT Decoder.
- AES Encrypt / Decrypt: password-based AES-256-GCM with PBKDF2
  (210k rounds, per-message random salt), one Base64 string out.
- JSON to Types: TypeScript interfaces, Go structs or Python
  dataclasses from a JSON sample, with shape merging across
  array items and optional-field inference.
- Image Compressor: compress, resize and convert images
  (PNG/JPEG/WebP) on a local canvas, with before/after sizes.
- Meta Tag Generator: SEO, Open Graph and Twitter tags with
  live character counters (60 / 160) and a social preview card.

### Changed
- New app icon: a glossy indigo to violet tile with a lifted
  code mark and an amber slash. One master SVG
  (assets/icons/icon.svg) renders all four package sizes, and
  the in-app header logo picks it up automatically.

### Fixed
- Sidebar: clicking a tool no longer makes the navigation jump
  back to the top. Route changes now move only the highlight;
  the sidebar rebuilds solely when the favorites set changes,
  and even then it restores the scroll position.

## [2.0.0] — 2026-10-26
Phase 3: five new tools, platform integrations, store readiness.

### Added
- Number Base Converter: bases 2 to 36 with BigInt precision
  (no rounding on huge integers), grouped binary output, bit count.
- chmod Calculator: rwx checkbox grid with live octal, symbolic,
  command and per-group meaning, plus an octal field and presets.
- SQL Formatter: clause line breaks, AND/OR indentation, subquery
  indentation, keyword case control and minify. Strings and
  comments are preserved exactly.
- Markdown Preview: live preview for the everyday Markdown subset
  (headings, emphasis, code, links, lists, quotes, tables) with a
  Copy HTML action. Raw HTML in the source is always escaped.
- QR Code Generator: a from-scratch local encoder (byte mode, ECC
  level M, versions 1 to 6, up to 106 bytes) rendering SVG with
  SVG and PNG downloads. Its output was verified module-for-module
  against a reference implementation and decoded by OpenCV.
- JSON: To XML and XML to JSON join the Convert toolbar
  (attributes under "@attrs", text under "#text", repeated
  elements become arrays).
- Platform: Side Panel mode (Settings button and toolbar-icon
  right-click menu), selection context menus that send text to the
  JWT, Base64, URL or Hash tool prefilled, an omnibox keyword
  ("dt"), and an Alt+Shift+D command to open the app.
- Repo: `npm test` runs a jsdom smoke suite (tests/smoke.js);
  `docs/STORE_LISTING.md` holds the ready-to-paste store copy,
  permission justifications and the graphics checklist.

### Notes
- New permissions: contextMenus and sidePanel, both justified in
  the store listing doc. Still no network, no tracking.

## [1.3.0] — 2026-10-26
Phase 2B: upgrades inside the existing tools.

### Added
- Hash: MD5 (built-in implementation, Web Crypto has none) and
  SHA-1 join SHA-256/384/512, plus an optional HMAC key that turns
  any algorithm into HMAC for both text and files.
- JSON: Sort keys, a collapsible Tree view (expand/collapse all),
  To CSV, To YAML, CSV to JSON (with typed values), and string
  Escape / Unescape, all on a second Convert toolbar.
- UUID & ID Generator: UUID v7, ULID and Nano ID join v4 (type
  picker in the toolbar), plus a Parse / validate panel that names
  the type, checks validity and extracts creation time from v7
  and ULID values.
- Color: OKLCH value with copy, a Shades & tints panel (click a
  swatch to use and copy it) and a WCAG contrast checker with
  AA/AAA badges against any background, with a Swap button.
- Diff: word-level highlights inside edited line pairs, plus
  Ignore whitespace and Ignore case options that the unified
  copy/download output also respects.
- Cron: 6-field expressions with a leading seconds field, Quartz
  "?" support, and a Builder panel (frequency, time, weekday,
  date, optional seconds) that fills the expression in for you.
- Regex: a Common patterns library (email, URL, IPv4, dates, hex
  colors, UUID and more) and a Replace panel with $1 group
  references and a live replacement count.
- Password: Passphrase mode (269-word list, separator, capitalize,
  trailing number, honest entropy meter) and PIN mode join Random.
- Timestamp: a "Show in" timezone picker adds the converted time
  in any of 11 IANA zones to the result card.
- URL: query parameters in the breakdown are now editable. Change
  values, remove rows or add new params and copy the rebuilt URL.
- Text: Slugify operation.

### Fixed
- Timestamp: the Clear button in the Timestamp-to-date section
  referenced the other section's input and threw an error; it now
  clears its own field, with undo, like the rest of the app.

## [1.2.0] — 2026-10-24
Phase 2A: one uniform frame for every tool screen.

### Added
- Shared panel kit (`js/ui/panel.js`): standard panel heads, one stats
  format everywhere ("N chars · M lines"), Paste buttons in input
  heads, Wrap toggles on plain-text outputs, a Ctrl+Enter hint in
  panel feet, and a shared inline error box that frames its panel.
- Shared file component (`js/ui/filedrop.js`): click to browse or
  drag and drop, with size limits and a file meta line.
- Base64: "File to Base64" panel (any file up to 5 MB, optional
  Data URL prefix, copy / download / wrap).
- Hash: "File hash" panel (any file up to 50 MB, hashed with the
  selected algorithm and format).

### Changed
- Every tool now sits on the same panel frame: JSON (Clear moved into
  the Input head, error box replaces the ad-hoc slot), Base64, URL,
  Hash and Text (Paste in the Input head, shared stats), Diff (Paste
  on both sides, counts in the shared stats style), Regex, JWT and
  Cron (Paste + live stats), Case (Paste + stats), Timestamp (Paste
  on the Unix panel), Lorem (Wrap toggle), Password ("Copy all" moved
  into the Passwords panel head) and UUID (the list now lives in a
  real panel with Copy all / Download in its head and a count in its
  foot).

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