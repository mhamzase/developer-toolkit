# Privacy Policy

Developer Toolkit does not collect, transmit, or share any user data.

## What we don't do

- No analytics
- No tracking
- No accounts
- No servers
- No network requests
- No remote code

## What stays on your device

The extension uses Chrome's local storage to save your preferences, such as your theme choice, pinned favorites, and recently used tools. This data never leaves your device. It is not accessible to the developer or any third party.

Some tools, such as JWT Decoder, Hash Generator, and Password Generator, do not persist their input at all. Any data you paste into those tools is discarded when you close the extension window.

## Permissions

The extension requests six permissions:

- **storage** — used only to save preferences locally.
- **system.display** — used only to open the extension window centered on your active screen.
- **contextMenus** — adds right-click entries: open the toolkit, open it in the Side Panel, send selected text to a tool, or transform and generate right on the page. The selected text is only used when you pick one of those entries and never leaves your device.
- **sidePanel** — lets the toolkit open docked in Chrome's Side Panel when you ask for it.
- **scripting** — used only at the moment you pick a right-click Transform or Generate entry, to run that one action in the page you clicked on. There is no persistent content script and nothing runs on pages you have not clicked in.
- **activeTab** — gives temporary access to just the tab you right-clicked, only while that action runs, so the selected text can be transformed and the result copied. No access to any other tab, and no access at any other time.

## Contact

For questions or issues, open an issue at https://github.com/mhamzase/developer-toolkit/issues

Last updated: 2026-10-31