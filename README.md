# Developer Toolkit

A fast, privacy first collection of developer tools that runs entirely in your browser.

No backend. No tracking. No network calls. Nothing you type ever leaves your machine.

---

## Why this exists

Every developer has a dozen utility tabs open. JSON formatters that show ads. JWT decoders that log tokens. Base64 tools that ask you to "sign up for premium." It's exhausting and it's a privacy problem.

Developer Toolkit bundles the utilities developers actually reach for into one clean, fast, private package. Everything runs locally. Everything stays yours.

---

## Philosophy

Three rules shape every decision in this project:

1. **Local by default.** Every tool operates in the browser. No servers, no APIs, no telemetry. If a feature required sending your data somewhere, it wouldn't belong here.

2. **Zero friction.** No accounts, no onboarding, no paywalls. Open it, use it, close it.

3. **Built to last.** The collection grows over time. New tools, refinements, and quality of life improvements ship regularly, guided by real developer workflows.

---

## What's inside

A curated set of utilities covering the things developers reach for every day:

- Working with structured data
- Decoding, encoding, and converting values
- Generating secure identifiers and passwords
- Inspecting, comparing, and transforming text
- Testing patterns and expressions
- Converting timestamps and dates
- Exploring color
- Hashing and cryptography
- Quick lookups and references

If it's a small task you'd normally open a browser tab for, it probably already lives here, or it's on the way.

---

## Tech stack

Built with simplicity as a feature, not a compromise.

- **Manifest V3** for modern Chrome extension standards
- **HTML, CSS, and vanilla JavaScript** with no framework overhead
- **Chrome Storage API** for local preferences only
- **Web Crypto API** for cryptographic operations
- **Nunito** bundled locally for consistent typography
- **No build step** so the source you read is the source that runs

---

## Privacy

All processing happens locally in your browser. No data is sent anywhere, ever.

- No analytics
- No crash reporting
- No accounts
- No remote code
- No unnecessary permissions

The only permissions requested are the ones needed for functionality, and each one is documented in the source.

For tools where the input is genuinely sensitive, like JWT tokens, passwords, and raw hashes, nothing is persisted between sessions. Ever.

---

## Install from source

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked**.
5. Select the `developer-toolkit` folder.

The extension will appear in your toolbar. Click the icon to launch the app window.

---

## Project structure

The codebase is organized by concern so it's easy to navigate and extend:

- `popup/` contains the entry HTML, CSS, and bootstrap script.
- `css/` holds global styles split by purpose, plus a `tools/` folder where each tool gets its own stylesheet.
- `js/core/` manages app state, storage, theme, routing, and preferences.
- `js/ui/` renders the shell, navigation, grid, palette, and overlays.
- `js/utils/` collects pure helpers with no DOM or state dependencies.
- `js/tools/` contains each tool as a self contained module that registers itself on load.
- `docs/` documents the module map, tool interface contract, QA checklist, and changelog.

Adding a new tool means creating one file in `js/tools/`, one in `css/tools/`, and registering metadata. The shell picks it up automatically.

---

## Adding your own tool

Every tool follows the same contract. A minimal example:

```js
(function () {
  const DT = window.DT = window.DT || {};
  DT.tools = DT.tools || {};

  DT.tools.myTool = {
    id: 'myTool',
    name: 'My Tool',
    category: 'Utilities',
    icon: 'braces',
    description: 'Does something useful.',

    mount(container) {
      // Build your UI here. Never touch DOM outside this container.
    },

    unmount() {
      // Clean up listeners, timers, anything attached.
    }
  };
})();
```

Rules every tool follows:

- Never use `innerHTML` with user data. Use `textContent` or safe DOM APIs.
- Never call `eval` or `new Function`.
- Never make network requests.
- Always clean up in `unmount`.
- Always process locally.

See `docs/TOOL_INTERFACE.md` for the full contract.

---

## Contributing

Contributions are welcome. Here's how to help without stepping on toes:

1. Open an issue first to describe what you want to change or add. This avoids duplicate work.
2. Follow the existing tool contract and code style.
3. Test in both light and dark mode.
4. Verify no network requests are made. Open DevTools and check the Network tab.
5. Keep pull requests focused. One feature or fix per PR.

Bug reports with clear steps to reproduce are just as valuable as code contributions.

---

## Roadmap

The project grows in small, deliberate increments:

- More tools, added as real workflows demand them.
- Deeper features inside existing tools where they add real value.
- Additional themes and customization.
- Internationalization.
- Accessibility improvements.

Nothing on the roadmap compromises the privacy first philosophy. If a feature can't run entirely in the browser, it doesn't ship.

---

## License

MIT. Use it, fork it, learn from it, ship your own version.

If you build something interesting on top of this, I'd love to hear about it.

---

## Author

Built and maintained by **Hamza Shabbir**.

- GitHub: [@mhamzase](https://github.com/mhamzase)
- Issues and feature requests: [open an issue](https://github.com/mhamzase/developer-toolkit/issues)

---

## Support

If this toolkit saves you time, consider starring the repo. It helps others find it.

There's also a Donate link in the extension itself for anyone who wants to support ongoing development. Completely optional.

---

**Thanks for using Developer Toolkit. Keep your data yours.**
