# Chrome Web Store listing (v1.0.1)

Copy for the Developer Dashboard, ready to paste. Anything marked
[TODO] needs a human action (screenshots, dashboard answers).

## Basics

- **Name:** Developer Toolkit: JSON, JWT, Regex & More
- **Category:** Developer Tools
- **Language:** English

## Summary (132 characters max)

Free developer tools: JSON formatter, JWT decoder & signer, regex tester, Base64, hashes, QR generator. 26 tools, 100% offline, no tracking.

## Detailed description

Developer Toolkit is a free, all-in-one toolbox for developers: a
JSON formatter and validator, JWT decoder and signer, Base64 and
URL encoder, regex tester, hash generator, UUID generator,
password generator, QR code generator and 26 everyday utilities in
total, all in one fast extension that works 100% offline.

Stop pasting sensitive code, tokens and API keys into random
websites full of ads and trackers. Every tool in Developer Toolkit
runs entirely in your browser. No servers, no accounts, no
analytics, no network requests. Your data never leaves your
machine.

FORMAT, CONVERT AND VALIDATE
- JSON Formatter and Validator: format, minify and validate JSON,
  sort keys, explore a collapsible tree view, and convert JSON to
  CSV, YAML or XML (and back)
- JSON to Types: turn any JSON sample into TypeScript interfaces,
  Go structs or Python dataclasses
- SQL Formatter: clean, readable SQL with proper indentation
- Markdown Editor: write Markdown with a live preview and copy
  the HTML
- Number Base Converter: binary, octal, decimal, hexadecimal and
  every base up to 36, with exact BigInt precision

DECODE, ENCODE AND INSPECT
- JWT Decoder: decode JSON Web Tokens, inspect the header and
  claims, and see expiry at a glance
- JWT Signer: create and sign test tokens with HS256, HS384 or
  HS512
- Base64 Encoder and Decoder: for text, plus file to Base64
  conversion
- URL Encoder and Decoder: with a query string parameter editor
- Regex Tester: test regular expressions live, with a built-in
  pattern library and replace preview
- Diff Checker: compare text line by line with word level
  highlighting
- Cron Parser and Builder: plain English explanations, next run
  times and a point and click schedule builder

GENERATE IN ONE CLICK
- Password Generator: strong random passwords, memorable
  passphrases and PINs, with an honest strength estimate
- UUID and ID Generator: UUID v4 and v7, ULID and Nano ID, plus a
  parse and validate panel
- QR Code Generator: create QR codes and download them as PNG,
  generated entirely on your device
- Lorem Ipsum Generator: placeholder text by paragraph, sentence
  or word

SECURITY AND HASHING
- Hash Generator: MD5, SHA-1, SHA-256, SHA-384 and SHA-512, HMAC
  support, and file hashing
- AES Encryption: encrypt and decrypt text with AES-256-GCM and a
  password

REFERENCE AND EVERYDAY UTILITIES
- Color Converter: HEX, RGB, HSL and OKLCH, shades and tints, and
  a WCAG contrast checker for accessible color pairs
- Timestamp Converter: Unix epoch to human dates and back, across
  11 time zones
- Image Compressor: compress and resize PNG, JPEG and WebP images
  without uploading them anywhere
- Meta Tag Generator: SEO, Open Graph and Twitter card tags with
  live character counters and a social preview
- chmod Calculator: permissions by checkbox, octal or symbolic
  notation
- Case Converter and Text Tools: upper, lower, camelCase,
  snake_case, word and character counts, and a slug generator
- HTTP Status Codes: a fast, searchable reference

BUILT FOR YOUR WORKFLOW
- Open it in a resizable window or docked in Chrome's Side Panel
- Press Alt+Shift+D to launch it from anywhere, or type "dt" in
  the address bar and jump straight to a tool
- Right-click any selected text on a page and send it directly to
  the JWT, Base64, URL or Hash tool
- Command palette (Ctrl+K), full text search, favorites and recent
  tools keep your most used utilities one keystroke away
- Light, dark and system themes in a clean, responsive interface

PRIVATE BY DESIGN
Developer Toolkit collects nothing. There is no sign up, no
tracking and no remote code: every script ships inside the
extension package and runs locally. It is the safe place to paste
a JWT, decode a token or hash a file.

Whether you are a frontend or backend developer, a QA engineer, a
DevOps engineer or a student learning to code, Developer Toolkit
keeps the tools you reach for every day in one private, offline
home.

Install it, pin it, and make it yours.

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
