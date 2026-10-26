# Chrome Web Store listing (v2.0.0)

Copy for the Developer Dashboard, ready to paste. Anything marked
[TODO] needs a human action (screenshots, dashboard answers).

## Basics

- **Name:** Developer Toolkit: JSON, JWT, Regex & More
- **Category:** Developer Tools
- **Language:** English

## Summary (132 characters max)

21 fast, private developer tools: JSON, JWT, regex, hashes, QR codes and more. Everything runs locally. No accounts, no tracking.

## Detailed description

Developer Toolkit puts the small tools you reach for every day into
one fast, private place, right inside Chrome.

FORMAT AND CONVERT
JSON formatter with sort keys, a collapsible tree view, and CSV,
YAML and XML conversion. SQL formatter. Markdown editor with live
preview and HTML export. Number base converter (binary, octal,
decimal, hex, base 36) with full BigInt precision.

DECODE AND INSPECT
JWT decoder with expiry state. Base64 and URL encoder/decoder with
file support. A regex tester with a pattern library and live
replace. A line and word level diff checker. A cron parser with a
plain-English description, next runs and a point-and-click builder.

GENERATE
Secure password generator (random, passphrase and PIN modes),
UUID v4 and v7, ULID and Nano ID with a parse and validate panel,
Lorem Ipsum, and a fully offline QR code generator.

REFERENCE AND UTILITIES
Color tools with HEX, RGB, HSL and OKLCH, shades and tints, and a
WCAG contrast checker. A chmod calculator (checkboxes, octal and
symbolic views). HTTP status code reference. Timestamp converter
with timezones.

WORK THE WAY YOU LIKE
Open it as a window, dock it in Chrome's Side Panel, jump in with
Alt+Shift+D, right-click selected text anywhere and send it
straight to the JWT, Base64, URL or Hash tool, or type "dt" in the
address bar and pick a tool. Light, dark and system themes, a
command palette (Ctrl+K), favorites and full-text tool search.

PRIVATE BY DESIGN
Every tool runs 100% locally in your browser. No analytics, no
accounts, no network calls, no data ever leaves your machine.

## Permission justifications (dashboard asks per permission)

- **storage:** Saves your preferences (theme, favorites), recent
  tools and per-tool inputs locally so the toolkit reopens the way
  you left it. Nothing is synced or sent anywhere.
- **system.display:** Used only to center the toolkit window on the
  monitor you are actively using when you open it.
- **contextMenus:** Adds the right-click menu: open the toolkit, or
  send selected text to the JWT, Base64, URL or Hash tool.
- **sidePanel:** Lets the toolkit open docked in Chrome's Side
  Panel, as an alternative to the popup window.

## Privacy practices answers

- Single purpose: a collection of local developer utilities.
- Data collected: none. No user data is collected, stored remotely,
  sold or transferred. Certify all three data-use checkboxes.
- Remote code: none. All JavaScript ships inside the package.

## Graphics checklist

- [x] Store icon: `assets/icons/icon128.png` (128x128)
- [TODO] Screenshots (1280x800 or 640x400), capture in this order:
  1. Home grid (light theme)
  2. JSON tool with the tree view open
  3. QR generator with a code rendered
  4. The app docked in the Side Panel next to a web page
  5. Dark theme, Cron builder
- [TODO, optional] Small promo tile 440x280 and marquee 1400x560.

## Submission notes

- Version in `manifest.json` is the single source of truth and the
  in-app footer reads it from the manifest.
- Before zipping for upload, run `npm install && npm test` and make
  sure the smoke suite is green, then walk the manual checklist in
  `docs/QA.md`.
