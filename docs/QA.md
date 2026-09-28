# QA Checklist

Run this before every release.

## 1. Load & boot
- [ ] Extension loads at `chrome://extensions` with no errors
- [ ] Popup opens at the correct size (400×600)
- [ ] No red errors in popup console at startup
- [ ] Toolbar icon is the generated logo (not the puzzle piece)

## 2. Theme
- [ ] Light theme renders correctly (default)
- [ ] Toggle flips to dark
- [ ] Reload popup → theme persists
- [ ] All 10 tools readable in both themes
- [ ] Scrollbars are styled in both themes

## 3. Shell
- [ ] Header shows logo, title, search, theme toggle
- [ ] Category tabs work: All, Color, Conversion, Data, Encoding, Generators, Security, Text
- [ ] Search filters cards in real time
- [ ] Clicking a card opens the tool with a back button
- [ ] Back button returns to the list
- [ ] Footer shows version + "All local"

## 4. Each tool — smoke test

### JSON Formatter
- [ ] Valid JSON formats
- [ ] Invalid JSON shows line/column error
- [ ] Minify collapses
- [ ] Validate toasts correctly
- [ ] Copy works
- [ ] Ctrl+Enter triggers Format

### JWT Decoder
- [ ] Sample loads and decodes
- [ ] Header/Payload/Signature sections render
- [ ] Expiry badge shows correct state
- [ ] Per-section copy works
- [ ] Invalid token shows a friendly error

### Base64
- [ ] UTF-8 encode/decode round-trips (`héllo 世界`)
- [ ] URL-safe mode strips padding and swaps `+/` for `-_`
- [ ] Invalid input shows error

### URL Encoder
- [ ] Component mode encodes `&=?/#`
- [ ] Full URL mode preserves URL structure
- [ ] Valid URL produces breakdown card
- [ ] Malformed `%` shows error

### UUID Generator
- [ ] All generated UUIDs match v4 pattern
- [ ] Batch of 500 finishes without freeze
- [ ] Copy all produces newline-separated list

### Timestamp Converter
- [ ] Sec and ms both convert correctly
- [ ] Auto-detect by digit count works
- [ ] Now button fills current time
- [ ] Date → Timestamp matches round trip

### Case Converter
- [ ] All 9 variants update live
- [ ] `HTTPServer` splits to `http server`
- [ ] Unicode input (`Ärger`, `测试`) handled

### Color Tools
- [ ] Picker updates HEX/RGB/HSL live
- [ ] Typing hex/rgb/hsl updates preview
- [ ] Save swatch persists after popup close + reopen
- [ ] Right-click swatch removes it

### Hash Generator
- [ ] `abc` SHA-256 = `ba7816bf...f20015ad`
- [ ] SHA-384 and SHA-512 also match known vectors
- [ ] Base64 format works
- [ ] Live hashing debounces smoothly

### Text Utilities
- [ ] Stats update live
- [ ] Each operation produces correct output
- [ ] "Use output as input" swaps and clears
- [ ] Word count matches for `hello world` (2) and `naïve café` (2)

## 5. Keyboard
- [ ] Tab order is logical in every tool
- [ ] Focus rings are visible
- [ ] Ctrl+Enter works where hinted
- [ ] Escape closes native color picker

## 6. Accessibility
- [ ] All icon-only buttons have `aria-label`
- [ ] Theme toggle announces state
- [ ] Tab list uses `role="tablist"` and `aria-selected`
- [ ] Colors meet contrast requirements in both themes

## 7. Security / privacy
- [ ] DevTools Network tab shows ZERO requests when using any tool
- [ ] No `eval`, no `new Function`, no remote scripts
- [ ] `manifest.json` still requests only `storage`
- [ ] No user data written outside `chrome.storage.local`

## 8. Performance
- [ ] Popup opens in < 200ms
- [ ] 100KB JSON formats in < 500ms
- [ ] 500 UUIDs render in < 300ms
- [ ] No memory leak after toggling between tools 20 times