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
- [ ] All 31 tools readable in both themes
- [ ] Scrollbars are styled in both themes

## 3. Shell (sidebar)
- [ ] Sidebar head shows logo, title, settings, theme and collapse toggles; the search field sits in the top bar above the main area (never inside the sidebar)
- [ ] Sidebar lists All Tools, Favorites (when any), and every category group
- [ ] Clicking a category label filters the home grid; clicking a sidebar tool opens it directly
- [ ] Search filters tools in real time, including keyword matches (e.g. "token" finds JWT Decoder)
- [ ] Home head shows the view title + count and the grid/list toggle; the choice persists
- [ ] Favorites are not repeated in the All tools section
- [ ] Clicking a card/row opens the tool; its header shows icon, name, description, favorite star
- [ ] Sidebar collapses to an icon rail under 900px and to a top bar + tool strip under 640px
- [ ] With a tool open, typing in search shows results in a full width panel at the top of the main area (full tool names, no truncation) and the open tool stays on screen; Enter/click opens the pick, Esc closes the panel
- [ ] Sidebar head collapse toggle switches to the icon rail and back at full width; the state survives a reload; the top bar search stays visible and usable while collapsed
- [ ] Footer version matches manifest.json version (single source)

## 4. Each tool — smoke test

### JSON Formatter
- [ ] Valid JSON formats
- [ ] Invalid JSON shows line/column error
- [ ] Minify collapses
- [ ] Validate toasts correctly
- [ ] Copy works
- [ ] Ctrl+Enter triggers Format
- [ ] Sort keys orders keys at every depth
- [ ] Tree view opens; nodes collapse; Expand/Collapse all work
- [ ] To CSV / To YAML produce sane text; CSV to JSON round-trips with typed numbers
- [ ] Escape then Unescape returns the original text
- [ ] To XML nests objects and repeats array items as sibling tags
- [ ] XML to JSON: attributes land in "@attrs", repeated tags become arrays, numeric text becomes a number

