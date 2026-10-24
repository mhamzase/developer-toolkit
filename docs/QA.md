# QA Checklist

Run this before every release.

## 1. Load & boot
- [ ] Extension loads at `chrome://extensions` with no errors
- [ ] App window opens centered at 1000×720 on the active screen
- [ ] No red errors in popup console at startup
- [ ] Toolbar icon is the generated logo (not the puzzle piece)

## 2. Theme
- [ ] Light theme renders correctly
- [ ] Toggle flips to dark
- [ ] Settings → Theme offers Light / Dark / System; System follows the OS live
- [ ] Reload window → theme mode persists
- [ ] All 16 tools readable in both themes
- [ ] Scrollbars are styled in both themes

## 3. Shell (sidebar)
- [ ] Sidebar head shows logo, title, search, settings, theme toggle
- [ ] Sidebar lists All Tools, Favorites (when any), and every category group
- [ ] Clicking a category label filters the home grid; clicking a sidebar tool opens it directly
- [ ] Search filters tools in real time, including keyword matches (e.g. "token" finds JWT Decoder)
- [ ] Home head shows the view title + count and the grid/list toggle; the choice persists
- [ ] Favorites are not repeated in the All tools section
- [ ] Clicking a card/row opens the tool; its header shows icon, name, description, favorite star
- [ ] Sidebar collapses to an icon rail under 900px and to a top bar + tool strip under 640px
- [ ] Footer version matches manifest.json version (single source)

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
- [ ] File panel: dropping a small file fills the Base64 output; Data URL prefix toggles on and off
- [ ] Paste button in the Input head fills the input from the clipboard

### URL Encoder
- [ ] Component mode encodes `&=?/#`
- [ ] Full URL mode preserves URL structure
- [ ] Valid URL produces breakdown card
- [ ] Malformed `%` shows error

### UUID Generator
- [ ] UUID list renders inside its panel; the foot count updates on Generate and Clear
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
- [ ] File panel: dropping a file shows its hash for the chosen algorithm; switching algorithm re-hashes the same file

### Text Utilities
- [ ] Stats update live
- [ ] Each operation produces correct output
- [ ] "Use output as input" swaps and clears
- [ ] Word count matches for `hello world` (2) and `naïve café` (2)

### Regex Tester
- [ ] Pattern + sample text shows live matches with groups and positions
- [ ] Flags g/i/m/s/u/y toggle correctly
- [ ] Invalid pattern shows a friendly error, Load sample works

### Diff Checker
- [ ] Added/removed lines highlight on the correct sides
- [ ] Copy diff produces +/- prefixed output
- [ ] Oversized input shows the too-large message instead of freezing

### Password Generator
- [ ] Generated passwords use crypto randomness and match selected sets
- [ ] Ambiguous characters are excluded when the option is on
- [ ] Strength meter entropy changes with length and pool size

### Lorem Ipsum
- [ ] Paragraphs, sentences, and words modes generate the requested amount
- [ ] Custom word bank is honored
- [ ] Copy and download work

### HTTP Status Codes
- [ ] Search finds codes by number and by name
- [ ] Class filters (1xx to 5xx) work

### Cron Parser
- [ ] `*/5 * * * *` describes as every 5 minutes with correct next runs
- [ ] Aliases (@daily, @hourly) parse
- [ ] Invalid expressions show a clear field-level error

## 4b. Uniform frame (Phase 2A)
- [ ] Input heads carry a Paste button on the text tools (JSON, Base64, URL, Hash, Text, Diff both sides, Regex test string, JWT, Cron, Case, Timestamp)
- [ ] Stats read "N chars · M lines" in JSON / Base64 / URL panel feet
- [ ] Wrap toggle on JSON, Base64, Lorem and Base64-file outputs switches horizontal scrolling on and off
- [ ] Invalid JSON frames the Input panel in red until fixed
- [ ] File drop zones highlight while dragging over them

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
- [ ] `manifest.json` requests only `storage` and `system.display`
- [ ] No user data written outside `chrome.storage.local`

## 8. Performance
- [ ] Popup opens in < 200ms
- [ ] 100KB JSON formats in < 500ms
- [ ] 500 UUIDs render in < 300ms
- [ ] No memory leak after toggling between tools 20 times