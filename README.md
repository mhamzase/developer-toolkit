# Developer Toolkit – Chrome Extension

A fast, privacy-friendly collection of developer tools.
100% client-side. No backend. No tracking. No network calls.

## Tools
- JSON Formatter
- JWT Decoder
- Base64 Encode/Decode
- URL Encode/Decode
- UUID Generator
- Timestamp Converter
- Case Converter
- Color Tools
- Hash Generator (SHA-256/384/512)
- Text Utilities

## Tech
- Manifest V3
- HTML + CSS + Vanilla JavaScript
- Chrome Storage API
- Nunito font (bundled locally)

## Privacy
All processing happens locally in your browser.
No data is sent anywhere. Only `chrome.storage` permission is used.

## Load locally
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `developer-toolkit/` folder

## Docs
- `docs/MODULES.md` — module map
- `docs/TOOL_INTERFACE.md` — tool contract
- `docs/QA.md` — QA checklist
- `docs/CHANGELOG.md` — history

## License
MIT (or your preferred license)