### CSS Formatter & Minifier
- [ ] Format indents rules and nested @media blocks; indent select (2/4/tab) applies
- [ ] Minify strips comments and the trailing semicolon and shows the saved %; a /*! license comment survives
- [ ] A data URI background and a content string with braces survive both operations byte-identical

### User Agent Parser
- [ ] Own UA is prefilled and parsed on open
- [ ] Chrome/Windows, Safari/iPhone, Edge and Googlebot samples name the right browser, OS, device and client type
- [ ] A frozen Chrome version (.0.0.0) shows the reduced format note

### IP Subnet Calculator
- [ ] 192.168.1.10/24 gives network .0, broadcast .255 and 254 usable hosts
- [ ] Slider and select stay in sync; an invalid IP shows the error box
- [ ] /31 shows the RFC 3021 note and /32 the host route note

### CSS Gradient Generator
- [ ] Default output is background: linear-gradient(90deg, #2563eb 0%, #f59e0b 100%);
- [ ] Angle, type and stop edits update the preview and CSS together; presets and Random work

### Favicon Generator
- [ ] Six size cards render in text mode; changing the letter or colors redraws them
- [ ] Image mode draws the uploaded picture into every size
- [ ] favicon.ico downloads and opens as a valid icon with 16/32/48 entries

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
- [ ] Editing a param value, removing a row and adding a param all update the Rebuilt URL
- [ ] Malformed `%` shows error

### UUID Generator
- [ ] UUID list renders inside its panel; the foot count updates on Generate and Clear
- [ ] All generated UUIDs match v4 pattern
- [ ] Batch of 500 finishes without freeze
- [ ] Copy all produces newline-separated list
- [ ] Type picker: v7 sorts by time, ULID is 26 Crockford chars, Nano ID is 21 chars
- [ ] Parse panel names the type; a v7 / ULID shows its creation time; garbage shows invalid

### Timestamp Converter
- [ ] Sec and ms both convert correctly
- [ ] Auto-detect by digit count works
- [ ] Now button fills current time
- [ ] Date → Timestamp matches round trip
- [ ] "Show in" timezone adds a zone row with the correctly shifted time
- [ ] Clear in the Timestamp section clears its own field (no error)

### Case Converter
- [ ] All 9 variants update live
- [ ] `HTTPServer` splits to `http server`
- [ ] Unicode input (`Ärger`, `测试`) handled

### Color Tools
- [ ] Picker updates HEX/RGB/HSL live
- [ ] Typing hex/rgb/hsl updates preview
- [ ] Save swatch persists after popup close + reopen
- [ ] Right-click swatch removes it
- [ ] OKLCH row updates and copies
- [ ] Shades/tints swatches apply on click; black on white reads 21:1 with all badges Pass; Swap flips the pair

### Hash Generator
- [ ] `abc` SHA-256 = `ba7816bf...f20015ad`
- [ ] SHA-384 and SHA-512 also match known vectors
- [ ] Base64 format works
- [ ] Live hashing debounces smoothly
- [ ] `abc` MD5 = `900150983cd24fb0...`, SHA-1 = `a9993e36...`
- [ ] HMAC key changes the output and the meta line reads HMAC-<algo>
- [ ] File panel: dropping a file shows its hash for the chosen algorithm; switching algorithm re-hashes the same file

### Text Utilities
- [ ] Stats update live
- [ ] Each operation produces correct output
- [ ] "Use output as input" swaps and clears
- [ ] Word count matches for `hello world` (2) and `naïve café` (2)
- [ ] Slugify turns `Héllo Wörld!` into `hello-world`

### Regex Tester
- [ ] Pattern + sample text shows live matches with groups and positions
- [ ] Flags g/i/m/s/u/y toggle correctly
- [ ] Invalid pattern shows a friendly error, Load sample works
- [ ] A library chip loads its pattern and flags; email sample text matches
- [ ] Replace panel: `(\w+)@(\w+)` with `$2/$1` swaps the parts and the count updates

### Diff Checker
- [ ] Added/removed lines highlight on the correct sides
- [ ] Copy diff produces +/- prefixed output
- [ ] Oversized input shows the too-large message instead of freezing
- [ ] An edited line pair highlights only the changed words
- [ ] Ignore whitespace / Ignore case turn whitespace-only or case-only edits into "Identical"

### Password Generator
- [ ] Generated passwords use crypto randomness and match selected sets
- [ ] Ambiguous characters are excluded when the option is on
- [ ] Strength meter entropy changes with length and pool size
- [ ] Passphrase mode: chosen word count, separator honored, entropy scales with words
- [ ] PIN mode produces digits only, at the chosen length

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
- [ ] `30 */15 * * * *` parses as 6 fields; next runs land on second 30
- [ ] Builder: Weekly + Monday + 09:30 fills `30 9 * * 1`; Seconds field prefixes `0 `

## 4b. Uniform frame (Phase 2A)
- [ ] Input heads carry a Paste button on the text tools (JSON, Base64, URL, Hash, Text, Diff both sides, Regex test string, JWT, Cron, Case, Timestamp)
- [ ] Stats read "N chars · M lines" in JSON / Base64 / URL panel feet
- [ ] Wrap toggle on JSON, Base64, Lorem and Base64-file outputs switches horizontal scrolling on and off
- [ ] Invalid JSON frames the Input panel in red until fixed
- [ ] File drop zones highlight while dragging over them

### Number Base Converter
- [ ] 255 in decimal shows FF hex and grouped binary; FF from Hex shows 255
- [ ] A 30-digit decimal converts exactly (no floating point drift); an invalid digit for the base shows the digit help error

### chmod Calculator
- [ ] Default 755: symbolic reads rwxr-xr-x; unticking Group write updates octal, symbolic, command and meaning together
- [ ] Typing 600 in the octal field checks only the Owner read/write boxes; presets apply on click

### SQL Formatter
- [ ] The Sample formats to clause lines: SELECT / FROM / LEFT JOIN on one line / WHERE with indented AND / GROUP BY / ORDER BY / LIMIT
- [ ] A string containing the word 'from' is not split or recased; lower keyword mode works; Minify collapses to one line

### Markdown Preview
- [ ] Headings, bold, lists, a pipe table and a code fence render; a pasted <script> shows as text, never executes
- [ ] Copy HTML copies the generated markup; a javascript: link becomes href="#"

### QR Code Generator
- [ ] Typing a URL renders a code and the meta line (version, byte count); scanning it with a phone returns the exact text
- [ ] 107+ byte input shows the too-long message; SVG and PNG downloads open as valid images

### JWT Signer
- [ ] Default header/payload/secret reproduce the classic jwt.io token (signature `SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`)
- [ ] Switching algorithm updates the header alg; broken JSON frames the panel red

### AES Encrypt / Decrypt
- [ ] Encrypt then decrypt with the same password round-trips Unicode text; a wrong password fails cleanly with no output
- [ ] Two encryptions of the same text differ (random salt) yet both decrypt

### JSON to Types
- [ ] The Sample yields User/Address/Order in all three languages; `note` is optional everywhere (TS `?`, Go `omitempty`, Python `Optional = None`)

### Image Compressor
- [ ] A JPEG converts to WebP smaller at quality 82; scale 50% halves both dimensions; Download saves the shown result

### Meta Tag Generator
- [ ] Title counter turns red past 60 chars, description past 160; output escapes quotes; the preview card follows title, description and image

## 4c. Platform integrations (Phase 3, Chrome only)
- [ ] `npm install && npm test` smoke suite is green
- [ ] Settings shows "Open in Side Panel"; the app docks and every tool works at panel width
- [ ] Right-clicking the toolbar icon offers Open and Open in Side Panel
- [ ] Selecting text on a page, right-click, Developer Toolkit, Decode as JWT opens the tool with the text decoded
- [ ] Address bar: typing `dt json` and Enter opens the JSON tool
- [ ] Alt+Shift+D opens or focuses the app window

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
- [ ] `manifest.json` requests only `storage`, `system.display`, `contextMenus` and `sidePanel` (each justified in docs/STORE_LISTING.md)
- [ ] No user data written outside `chrome.storage.local`

## 8. Performance
- [ ] Popup opens in < 200ms
- [ ] 100KB JSON formats in < 500ms
- [ ] 500 UUIDs render in < 300ms
- [ ] No memory leak after toggling between tools 20 times