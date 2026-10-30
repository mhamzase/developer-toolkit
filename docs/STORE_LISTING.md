# Chrome Web Store listing (v1.0.3)

Copy for the Developer Dashboard, ready to paste. Anything marked
[TODO] needs a human action (screenshots, dashboard answers).

## Basics

- **Name:** Developer Toolkit by Zase: JSON, JWT, Regex & More
- **Category:** Developer Tools
- **Language:** English

## Summary (132 characters max)

JSON formatter, JWT decoder & signer, regex tester, Base64, hashes, QR codes and more. Free, 100% offline, no tracking.

## Detailed description

Your browser is where you do your work, so the tools you use every day should live there too.

Inside Developer Toolkit you will find a JSON formatter and validator, a JWT decoder and signer, Base64 and URL encoders, a regex tester, hash, UUID and password generators, a QR code generator, a text diff checker, a cron builder, SQL, YAML and XML formatters, a JSONPath tester, Markdown tools, timestamp and color converters, an HTML entity converter and a slug generator, an image compressor, and quick references for the small things you should never have to Google. And that list is not final: the toolkit keeps growing, with new tools added regularly.

It is built to feel like a real app, not a cramped little popup. Open it in its own resizable window or dock it in Chrome's Side Panel. Choose a light, dark or system theme, pin the tools you use most as favorites, and reach anything instantly with search, a command palette, the keyboard, or a right click on selected text. Every tool is designed the same calm way, so once you know one, you know them all. It even opens where you left it, the way a tool you rely on should.

Most importantly, it respects your data. Every tool runs entirely in your browser: no accounts, no analytics, no network requests, nothing uploaded anywhere. Paste a token, a key or a private snippet, and it never leaves your machine.

Install it, pin it, and retire the dozen ad filled utility sites for good.

## Permission justifications (dashboard asks per permission)

- **storage:** Saves your preferences (theme, favorites), recent
  tools and per-tool inputs locally so the toolkit reopens the way
  you left it. Nothing is synced or sent anywhere.
- **system.display:** Used only to center the toolkit window on the
  monitor you are actively using when you open it.
- **contextMenus:** The contextMenus permission is used to add a right-click menu for the extension. It provides two things: a shortcut to open the Developer Toolkit window or Side Panel, and, when the user selects text on a page, an option to send that selected text directly into a relevant tool such as the JWT decoder, Base64 decoder, URL decoder, or hash generator. The menu is created entirely locally. The selected text is passed only to the extension's own pages on the user's device; it is never transmitted, stored on a server, or shared with any third party.
- **sidePanel:** The sidePanel permission is used to let the user open the Developer Toolkit docked in Chrome's Side Panel, as an alternative to the standalone popup window. This allows developers to keep a tool visible next to the page they are working on, for example while reading API documentation. The Side Panel displays the extension's own interface only. It does not read, capture, or interact with the content of any web page, and no data is transmitted anywhere. Use of the Side Panel is entirely optional and is only activated by the user.

## Privacy practices answers

- Single purpose: a collection of local developer utilities.
- Data collected: none. No user data is collected, stored remotely,
  sold or transferred. Certify all three data-use checkboxes.
- Remote code: none. All JavaScript ships inside the package.

## Graphics checklist

- [x] Store icon: `assets/icons/icon128.png` (128x128), new 3D style mark from `assets/icons/icon.svg`
- [x] Screenshots (1280x800, designed compositions rendered
  from the real app, kept in ~/workspace/store-screenshots/):
  1. 1-hero-home.png: home grid, light theme, gradient headline
  2. 2-json-formatter.png: formatted output plus tree view
  3. 3-qr-generator.png: QR generator with a code rendered
  4. 4-side-panel-jwt.png: Side Panel dock with a decoded JWT
  5. 5-cron-dark.png: dark theme, Cron meaning and fields
- [x] Small promo tile 440x280 and marquee 1400x560 (in
  ~/workspace/store-screenshots/: promo-small-440x280.png,
  promo-marquee-1400x560.png)

## Submission notes

- Version in `manifest.json` is the single source of truth and the
  in-app footer reads it from the manifest.
- Before zipping for upload, run `npm install && npm test` and make
  sure the smoke suite is green, then walk the manual checklist in
  `docs/QA.md`.
