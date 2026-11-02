/**
 * File: site/build.mjs
 * Purpose: Static site generator for the Zase website.
 *
 * Reads the REAL tool registry by loading the extension's tool
 * files in a Node vm sandbox (the same trick tests/smoke.js uses
 * with jsdom, minus the DOM: tool files only self-register into
 * window.DT at load time), then renders:
 *   - dist/index.html            home: hero, search, grouped grid,
 *                                trust strip, features, extension
 *                                promo, FAQ, CTA band
 *   - dist/<slug>/index.html     one page per tool, each with a
 *                                per-tool SEO content block
 *   - dist/category/<slug>/      one landing page per category
 *   - dist/tools                 every tool with live search
 *   - dist/about, dist/contact, dist/privacy, dist/support,
 *                                dist/404.html
 *   - dist/sitemap.xml           every page (57 URLs)
 *   - dist/robots.txt            allow all + sitemap line
 * plus copies of the extension runtime files the site needs
 * (js, css, fonts, icons) and the site assets from site/src/
 * (styles, scripts, OG image, favicons, web manifest).
 *
 * SEO: every page carries a canonical URL, Open Graph and Twitter
 * meta, and JSON-LD structured data (Organization and WebSite on
 * the home page, FAQPage from the same FAQ data the page renders,
 * BreadcrumbList and WebApplication on tool pages, ItemList on
 * category pages).
 *
 * Zero dependencies: Node built-ins only.
 * Usage: node site/build.mjs
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(SITE_DIR, "..");
const SRC = path.join(SITE_DIR, "src");
const DIST = path.join(SITE_DIR, "dist");

const BASE_URL = "https://devtoolkit-zase.pages.dev";
const STORE_URL =
  "https://chromewebstore.google.com/detail/developer-toolkit-json-jw/fhjlhcecanniahjgnjffdhmfkfikkkdg";
const GITHUB_URL = "https://github.com/mhamzase/developer-toolkit";
const PATREON_URL = "https://www.patreon.com/zaseofficial";
/* Hamza's Binance USDT deposit address, Tron (TRC20). Public
 * by design: it is printed on the support page for donations. */
const USDT_ADDRESS = "TFyGZN6tQhxmFKosSU8o1aco1vv8UD2Zcz";
const OG_IMAGE = BASE_URL + "/og-image.png";

/**
 * SEO slug per tool id. Tools are known by their action names in
 * search ("json formatter", not "json"), so slugs carry the action.
 * A tool id missing here falls back to its id, with a warning.
 */
const SLUGS = {
  json: "json-formatter",
  base64: "base64-encoder-decoder",
  jwt: "jwt-decoder",
  jwtsign: "jwt-signer",
  regex: "regex-tester",
  timestamp: "timestamp-converter",
  uuid: "uuid-generator",
  password: "password-generator",
  hash: "hash-generator",
  qr: "qr-code-generator",
  cron: "cron-expression-generator",
  color: "color-converter",
  url: "url-encoder-decoder",
  diff: "text-diff-checker",
  sql: "sql-formatter",
  yaml: "yaml-formatter-converter",
  xml: "xml-formatter-validator",
  jsonpath: "jsonpath-tester",
  entities: "html-entity-encoder-decoder",
  slug: "slug-generator",
  css: "css-formatter-minifier",
  ua: "user-agent-parser",
  subnet: "ip-subnet-calculator",
  gradient: "css-gradient-generator",
  favicon: "favicon-generator",
  image: "image-compressor",
  metatags: "meta-tag-generator",
  jsontypes: "json-to-types-converter",
  aes: "aes-encryption",
  markdown: "markdown-editor",
  base: "base-converter",
  chmod: "chmod-calculator",
  case: "text-case-converter",
  text: "text-tools",
  lorem: "lorem-ipsum-generator",
  http: "http-status-codes",
};

/* Extension runtime files the website loads, in popup.html order.
 * Deliberately excluded: popup-shell-only core (theme, prefs,
 * router, app) and UI (header, nav, grid, toolview, palette,
 * confirm, help, welcome, settings, footer). The site provides its
 * own shell and mounts each page's single tool via web-boot.js. */
const RUNTIME_JS = [
  "js/utils/escape.js",
  "js/utils/debounce.js",
  "js/utils/clipboard.js",
  "js/utils/format.js",
  "js/utils/icons.js",
  "js/utils/persist.js",
  "js/utils/ico.js",
  "js/utils/download.js",
  "js/core/storage.js",
  "js/core/session.js",
  "js/core/registry.js",
  "js/ui/dom.js",
  "js/ui/panel.js",
  "js/ui/toast.js",
  "js/ui/dl-button.js",
  "js/ui/filedrop.js",
];
const RUNTIME_CSS = [
  "css/variables.css",
  "css/themes.css",
  "css/base.css",
  "css/components.css",
];

/* ---------------- small helpers ---------------- */

/** Escape text for an HTML element context. */
function esc(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escape text for a double-quoted attribute context. */
function escAttr(text) {
  return esc(text).replace(/"/g, "&quot;");
}

/** Replace {{TOKEN}} placeholders without regex $-pattern traps. */
function fill(template, map) {
  let out = template;
  for (const key of Object.keys(map)) {
    out = out.split("{{" + key + "}}").join(map[key]);
  }
  return out;
}

function readTemplate(name) {
  return fs.readFileSync(path.join(SRC, "templates", name), "utf8");
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyIntoDist(relPath) {
  copyFile(path.join(ROOT, relPath), path.join(DIST, relPath));
}

/** Category slug, same rule as js/core/registry.js. */
function categorySlug(category) {
  return String(category || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

/* ---------------- JSON-LD builders ---------------- */

/** Wrap a schema object in a script tag for the head template. */
function jsonLdTag(obj) {
  return (
    '    <script type="application/ld+json">\n' +
    JSON.stringify(obj, null, 2) +
    "\n    </script>\n"
  );
}

function breadcrumbLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/* ---------------- load the real tool registry ---------------- */

/**
 * Load the tool files in a vm sandbox and return their metadata.
 * The sandbox mirrors tests/smoke.js stubs: tool files only need
 * `window` (they self-register into window.DT) at load time. The
 * one trick: DT.ui.dom.svg is stubbed as the identity function, so
 * DT.utils.icons.get(name) returns the SVG markup string, which
 * lets the build inline real icons into the static HTML.
 */
function loadRegistry() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URL,
    TextEncoder,
    TextDecoder,
    Blob,
    Promise,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.DT = { ui: { dom: { svg: (s) => s } }, utils: {} };
  vm.createContext(sandbox);

  const load = (rel) => {
    const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
    vm.runInContext(code, sandbox, { filename: rel });
  };

  load("js/utils/icons.js");

  /* Tool files load in popup.html order so category order on the
   * home page matches the extension sidebar order. */
  const popupHtml = fs.readFileSync(path.join(ROOT, "popup/popup.html"), "utf8");
  const srcs = [...popupHtml.matchAll(/<script src="([^"]+)"><\/script>/g)].map(
    (m) => m[1]
  );
  for (const src of srcs) {
    if (!src.includes("js/tools/")) continue;
    load(path.relative(ROOT, path.join(ROOT, "popup", src)));
  }

  const tools = Object.values(sandbox.DT.tools || {}).filter(
    (t) => t && t.id && typeof t.mount === "function"
  );
  if (!tools.length) throw new Error("Registry load failed: no tools found.");

  const iconSvg = (name) => String(sandbox.DT.utils.icons.get(name) || "");
  return { tools, iconSvg };
}

/* ---------------- FAQ (visible section + FAQPage JSON-LD) ---------------- */

const FAQ = [
  {
    q: "Is Zase really free?",
    a: "Yes. Every tool on this website and in the Chrome extension is free, with no locked features, no trial period and no premium tier. There is nothing to unlock because there is nothing to pay for.",
  },
  {
    q: "Does my data leave my device?",
    a: "No. Every tool runs locally in your browser tab or in the extension on your device. Nothing you type, paste or generate is uploaded, logged or sent to a server, because there is no server involved in the work at all.",
  },
  {
    q: "Do I need an account?",
    a: "No. There are no accounts, no sign up forms and no sign in. Open a tool page and start working, or install the extension and it is ready immediately.",
  },
  {
    q: "What is the difference between the website and the extension?",
    a: "The tools themselves are the same. The website needs nothing installed and suits quick one-off jobs. The extension works fully offline, opens in a window or the side panel, and adds favorites, recents, a quick search and a right-click menu for selected text.",
  },
  {
    q: "Which browsers are supported?",
    a: "The website works in any modern browser, including Chrome, Edge, Firefox and Safari. The extension is built for Chrome and also works in Chromium based browsers such as Edge and Brave.",
  },
];

/* ---------------- Per-category landing intros ---------------- */

const CATEGORY_INTRO = {
  Data: "Data tools help you work with the formats developers touch every day: JSON, YAML, XML, SQL and CSS. Format and validate messy payloads, convert between formats, query documents and generate matching types, all locally in your browser, so real payloads from real systems never leave your machine.",
  Security: "Security tools for tokens, hashes and encrypted text. Decode and sign JWTs, generate MD5 and SHA hashes with HMAC, and encrypt text with AES-256-GCM. These are exactly the jobs you should never paste into a random server, so everything here runs on your device only.",
  Encoding: "Encoding tools convert text between the representations the web uses: Base64, URL percent encoding and HTML entities. Useful for debugging data URIs, query strings, headers and markup, with UTF-8 handled correctly throughout.",
  Generators: "Generators create the values your code and designs need: UUIDs, ULIDs and Nano IDs, strong passwords and passphrases, QR codes, and complete favicon sets. Values are created with the browser crypto APIs where randomness matters, and nothing is sent anywhere.",
  Conversion: "Conversion tools translate everyday values between units and formats: Unix timestamps to readable dates, text between letter cases, and images between PNG, JPEG and WebP with resizing and compression. Quick answers without a spreadsheet or a script.",
  Color: "Color tools for design and front end work: convert between HEX, RGB, HSL and OKLCH, check WCAG contrast ratios, generate tints and shades, and build CSS gradients visually, then copy the values straight into your stylesheet.",
  Text: "Text tools handle the small jobs that interrupt bigger work: counting words and characters, comparing two texts, cleaning up line lists, generating placeholder copy and meta tags, previewing Markdown and turning headings into clean URL slugs.",
  Regex: "The Regex category is home to the Regex Tester: build a pattern, watch matches highlight as you type, inspect capture groups and test replacements. It uses the JavaScript regex engine, so what you test is exactly what your code will do.",
  Reference: "Reference tools give you fast, searchable answers you would otherwise have to look up: every HTTP status code, cron expressions translated into plain words, Unix file permissions built visually, and IPv4 subnet maths worked out for you.",
};

/* ---------------- Per-tool SEO content ----------------
 * Keyed by tool id. intro: what the tool does and who it helps.
 * howTo: three short steps. points: three concrete notes.
 * Copy is written per tool from its real registry behaviour.
 * Keep it factual: no superlatives, no keyword stuffing. */

const CONTENT = {
  json: {
    intro: "The JSON Formatter takes raw or messy JSON and makes it readable: pretty print with clean indentation, validate and pinpoint syntax errors, minify, sort keys, explore a tree view, and convert to other formats such as CSV and YAML. It is the tool you open when an API response lands as one long line, or when a config file refuses to parse and the error message gives you nothing.",
    howTo: [
      "Paste your JSON into the input panel, or drop a .json file onto it.",
      "Choose Format to pretty print it, or use the tree view to explore nested objects and arrays.",
      "Copy the result, download it, or switch to Minify, Sort or a converter when you need a different shape.",
    ],
    points: [
      "Validation errors point at the problem instead of just failing, which speeds up debugging API payloads.",
      "Sorting keys makes two responses easy to compare in a diff, because the field order stops jumping around.",
      "Large payloads are safe to paste: the formatting happens in your tab, so private response data is never uploaded.",
    ],
  },
  jwt: {
    intro: "The JWT Decoder splits a JSON Web Token into its header and payload and shows the claims in a readable form, including the issued and expiry times. Reach for it when an API answers 401 and you need to see which user, scopes and expiry the token actually carries, instead of guessing.",
    howTo: [
      "Paste the full token into the input field.",
      "Read the decoded header and payload panels, with claims laid out one per line.",
      "Check the expiry and issued-at claims against your clock before you blame the server.",
    ],
    points: [
      "Decoding is not verifying: this tool shows what a token says, it cannot prove who signed it.",
      "Never paste production tokens into online decoders that send them to a server; here the token stays in your tab.",
      "Pairs well with the JWT Signer when you need to create a matching test token.",
    ],
  },
  jwtsign: {
    intro: "The JWT Signer creates signed JSON Web Tokens locally using HMAC algorithms HS256, HS384 and HS512. It is built for testing: spin up a token with the claims and secret your API expects, then use it against a local or staging environment without wiring up a script.",
    howTo: [
      "Edit the payload JSON with the claims you need, such as sub, name or your own fields.",
      "Enter the shared secret and pick HS256, HS384 or HS512.",
      "Copy the signed token and use it as a Bearer token in your API client.",
    ],
    points: [
      "Signing happens with the Web Crypto API in your browser, so secrets never leave the device.",
      "Use throwaway secrets for tests; a token signed here is a real token and should be treated like one.",
      "The classic jwt.io style example token can be reproduced exactly, which is handy for verifying other tools.",
    ],
  },
  aes: {
    intro: "AES Encrypt / Decrypt protects a piece of text with a password, using AES-256-GCM with a PBKDF2 key derivation of 210000 iterations. Use it to share a note, a key or a credential through an untrusted channel: the ciphertext is safe to send, and only the password can open it.",
    howTo: [
      "Type or paste the text you want to protect, and set a strong password.",
      "Click Encrypt and copy the resulting ciphertext block.",
      "To open it later, paste the ciphertext, enter the same password, and click Decrypt.",
    ],
    points: [
      "AES-GCM is authenticated encryption: a wrong password or a changed byte fails cleanly instead of returning garbage.",
      "The password is never stored or transmitted; lose it and the text cannot be recovered.",
      "Each encryption uses a fresh random salt and IV, so encrypting the same text twice gives different output.",
    ],
  },
  hash: {
    intro: "The Hash Generator computes MD5, SHA-1, SHA-256, SHA-384 and SHA-512 digests for text and files, plus HMAC when you supply a key. It is the quick way to verify a download checksum, fingerprint a file before sharing it, or check what a value looks like after hashing.",
    howTo: [
      "Type or paste text, or drop a file onto the panel.",
      "Read the digests for every algorithm at once and copy the one you need.",
      "For HMAC, enter a key first, then the message.",
    ],
    points: [
      "File hashing reads the file in your browser; the file itself is never uploaded.",
      "MD5 and SHA-1 are fine for checksums and fingerprints, but not for passwords or signatures.",
      "Comparing a computed SHA-256 with the one a vendor publishes is the standard way to verify a download.",
    ],
  },
  base64: {
    intro: "Base64 encodes and decodes Base64 in both directions, with correct UTF-8 handling so accented characters, emoji and other non-ASCII text survive the round trip. Useful for data URIs, basic auth headers, email content and the encoded strings that turn up inside JSON and tokens.",
    howTo: [
      "Paste text to encode it, or paste Base64 to decode it back.",
      "Watch the result update, then copy it with one click.",
      "Switch direction any time; the tool keeps track of which side you edited.",
    ],
    points: [
      "Many quick decoders mangle UTF-8 text; this one decodes bytes as UTF-8, so café comes back as café.",
      "Base64 is an encoding, not encryption: anyone can decode it, so never treat it as protection.",
      "A JWT is three Base64url segments joined by dots; decode the middle one here to peek at a payload.",
    ],
  },
  url: {
    intro: "The URL Encoder encodes and decodes percent-encoded URLs and components, and breaks a URL down into editable parts: protocol, host, path and individual query parameters. It earns its keep when a redirect URI fails to match, or when a query string arrives double-encoded.",
    howTo: [
      "Paste a URL or a piece of text to encode or decode it.",
      "Use the breakdown to inspect and edit single query parameters.",
      "Copy the rebuilt URL or the encoded component when it looks right.",
    ],
    points: [
      "Encode a full URL and encode a single component are different jobs; the tool keeps them separate.",
      "Double encoding (%2520 instead of %20) is a common cause of broken links and failed OAuth redirects.",
      "Editing parameters in the breakdown is safer than hand-editing a long query string.",
    ],
  },
  entities: {
    intro: "The HTML Entity Encoder and Decoder converts text to and from HTML entities in named, decimal and hex forms, plus a decode mode for reading entity-heavy markup. Use it when text must survive inside HTML or XML, or when a page shows &amp;amp; instead of the character you wrote.",
    howTo: [
      "Paste the text you want to convert.",
      "Pick a mode: named entities, decimal, hex, or decode to turn entities back into characters.",
      "Copy the converted text straight into your markup or document.",
    ],
    points: [
      "Encoding the five core characters (&, <, >, quotes) is what stops text from breaking a page layout.",
      "Unknown entity names are left untouched instead of being silently dropped.",
      "Decimal and hex modes cover characters that have no named entity.",
    ],
  },
  uuid: {
    intro: "The UUID and ID Generator creates batches of UUID v4, time-ordered UUID v7, ULID and Nano ID values, and validates and parses IDs you paste in. Handy for seeding databases, naming test fixtures, or checking whether an identifier from a log line is even well formed.",
    howTo: [
      "Pick the ID type and how many you need.",
      "Generate the batch and copy it as a list.",
      "Or paste an existing ID to validate its format and see its parts.",
    ],
    points: [
      "UUID v7 and ULID sort by creation time, which keeps database indexes and log files in a sensible order.",
      "Random values come from the browser crypto APIs, not from Math.random.",
      "Bulk generation saves the copy, change settings, copy again loop when seeding test data.",
    ],
  },
  password: {
    intro: "The Password Generator creates strong crypto-random passwords, memorable passphrases and PINs, with control over length and character sets. It is for the moments a service demands a new password and the worst option is reusing an old one with a number changed.",
    howTo: [
      "Choose password, passphrase or PIN mode.",
      "Set the length and character options to match the site rules.",
      "Generate, copy, and store the result in your password manager.",
    ],
    points: [
      "Randomness comes from the Web Crypto API on your device; nothing is generated or stored on a server.",
      "A four or five word passphrase is usually stronger and far easier to type than a short complex password.",
      "Generated values are never saved by the tool: copy what you need before closing the tab.",
    ],
  },
  qr: {
    intro: "The QR Code Generator turns text or a link into a QR code you can download as an image. Print it on a poster, drop it into a slide, or stick it on packaging: anyone with a phone camera lands on your URL. It works fully offline, like everything else here.",
    howTo: [
      "Type or paste the link or text to encode.",
      "Check the live preview; longer text makes a denser code.",
      "Download the PNG and use it wherever you need it.",
    ],
    points: [
      "Shorter links scan more reliably, especially in print; shorten the URL before generating when you can.",
      "Leave a quiet margin around the code when you place it in a design, or scanners may struggle.",
      "Test the printed code with your own phone before a big print run.",
    ],
  },
  favicon: {
    intro: "The Favicon Generator builds a complete favicon set from one image or a piece of text: the PNG sizes browsers and phones expect, plus a packed favicon.ico. Upload a logo once and download everything a site needs instead of resizing by hand in an image editor.",
    howTo: [
      "Drop in an image, or type a letter or emoji and pick colors.",
      "Preview the generated sizes to check the small ones stay readable.",
      "Download the set and link the files from your page head.",
    ],
    points: [
      "The 16 pixel size is the real test: simple shapes and strong contrast survive, detail does not.",
      "The pack includes the apple touch size, so home screen bookmarks look right on phones.",
      "Generating from text is a fast way to ship a clean placeholder icon for a new project.",
    ],
  },
  timestamp: {
    intro: "The Timestamp Converter translates Unix epoch timestamps into human readable dates and back, handling both seconds and milliseconds. It is the tool for log files, JWT claims and database rows full of numbers like 1761984000 that mean nothing until you convert them.",
    howTo: [
      "Paste a timestamp and read the date in UTC and your local time, plus a relative form.",
      "Or pick a date and time to get the epoch value for it.",
      "Copy the format you need: ISO, relative, seconds or milliseconds.",
    ],
    points: [
      "A ten digit value is seconds, thirteen digits is milliseconds; mixing them up is the classic timestamp bug.",
      "JWT exp and iat claims are in seconds, so this pairs naturally with the JWT Decoder.",
      "Relative output (in 3 days, 2 hours ago) is the fastest sanity check on a log line.",
    ],
  },
  case: {
    intro: "The Case Converter rewrites text in UPPERCASE, lowercase, Title Case, camelCase, PascalCase, snake_case, kebab-case and more, all at once. Writers use it for headings; developers use it to turn a label from a design file into the constant, variable or CSS class name the code needs.",
    howTo: [
      "Type or paste the text once.",
      "Read every case variant in its own row.",
      "Copy the variant you need with one click.",
    ],
    points: [
      "Converting a whole list of labels in one paste beats renaming things one by one in an editor.",
      "kebab-case for URLs and CSS, snake_case for Python and databases, camelCase for JavaScript: one input covers all three.",
      "Title Case here capitalizes each word, which suits headings but not sentences.",
    ],
  },
  color: {
    intro: "Color Tools convert colors between HEX, RGB, HSL and OKLCH, build tints and shades, and check WCAG contrast ratios with AA and AAA pass badges. It answers the everyday design questions: what is this brand color in HSL, and can anyone actually read this text on that background.",
    howTo: [
      "Paste a color in any format, or pick one with the color input.",
      "Read and copy the converted values in every format.",
      "Set a background color in the contrast panel and check the AA and AAA results.",
    ],
    points: [
      "Body text needs a contrast ratio of at least 4.5 to 1 for WCAG AA; large headings need 3 to 1.",
      "The swap button in the contrast panel checks your pair in both directions, which matters for hover states.",
      "OKLCH shades stay perceptually even, so generated tints look balanced instead of muddy.",
    ],
  },
  gradient: {
    intro: "The CSS Gradient Generator lets you design linear and radial gradients visually: add color stops, drag them into place, rotate the angle, then copy production-ready CSS. It replaces the guess, paste, refresh loop with a live preview of the exact background your stylesheet will get.",
    howTo: [
      "Pick linear or radial and set the direction or shape.",
      "Add and adjust color stops until the preview matches your design.",
      "Copy the generated background CSS into your stylesheet.",
    ],
    points: [
      "The hero and buttons on this very site use the same indigo to violet gradient family.",
      "Two stops are enough for most interfaces; extra stops are for deliberate color journeys, not decoration.",
      "Copy the fallback background color too, for the rare client that cannot paint gradients.",
    ],
  },
  image: {
    intro: "The Image Compressor shrinks, resizes and converts images between PNG, JPEG and WebP entirely in your browser. Drop in a heavy screenshot or photo, pick a quality, and download a web-ready file: the image is processed on your device and never uploaded to a server.",
    howTo: [
      "Drop an image onto the panel or pick one from your files.",
      "Set the target format, quality and optional max size.",
      "Compare the before and after sizes, then download the result.",
    ],
    points: [
      "WebP usually beats JPEG at the same visual quality, and every modern browser displays it.",
      "Screenshots with text stay sharper as PNG; photos compress far better as JPEG or WebP.",
      "Because nothing is uploaded, private screenshots and unreleased product images are safe to compress here.",
    ],
  },
  base: {
    intro: "The Number Base Converter converts integers between binary, octal, decimal, hexadecimal and other bases, with BigInt support for values too large for normal number types. It is the quick check for permission bits, color channels, memory addresses and bitwise homework.",
    howTo: [
      "Type a value and set the base it is written in.",
      "Read the converted value in every common base at once.",
      "Copy the base you need for your code or notes.",
    ],
    points: [
      "Hex and binary views side by side make bitmask and flag work much easier to follow.",
      "Values beyond the safe integer range stay exact, because the maths uses BigInt.",
      "A file permission like 755 is octal; this tool and the chmod Calculator cover the same ground from two sides.",
    ],
  },
  sql: {
    intro: "The SQL Formatter lays out SQL queries with clause breaks and consistent keyword casing, turning a one-line SELECT into something you can actually read and review. Paste a query from an ORM log, format it, and the joins, filters and grouping finally line up.",
    howTo: [
      "Paste your SQL into the input panel.",
      "Format it and pick the keyword casing you prefer.",
      "Copy the formatted query back into your code or ticket.",
    ],
    points: [
      "Formatting a logged query is often the fastest way to spot the missing join condition.",
      "Strings and comments are preserved exactly; only the layout and keyword case change.",
      "Consistent casing in a team codebase makes diffs quieter and reviews faster.",
    ],
  },
  css: {
    intro: "The CSS Formatter and Minifier does both ends of stylesheet work: it beautifies compressed or messy CSS with clean indentation for reading and editing, and minifies CSS for production when every kilobyte of the page weight matters.",
    howTo: [
      "Paste your CSS into the input panel.",
      "Choose Format to beautify it, or Minify to compress it.",
      "Copy the output into your stylesheet or build.",
    ],
    points: [
      "Minifying a copied third-party snippet before reading it is backwards: format first, read, then minify for shipping.",
      "Vendor CSS pasted from a browser inspector becomes far easier to adapt once it is indented properly.",
      "Comments are kept while formatting and dropped when minifying, as you would expect.",
    ],
  },
  yaml: {
    intro: "The YAML Formatter and Converter formats and validates YAML with line-numbered errors, and converts between YAML and JSON in both directions. It is aimed at the config files that run modern projects: CI pipelines, Docker Compose, Kubernetes and application settings.",
    howTo: [
      "Paste YAML (or JSON, which is detected automatically) into the input.",
      "Format it to fix the layout and surface any indentation errors with their line numbers.",
      "Convert to JSON when a tool needs JSON, then copy or download the result.",
    ],
    points: [
      "YAML errors name the line, which matters because a single wrong indent can change what a config means.",
      "Block scalars for long strings and scripts survive formatting, including their chomping markers.",
      "Anchors and custom tags are reported as errors rather than silently misread.",
    ],
  },
  xml: {
    intro: "The XML Formatter and Validator pretty prints XML with attribute order preserved, validates it with clear errors, and minifies it back to one line for production. It handles the real-world mix: comments, CDATA sections, processing instructions and DOCTYPE declarations.",
    howTo: [
      "Paste your XML into the input panel.",
      "Format it to read the structure, and check the element count and depth stats.",
      "Minify it when you need the compact form, then copy or download.",
    ],
    points: [
      "Invalid XML is reported by the parser instead of being guessed at, so broken feeds surface quickly.",
      "Mixed content, where text and elements share a parent, is kept inline so documents are not mangled.",
      "Common jobs: RSS and sitemap files, SVG cleanup, and SOAP payloads from legacy services.",
    ],
  },
  jsonpath: {
    intro: "The JSONPath Tester runs JSONPath expressions against a JSON document and lists every match with its concrete path. Test a query here before you hard-code it into an API client, a test assertion or a data pipeline, and see exactly which values it pulls out.",
    howTo: [
      "Paste the JSON document into the input panel.",
      "Write a JSONPath expression: child keys, indexes, wildcards, filters and recursive descent are supported.",
      "Read the matched values with their full paths, then copy values or paths.",
    ],
    points: [
      "Filters such as [?(@.price > 10)] let you select array items by field value, not just position.",
      "Recursive descent (..) finds a key at any depth, which suits payloads whose shape varies.",
      "Seeing the concrete path of each match is the fastest way to debug a query that returns too much or nothing.",
    ],
  },
  jsontypes: {
    intro: "JSON to Types reads a sample JSON document and generates matching type definitions: TypeScript interfaces, Go structs or Python dataclasses. Paste a real API response and skip the tedious part of typing out every field by hand.",
    howTo: [
      "Paste a representative JSON sample.",
      "Pick the target language: TypeScript, Go or Python.",
      "Copy the generated types and rename the root type to fit your project.",
    ],
    points: [
      "Nested objects become their own named types, and arrays take the shape of their items.",
      "Optional looking fields and mixed arrays are worth a review pass before you commit the types.",
      "Works best with a complete sample: the types can only describe what the JSON shows.",
    ],
  },
  ua: {
    intro: "The User Agent Parser breaks a user agent string into its browser, operating system and device parts. Paste the string from your server logs or analytics and find out what actually visited, including whether it looks like a bot or crawler.",
    howTo: [
      "Paste the full user agent string into the input.",
      "Read the parsed browser, version, OS and device details.",
      "Use the result to reproduce the visitor environment or filter your logs.",
    ],
    points: [
      "Most strings claim to be Mozilla and several browsers at once; the parser reports the engine that matters.",
      "Handy when a bug report says only: it broke on my phone.",
      "Bot and crawler detection helps explain strange traffic in server logs.",
    ],
  },
  markdown: {
    intro: "The Markdown Preview renders Markdown as HTML while you write, with a copyable HTML output. Draft README files, release notes and documentation here, check headings, tables and code blocks render the way you expect, then paste the result where it needs to go.",
    howTo: [
      "Write or paste Markdown into the editor panel.",
      "Watch the preview update as you type.",
      "Copy the rendered HTML if your target is a web page or an email template.",
    ],
    points: [
      "A live preview catches the broken table or unclosed code fence before your readers do.",
      "Raw HTML in the preview is rendered by your browser only; nothing is sent to a rendering service.",
      "The same Markdown powers most README files, so this doubles as a README checker.",
    ],
  },
  metatags: {
    intro: "The Meta Tag Generator builds the title, description, Open Graph and Twitter card tags a page needs to look right in search results and shared links, generated live as you fill in the fields. Fill it in once and paste the whole block into your page head.",
    howTo: [
      "Enter the page title, description, URL and image.",
      "Check the generated tags and the social preview values.",
      "Copy the full block into the head of your page.",
    ],
    points: [
      "Pages without Open Graph tags get random images and clipped text when shared; these tags fix that.",
      "Keep descriptions near 150 characters so they survive search result snippets.",
      "The tags on this page were checked with the same rules this generator follows.",
    ],
  },
  slug: {
    intro: "The Slug Generator turns titles and headings into clean, URL friendly slugs: lowercase, accents folded to plain letters, punctuation removed and words joined by your separator. It converts line by line, so a list of article titles becomes a list of permalinks in one paste.",
    howTo: [
      "Paste one or more titles, one per line.",
      "Choose the separator and length options you need.",
      "Copy the slugs for your routes, file names or CMS.",
    ],
    points: [
      "Accented letters are transliterated (é becomes e) instead of being deleted, so words stay readable.",
      "The ampersand becomes the word and, which keeps slugs natural: fish-and-chips, not fish-chips.",
      "A max length option trims at a word boundary, so slugs never end mid-word.",
    ],
  },
  text: {
    intro: "Text Utilities is the odds and ends drawer for text: word and character counts, sorting lines, removing duplicates and trimming stray whitespace. It is the fastest way to clean a list copied out of a spreadsheet, a log or an email before it goes somewhere else.",
    howTo: [
      "Paste the text you want to work on.",
      "Pick the operation: count, sort, dedupe or trim.",
      "Copy the cleaned result.",
    ],
    points: [
      "Dedupe keeps first occurrences in order, which is what you want for hand-built lists.",
      "Counts update live, which helps when a field has a strict character limit.",
      "Sorting lines alphabetically is a quiet superpower for tidying imports, tags and name lists.",
    ],
  },
  diff: {
    intro: "The Diff Checker compares two texts side by side, line by line, with word-level highlighting inside the lines that changed. Paste the before and after of a config, a contract clause or a block of code and see exactly what moved.",
    howTo: [
      "Paste the original text on the left and the new text on the right.",
      "Read the highlighted changes; changed words are marked inside changed lines.",
      "Use the options to ignore whitespace or case when those differences do not matter.",
    ],
    points: [
      "Word-level highlights stop you re-reading two long paragraphs to find one changed number.",
      "Ignoring whitespace is the right call when one side was reformatted and the other was not.",
      "Config and environment files are the classic use: one changed line in two hundred is easy to miss by eye.",
    ],
  },
  lorem: {
    intro: "The Lorem Ipsum Generator creates placeholder text in classic Latin or from your own custom word list, by paragraph, sentence or word count. Use it to fill a layout before the real copy exists, so design decisions happen with realistic text volume.",
    howTo: [
      "Pick paragraphs, sentences or words and set the amount.",
      "Optionally supply your own words for a themed filler.",
      "Copy the generated text into your mockup or template.",
    ],
    points: [
      "Placeholder text reveals layout problems early: overflow, orphan headings and cramped cards.",
      "Custom word lists make wireframes feel closer to the real product for client reviews.",
      "Generate a little more than you need; real copy is rarely shorter than the placeholder.",
    ],
  },
  regex: {
    intro: "The Regex Tester lets you build a regular expression and watch it work: matches highlight in your test text as you type, capture groups are listed, flags can be toggled, and replacements can be previewed. It runs the JavaScript regex engine, so what you test is what your code runs.",
    howTo: [
      "Write your pattern and set the flags you need.",
      "Paste test text and inspect the highlighted matches and groups.",
      "Add a replacement string to preview substitutions before you ship them.",
    ],
    points: [
      "A small built-in example library covers common jobs like emails, URLs and dates.",
      "Test the awkward cases on purpose: empty strings, unicode and text that should NOT match.",
      "Greedy versus lazy quantifiers explain most regex surprises; the group view makes them visible.",
    ],
  },
  http: {
    intro: "HTTP Status Codes is a searchable reference for the full set of HTTP response status codes, from 100 Continue to 511. Look up what a code actually means the next time an API answers with something you have never seen, or when 404 versus 410 matters.",
    howTo: [
      "Search by code number or by keyword, such as redirect or timeout.",
      "Read the meaning and the typical cause for each match.",
      "Jump back to your client or server code with the answer.",
    ],
    points: [
      "The 4xx family is the client sending something wrong; 5xx is the server failing to handle a valid request.",
      "301 and 302 are not interchangeable for SEO: permanent versus temporary redirects behave differently.",
      "418 is real, and yes, it is the teapot.",
    ],
  },
  cron: {
    intro: "The Cron Parser translates a cron expression into a plain sentence and shows the next run times, with a builder for putting expressions together field by field. No more counting asterisks to work out whether a job runs every five minutes or at five in the morning.",
    howTo: [
      "Paste a cron expression to read it in plain words.",
      "Check the upcoming run times against what you expect.",
      "Or use the builder to compose a new schedule and copy the expression.",
    ],
    points: [
      "The classic mistake is field order: minute, hour, day of month, month, day of week.",
      "Next run times catch timezone surprises before production does.",
      "Quartz style expressions with a seconds field are supported too.",
    ],
  },
  chmod: {
    intro: "The chmod Calculator builds Unix file permissions visually: tick the read, write and execute boxes for owner, group and others, and read the octal (755, 644) and symbolic (rwxr-xr-x) forms side by side. It also works in reverse when a tutorial just says chmod 750.",
    howTo: [
      "Tick the permission boxes for owner, group and others.",
      "Read the octal and symbolic values and the ready-made chmod command.",
      "Or type an octal value to see which boxes it represents.",
    ],
    points: [
      "644 for files and 755 for directories is the standard web server pairing.",
      "777 is almost never the fix; it is usually a path or ownership problem instead.",
      "The execute bit on a directory means enter and list it, which is different from files.",
    ],
  },
  subnet: {
    intro: "The IP Subnet Calculator works out an IPv4 subnet from an address and CIDR prefix: network and broadcast addresses, the wildcard and subnet masks, and the first, last and total usable host range. The maths you need when planning networks, firewall rules or cloud VPC ranges.",
    howTo: [
      "Enter an IPv4 address and a CIDR prefix, such as 192.168.1.0 and 24.",
      "Read the network, broadcast, mask and host range results.",
      "Adjust the prefix to see how the range grows or shrinks.",
    ],
    points: [
      "Each step down in prefix size doubles the address count; each step up halves it.",
      "A /32 is a single host, which is why firewall rules use it for one machine.",
      "Cloud VPC ranges cannot overlap; working the ranges out here first prevents painful rebuilds.",
    ],
  },
};

/* ---------------- Deep content (Step 4 SEO) ----------------
 * Extra page depth for the five most searched tools: a guide of
 * short subsections, a worked example, and a per-tool FAQ that
 * also feeds FAQPage structured data. Tools without an entry
 * here render exactly as before. Copy rule (Hamza): no tool
 * counts anywhere, ever. */

const DEEP_CONTENT = {
  json: {
    guide: [
      {
        h: "What formatting actually fixes",
        p: "Most JSON problems are reading problems. An API returns one long line, a config file mixes tabs and spaces, or a payload copied from a log has line breaks in the middle of strings. Formatting gives the data a stable shape: one key per line, consistent indentation, arrays you can scan. Once the shape is stable, the real problems stand out: a missing bracket, a number stored as a string, a field that appears twice. The validator here points at the exact spot instead of just saying invalid, so you fix the cause instead of guessing.",
      },
      {
        h: "Comparing two responses",
        p: "Developers often need to know what changed between two API responses: yesterday's payload and today's. Raw, they are impossible to compare because key order jumps around between calls. Sort the keys in both, format both the same way, and a plain text diff suddenly shows only the real differences. The tree view helps the other way: when a response is deeply nested, expanding one branch at a time is faster than scrolling a wall of text, and the element counts tell you the shape of the data before you read it.",
      },
      {
        h: "Formatting JSON without leaking it",
        p: "Production payloads contain names, emails, order details and sometimes tokens. Pasting them into a random online formatter means sending that data to a stranger's server, where it can be logged. This formatter runs entirely in your browser tab: the JSON never leaves your device, nothing is uploaded, and closing the tab clears it. The same code also runs in the Zase Chrome extension, fully offline, which is the version to use when the payload is genuinely sensitive.",
      },
    ],
    example: {
      lead: "A typical API response arrives as one cramped line. One click turns it into something you can actually read:",
      inputLabel: "Before",
      input: `{"orderId":"ORD-2026-1042","customer":"Ayesha Khan","city":"Lahore","total":12500,"paid":true,"items":[{"name":"Kurta","qty":2},{"name":"Shalwar","qty":1}]}`,
      outputLabel: "After formatting",
      output: `{
  "orderId": "ORD-2026-1042",
  "customer": "Ayesha Khan",
  "city": "Lahore",
  "total": 12500,
  "paid": true,
  "items": [
    {
      "name": "Kurta",
      "qty": 2
    },
    {
      "name": "Shalwar",
      "qty": 1
    }
  ]
}`,
    },
    faq: [
      {
        q: "Why does my JSON fail to parse?",
        a: "The usual causes are trailing commas after the last item, single quotes instead of double quotes, unquoted key names, or comments inside the data. Strict JSON allows none of those. Paste it above and the error message points at the position, so you can fix the exact character instead of hunting through the whole file.",
      },
      {
        q: "Is it safe to paste a production API response here?",
        a: "Yes. The formatting happens locally in your browser: nothing is uploaded, stored or logged. Your payload stays on your device, and closing the tab discards it. For fully offline work, the same formatter is built into the free Zase Chrome extension.",
      },
      {
        q: "What is the difference between Format and Minify?",
        a: "Format adds indentation and line breaks so people can read the JSON. Minify removes all unnecessary whitespace so the JSON is as small as possible, which is what you want for storage, config values and sending payloads over the wire.",
      },
      {
        q: "Can this tool convert JSON to other formats?",
        a: "Yes. The same panel converts JSON to CSV, YAML and XML, and converts CSV back to JSON. There are also dedicated pages for JSON to CSV and JSON to YAML with the conversion already set up.",
      },
    ],
  },

  regex: {
    guide: [
      {
        h: "What a tester saves you from",
        p: "A regular expression usually fails quietly: it matches a little too much, a little too little, or the wrong thing entirely, and you find out in production. Testing the pattern against real sample text first turns that risk into a thirty second check. Paste the kind of text you actually process: log lines, form input, scraped content. If the pattern survives your ugliest real examples, it will survive the application.",
      },
      {
        h: "Flags, in plain words",
        p: "Flags change how the whole pattern behaves. The g flag finds every match instead of stopping at the first, which is what you want for counting, extracting and replacing. The i flag ignores letter case, so an email or name pattern works however the user typed it. The m flag makes the ^ and $ anchors match at line starts and ends inside a block of text, not just at the very beginning and end. Most surprises in regex work come from a missing flag rather than a wrong pattern.",
      },
      {
        h: "When a pattern matches too much",
        p: "Greedy quantifiers are the classic trap: .* happily swallows everything up to the last possible match instead of the first. Making it lazy with .*? or, better, naming exactly what belongs inside (for example [^\"]* inside quotes) fixes the match and makes the pattern faster and clearer. The other classic is forgetting to anchor: an unanchored pattern matches anywhere inside a longer string, so a validation pattern should usually start with ^ and end with $. Test both a string that should pass and one that should fail.",
      },
    ],
    example: {
      lead: "Dates inside a log line, pulled out with one pattern:",
      inputLabel: "Pattern and sample text",
      input: `Pattern: \\b\\d{4}-\\d{2}-\\d{2}\\b

2026-10-31 09:14:02 INFO Order ORD-1042 confirmed
2026-10-31 09:15:47 WARN Retry scheduled for 2026-11-02`,
      outputLabel: "Matches",
      output: `2026-10-31
2026-10-31
2026-11-02`,
    },
    faq: [
      {
        q: "What do the flags g, i and m mean?",
        a: "g finds all matches instead of only the first. i makes matching case-insensitive. m makes ^ and $ match at the start and end of each line inside a text block. You can combine them, for example gi for a global, case-insensitive search.",
      },
      {
        q: "Why does my pattern match more than I want?",
        a: "Almost always a greedy quantifier such as .* or .+ reaching too far. Make it lazy (.*?) or describe the inside precisely, for example [0-9]+ for digits only. Adding ^ and $ anchors also stops partial matches inside longer text.",
      },
      {
        q: "Can I test a find and replace here?",
        a: "Yes. The tester includes a replace mode: write the pattern, provide a replacement string (capture groups like $1 work), and preview the result on your sample text before you trust it in code.",
      },
      {
        q: "Is my sample text uploaded anywhere?",
        a: "No. Testing runs locally in your browser. Paste real log lines, user input or data samples without worrying about where they end up, because they never leave your device.",
      },
    ],
  },

  base64: {
    guide: [
      {
        h: "What Base64 is, and what it is not",
        p: "Base64 is a way to carry binary or special characters safely through systems that only handle plain text: email, JSON, URLs, HTML. It rewrites data using 64 safe characters (A to Z, a to z, 0 to 9, + and /) at the cost of making it about a third longer. It is an encoding, not encryption: anyone can decode it instantly, so it protects data from corruption and mangling, never from being read. Treat anything Base64 encoded as plain text for security purposes.",
      },
      {
        h: "Why UTF-8 safety matters",
        p: "Naive encoders break on text outside plain English: accented characters, Urdu, Arabic, emoji and smart quotes come out corrupted or throw errors. The reason is that Base64 works on bytes, and characters become bytes differently in different encodings. This tool encodes your text as UTF-8 bytes first and decodes back the same way, so a name like Ayesha or a line of Urdu survives the round trip exactly. If you have ever seen mojibake after a decode, an encoding mismatch like this was the cause.",
      },
      {
        h: "Where you will meet it",
        p: "JWTs are three Base64URL segments joined by dots. HTTP Basic auth is Base64 of username:password. Data URLs embed small images in CSS and HTML as Base64. API keys, certificates and email attachments all travel as Base64. Being able to decode a string on sight, locally, without uploading it, is a daily debugging skill, and it is exactly what this page is for.",
      },
    ],
    example: {
      lead: "Plain text in, Base64 out, and back again with Decode:",
      inputLabel: "Text",
      input: "Hello from Zase",
      outputLabel: "Base64",
      output: "SGVsbG8gZnJvbSBaYXNl",
    },
    faq: [
      {
        q: "Is Base64 a form of encryption?",
        a: "No. Base64 is an encoding that anyone can reverse instantly with no key. It exists to move data safely through text-only systems, not to keep secrets. For actual encryption, use the AES tool in this toolkit.",
      },
      {
        q: "Why does the encoded text end with = signs?",
        a: "The equals signs are padding. Base64 output must be a multiple of four characters, so one or two = characters are added at the end when the input length does not line up. Decoders expect them, so do not strip them off.",
      },
      {
        q: "What is the difference between Base64 and Base64URL?",
        a: "Base64URL is a URL-safe variant that replaces + with - and / with _ and usually drops the padding. It is the encoding used inside JSON Web Tokens. This tool handles standard Base64, and the JWT Decoder here handles the URL variant.",
      },
      {
        q: "Is it safe to decode a token or key I found in a log?",
        a: "Yes, on this page. Decoding runs locally in your browser and nothing is uploaded, so credentials and tokens are not sent to a third party server just to see what they contain.",
      },
    ],
  },

  jwt: {
    guide: [
      {
        h: "The three parts of a token",
        p: "A JSON Web Token is three Base64URL segments joined by dots. The header says how the token was signed, for example HS256 or RS256. The payload carries the claims: who the token belongs to (sub), when it expires (exp), when it was issued (iat), and whatever the application added, such as a name, email or role. The signature proves the first two parts were issued by someone holding the key and were not changed on the way. Decoding shows you the first two parts; it says nothing about the third.",
      },
      {
        h: "What to check when a token fails",
        p: "Start with exp: an expired token is the most common cause of a sudden 401, and comparing exp against the current time takes seconds once decoded. Then check the audience and issuer claims if your API validates them, and confirm the alg in the header matches what your server expects. Clock skew between servers causes tokens that look valid but fail as not yet active (nbf in the future) or freshly expired. Decoding the token turns all of these guesses into facts.",
      },
      {
        h: "Decoded is not the same as verified",
        p: "Anyone can create a token with any payload they like; the signature is the only proof. Never trust a decoded payload for security decisions until the signature has been verified with the secret or public key. And treat tokens like passwords while debugging: a live token pasted into a random website can be stolen. This decoder runs locally in your browser, and the Zase extension version works fully offline, so the token never leaves your machine.",
      },
    ],
    example: {
      lead: "The classic demo token decodes to a payload you can read:",
      inputLabel: "Token (trimmed)",
      input: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
      outputLabel: "Payload",
      output: `{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022
}`,
    },
    faq: [
      {
        q: "Does decoding a JWT verify its signature?",
        a: "No. Decoding only reads the header and payload. Verification is a separate step that checks the signature against the secret or public key. This toolkit's JWT Signer can verify HS256 tokens, so decode here to read, and verify there before trusting.",
      },
      {
        q: "What do exp, iat and sub mean?",
        a: "exp is the expiry time, iat is when the token was issued, and sub is the subject, usually the user ID the token belongs to. All times are Unix timestamps in seconds. If exp is in the past, the token is expired and servers will reject it.",
      },
      {
        q: "Is it safe to paste a real token here?",
        a: "Yes. Decoding happens locally in your browser; the token is never uploaded or stored. The Chrome extension version of this decoder works fully offline for complete peace of mind with production tokens.",
      },
      {
        q: "Why does my token show as invalid?",
        a: "Usually it was copied incompletely, picked up a space or newline, or is missing one of its three parts. A JWT has exactly two dots. Paste the whole token from the first character to the last, with nothing before or after it.",
      },
    ],
  },

  qr: {
    guide: [
      {
        h: "What belongs in a QR code",
        p: "Short, stable content scans best. A link to your site, a menu page, a payment page or a contact card works well because the phone already knows what to do with it. Long paragraphs are technically possible and practically a mistake: dense codes are harder to scan in poor light or at small sizes. If the destination might change, link to a page you control and update that page, because the printed code itself can never change.",
      },
      {
        h: "Size and error correction, in plain words",
        p: "Error correction lets a code survive damage: a logo in the middle, a scuffed print, a corner folded over. Higher correction means a denser code, so the trade is scan reliability against visual density. For most everyday uses the middle setting is right: forgiving of real-world prints without turning the code into static. Size follows the same practical rule: the further away the phone will be, the bigger the print needs to be. A counter card and a shopfront poster are very different sizes.",
      },
      {
        h: "SVG for print, PNG for sharing",
        p: "This generator offers both because they serve different jobs. SVG is a vector: it scales from a business card to a banner without going soft, which is what printers want. PNG is a fixed image that drops straight into a document, a slide, a WhatsApp message or a social post. Whichever you choose, keep strong contrast (dark code, light background), leave the quiet border around the code intact, and always test scan the final size before printing a hundred copies.",
      },
    ],
    example: {
      lead: "Type or paste a link, pick a size, and download. For example, this link becomes a scannable code in about a second:",
      inputLabel: "You type",
      input: "https://aktechsol.pk",
      outputLabel: "You get",
      output: "A crisp QR code image of that link, ready to download as SVG for print or PNG for sharing.",
    },
    faq: [
      {
        q: "Do QR codes created here expire?",
        a: "No. These are static codes: the content is stored in the pattern itself, not on a server, so the code works forever and there is no tracking or redirect in between. If you need the destination to change later, point the code at a page you control.",
      },
      {
        q: "Should I download SVG or PNG?",
        a: "SVG for anything printed or shown at a large size, because it stays sharp at any scale. PNG for documents, slides and messages, where a ready-made image is more convenient. Both are generated locally in your browser.",
      },
      {
        q: "How much text can a QR code hold?",
        a: "It depends on the error correction level; at the level used here, roughly a hundred characters of text fit comfortably. Links are the sweet spot. Very long text makes the code dense and hard to scan, so shorten it or link to the content instead.",
      },
      {
        q: "Can I put my logo in the middle of the code?",
        a: "Error correction tolerates a small central logo, but this generator keeps codes clean and standard for maximum scan reliability. If you add a logo afterwards, keep it small and always test scan the result before printing.",
      },
    ],
  },
};

/* ---------------- Converter landing pages (Step 4) ----------------
 * Dedicated pages for the conversions people actually search for.
 * Each mounts its parent tool with a sample already converted:
 * web-boot.js applies window.__ZASE_PRESET__ after mounting. */

const CONVERTERS = [
  {
    slug: "json-to-csv",
    tool: "json",
    name: "JSON to CSV Converter",
    title: "JSON to CSV Converter Online Free | Zase",
    description: "Convert JSON to CSV online for free. Paste a JSON array and get a clean CSV file for Excel or Sheets. Runs locally in your browser, nothing is uploaded.",
    long: "Turn a JSON array into a clean CSV file you can open in Excel or Google Sheets.",
    intro: "APIs speak JSON, but spreadsheets, clients and reports speak CSV. This page bridges the two: paste a JSON array of objects and the converter builds a CSV with a header row from the object keys and one row per object. It is the fastest way to get API data into Excel, Sheets or any tool that imports CSV, without writing a throwaway script.",
    howTo: [
      "Paste a JSON array of objects into the input panel (a sample array is already loaded).",
      "Click To CSV and check the result: keys become the header row, each object becomes a row.",
      "Copy the CSV, or download it and open it in your spreadsheet.",
    ],
    points: [
      "Values containing commas, quotes or newlines are quoted properly, so the CSV opens cleanly in Excel and Sheets.",
      "Nested objects are flattened into readable cell text instead of breaking the row layout.",
      "Conversion runs locally in your browser: private API data is never uploaded.",
    ],
    faq: [
      {
        q: "What JSON shape converts best to CSV?",
        a: "An array of flat objects with the same keys, like a list of orders or users. The keys become the header row. Single objects convert too, as a one-row file, and nested values are written as compact text inside their cell.",
      },
      {
        q: "Can I open the result directly in Excel?",
        a: "Yes. Download the CSV and double click it, or paste the result into a .csv file. Headers, quoting and line breaks follow the CSV standard that Excel and Google Sheets expect.",
      },
      {
        q: "Is my data uploaded for conversion?",
        a: "No. The converter runs entirely in your browser tab, so the JSON you paste never leaves your device.",
      },
    ],
    preset: {
      sample: `[{"name":"Ayesha Khan","city":"Lahore","total":12500},{"name":"Bilal Ahmed","city":"Karachi","total":8900},{"name":"Fatima Noor","city":"Islamabad","total":15200}]`,
      button: "To CSV",
    },
  },
  {
    slug: "json-to-yaml",
    tool: "json",
    name: "JSON to YAML Converter",
    title: "JSON to YAML Converter Online Free | Zase",
    description: "Convert JSON to YAML online for free. Turn API responses and JSON configs into clean, readable YAML. Private and local: nothing is uploaded.",
    long: "Turn JSON into clean, readable YAML for configs, pipelines and documentation.",
    intro: "YAML is the format humans edit: Docker Compose, GitHub Actions, Kubernetes and countless config files. JSON is the format machines exchange. This converter rewrites JSON as tidy YAML with proper indentation, so you can move a config or an API response into a file you are actually willing to maintain by hand.",
    howTo: [
      "Paste your JSON into the input panel (a sample config is already loaded).",
      "Click To YAML and review the indented result.",
      "Copy it into your .yaml or .yml file, or download it.",
    ],
    points: [
      "Nested objects and arrays indent the way YAML readers expect, two spaces per level.",
      "Strings that YAML could misread (like values starting with special characters) are quoted safely.",
      "Everything converts locally in your browser: configs with secrets in them stay on your device.",
    ],
    faq: [
      {
        q: "Why convert JSON to YAML at all?",
        a: "Readability. YAML drops the braces and quotes that make JSON configs noisy, which is why deployment and CI tools standardized on it. Converting is the quick way to move an API response or a JSON config into that world.",
      },
      {
        q: "Will the YAML keep my data types?",
        a: "Yes. Numbers stay numbers, booleans stay booleans, and strings are quoted when leaving them bare could change their meaning, for example a value like 0123 or the word yes.",
      },
      {
        q: "Is my config uploaded anywhere?",
        a: "No. Conversion is local to your browser tab. Paste real configs, including ones with environment values, without sending them to a server.",
      },
    ],
    preset: {
      sample: `{"shop":"AK Tech Sol","city":"Lahore","active":true,"services":["Web Development","SEO","Branding"],"team":{"developers":4,"designers":2}}`,
      button: "To YAML",
    },
  },
  {
    slug: "csv-to-json",
    tool: "json",
    name: "CSV to JSON Converter",
    title: "CSV to JSON Converter Online Free | Zase",
    description: "Convert CSV to JSON online for free. Paste spreadsheet data and get a JSON array of objects using your header row. Runs locally, no uploads.",
    long: "Turn spreadsheet rows into a JSON array your API or app can use directly.",
    intro: "Data usually arrives as a spreadsheet and needs to leave as JSON: seed data for an app, a product import, a one-off migration. This converter reads your CSV, takes the first row as keys, and returns a JSON array of objects, one per row. Quoted cells with commas inside them are handled properly, which is where quick hand-rolled parsers usually fail.",
    howTo: [
      "Paste your CSV into the input panel, keeping the header row first (sample data is loaded).",
      "Click CSV to JSON and check the array in the output.",
      "Copy the JSON into your code, seed file or API request.",
    ],
    points: [
      "The header row becomes the object keys automatically, so name,city becomes name and city fields.",
      "Quoted values containing commas and line breaks parse as single cells, per the CSV standard.",
      "Conversion is fully local: customer lists and order data are never uploaded.",
    ],
    faq: [
      {
        q: "Does the first row have to be headers?",
        a: "Yes. The converter treats the first row as the field names for every object. Name your columns the way you want the JSON keys to read, for example name, city and total.",
      },
      {
        q: "Do numbers stay numbers in the JSON?",
        a: "Values that are plainly numeric are written as JSON numbers, and everything else stays a string. Check the output before importing if a column mixes both, such as phone numbers with leading zeros, which are kept as strings.",
      },
      {
        q: "Is my spreadsheet data uploaded?",
        a: "No. The conversion happens in your browser. The CSV you paste never leaves your device, which matters when it is a customer or orders export.",
      },
    ],
    preset: {
      sample: "name,city,total\nAyesha Khan,Lahore,12500\nBilal Ahmed,Karachi,8900\nFatima Noor,Islamabad,15200",
      button: "CSV to JSON",
    },
  },
  {
    slug: "json-minifier",
    tool: "json",
    name: "JSON Minifier",
    title: "JSON Minifier Online Free | Zase",
    description: "Minify JSON online for free. Remove whitespace and shrink JSON for storage, configs and API payloads. Validates while it minifies, all locally.",
    long: "Shrink JSON by removing every wasted byte, and validate it at the same time.",
    intro: "Pretty JSON is for people; minified JSON is for machines. Minifying strips indentation and line breaks so the same data takes the least space in a config value, a database field, a cookie or a request body. This minifier validates while it works, so invalid JSON fails loudly here instead of breaking somewhere downstream.",
    howTo: [
      "Paste your formatted JSON into the input panel (a sample is already loaded).",
      "Click Minify and compare the character counts.",
      "Copy the compact result wherever it needs to go.",
    ],
    points: [
      "The data itself never changes: only whitespace between tokens is removed.",
      "Invalid JSON is rejected with the error position, not silently mangled.",
      "Runs locally in your browser, so payloads with private data stay private.",
    ],
    faq: [
      {
        q: "Does minifying change my data?",
        a: "No. Keys, values, order and types are all preserved exactly. Only the spaces, tabs and newlines that exist for human readers are removed.",
      },
      {
        q: "When should I minify JSON?",
        a: "When it is stored or transported rather than read: environment variables, database JSON columns, local storage, embedded configs and request bodies where size matters.",
      },
      {
        q: "What if my JSON has an error in it?",
        a: "You will see the parser error and its position instead of a minified file. Fix that spot (trailing commas are the usual suspect) and minify again.",
      },
    ],
    preset: {
      sample: `{
  "name": "Developer Toolkit by Zase",
  "private": true,
  "features": [
    "offline",
    "no tracking",
    "free"
  ]
}`,
      button: "Minify",
    },
  },
  {
    slug: "base64-encode",
    tool: "base64",
    name: "Base64 Encoder",
    title: "Base64 Encode Online Free | Zase",
    description: "Encode text to Base64 online for free. UTF-8 safe, so names, Urdu, Arabic and emoji encode correctly. Runs locally in your browser.",
    long: "Encode any text to Base64, with proper UTF-8 handling for every language.",
    intro: "Base64 encoding turns text and binary data into a safe alphabet that survives email, JSON, URLs and HTML. This encoder is UTF-8 safe: names with accents, Urdu and Arabic text, and emoji all encode correctly and decode back exactly, which is where many quick online encoders quietly corrupt your data.",
    howTo: [
      "Type or paste your text into the input panel (a sample is loaded).",
      "Click Encode.",
      "Copy the Base64 result into your header, data URL or payload.",
    ],
    points: [
      "UTF-8 safe round trip: what you encode is exactly what decoding returns.",
      "Works for Basic auth strings, data URLs and embedding small assets.",
      "Your text is encoded locally and never uploaded.",
    ],
    faq: [
      {
        q: "Why is the output longer than my text?",
        a: "Base64 represents every 3 bytes with 4 characters, so output grows by about a third. That overhead is the price of using only safe, printable characters.",
      },
      {
        q: "Can I encode text in Urdu, Arabic or with emoji?",
        a: "Yes. The encoder converts your text to UTF-8 bytes first, which is the step naive encoders skip. Any language and emoji encode and decode back exactly.",
      },
      {
        q: "Is Base64 encoding the same as encrypting?",
        a: "No. Anyone can decode Base64 instantly. It makes data safe to transport, not secret. Use the AES tool in this toolkit when you need real encryption.",
      },
    ],
    preset: { sample: "Hello from Zase", button: "Encode" },
  },
  {
    slug: "base64-decode",
    tool: "base64",
    name: "Base64 Decoder",
    title: "Base64 Decode Online Free | Zase",
    description: "Decode Base64 to text online for free. UTF-8 safe decoding for tokens, headers and payloads. Fully local: what you decode never leaves your device.",
    long: "Decode Base64 back to readable text, safely and locally.",
    intro: "Base64 strings turn up everywhere: auth headers, JWT segments, email bodies, API payloads and config values. This decoder turns them back into readable text with correct UTF-8 handling, entirely in your browser. That local part matters: the string you are decoding is often a credential or a token, and it should not be pasted into a stranger's server just to be read.",
    howTo: [
      "Paste the Base64 string into the input panel (a sample is loaded).",
      "Click Decode.",
      "Read or copy the decoded text.",
    ],
    points: [
      "UTF-8 aware: multilingual text decodes back exactly as it was encoded.",
      "Invalid input is reported clearly instead of returning garbage.",
      "Decoding is fully local: tokens and credentials never leave your device.",
    ],
    faq: [
      {
        q: "Why did my string fail to decode?",
        a: "Usually it was truncated in copying, includes a space or newline in the middle, or is Base64URL (with - and _ characters) rather than standard Base64. Check the full string, including any = padding at the end.",
      },
      {
        q: "Can this decode the parts of a JWT?",
        a: "JWT segments use the Base64URL variant. For tokens, use the JWT Decoder on this site, which handles that variant and labels the header and payload for you.",
      },
      {
        q: "Is it safe to decode an API key or token here?",
        a: "Yes. Decoding runs locally in your browser tab; nothing is uploaded, stored or logged. The string stays on your device from start to finish.",
      },
    ],
    preset: { sample: "SGVsbG8gZnJvbSBaYXNl", button: "Decode" },
  },
];


/* ---------------- build ---------------- */

function main() {
  const { tools, iconSvg } = loadRegistry();
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
  );
  const version = manifest.version;

  /* Tool CSS by convention: css/tools/_shared.css plus one
   * css/tools/<id>.css per tool, the same set popup.html links. */
  const toolCssFiles = fs
    .readdirSync(path.join(ROOT, "css", "tools"))
    .filter((f) => f.endsWith(".css"));

  const headT = readTemplate("head.html");
  const headerT = readTemplate("header.html");
  const footerT = readTemplate("footer.html");
  const cardT = readTemplate("tool-card.html");
  const sectionT = readTemplate("category-section.html");
  const homeT = readTemplate("home.html");
  const toolT = readTemplate("tool.html");
  const relatedT = readTemplate("related-section.html");
  const categoryT = readTemplate("category.html");
  const aboutT = readTemplate("about.html");
  const contactT = readTemplate("contact.html");
  const privacyT = readTemplate("privacy.html");
  const toolsT = readTemplate("tools.html");
  const supportT = readTemplate("support.html");
  const notFoundT = readTemplate("404.html");

  /* Slugs with collision guard. */
  const slugOf = new Map();
  const warnings = [];
  for (const tool of tools) {
    let slug = SLUGS[tool.id];
    if (!slug) {
      slug = tool.id;
      warnings.push("No SEO slug for tool '" + tool.id + "', using id.");
    }
    if ([...slugOf.values()].includes(slug)) {
      warnings.push("Slug collision for '" + slug + "'.");
    }
    slugOf.set(tool.id, slug);
  }

  const iconHtml = (tool) =>
    '<span class="dt-icon" aria-hidden="true">' +
    iconSvg(tool.icon) +
    "</span>";

  const cardHtml = (tool, prefix) =>
    fill(cardT, {
      PREFIX: prefix,
      SLUG: slugOf.get(tool.id),
      NAME: esc(tool.name),
      DESCRIPTION: esc(tool.description),
      ICON_SVG: iconHtml(tool),
      CAT_SLUG: categorySlug(tool.category),
      SEARCH_TEXT: escAttr(
        (
          tool.name +
          " " +
          tool.description +
          " " +
          (Array.isArray(tool.keywords)
            ? tool.keywords.join(" ")
            : String(tool.keywords || ""))
        ).toLowerCase()
      ),
    });

  /* Category order follows the first tool that uses each one,
   * which mirrors the extension sidebar order. */
  const categories = [];
  for (const tool of tools) {
    if (!categories.includes(tool.category)) categories.push(tool.category);
  }
  const toolsIn = (cat) => tools.filter((t) => t.category === cat);

  /* Footer shared blocks: category links + top tools links. */
  const footerCategories = categories
    .map(
      (cat) =>
        '          <a href="/category/' +
        categorySlug(cat) +
        '/">' +
        esc(cat) +
        "</a>"
    )
    .join("\n");
  const topToolIds = ["json", "jwt", "regex", "base64", "qr", "password"];
  const footerTopTools = topToolIds
    .map((id) => tools.find((t) => t.id === id))
    .filter(Boolean)
    .map(
      (tool) =>
        '          <a href="/' + slugOf.get(tool.id) + '/">' + esc(tool.name) + "</a>"
    )
    .join("\n");

  /**
   * Render one full page: head (with JSON-LD) + header + body +
   * footer. prefix is "" at root, "../" one level deep and
   * "../../" for category pages two levels deep.
   */
  function renderPage({ title, description, path: urlPath, prefix, body, scripts, jsonLd, extraCss, nav }) {
    const canonical = urlPath === "" ? BASE_URL + "/" : BASE_URL + "/" + urlPath + "/";
    const scriptTags = (scripts || [])
      .map((src) => '    <script src="' + prefix + src + '"></script>')
      .join("\n");
    const head = fill(headT, {
      TITLE: esc(title),
      DESCRIPTION: escAttr(description),
      CANONICAL: canonical,
      OG_IMAGE: OG_IMAGE,
      PREFIX: prefix,
      JSON_LD: (jsonLd || []).map(jsonLdTag).join(""),
      EXTRA_CSS: extraCss || "",
    });
    /* Header nav: the link for the current page carries the
     * active class plus aria-current; all other tokens are empty. */
    const NAV_ACTIVE = ' class="z-nav--active" aria-current="page"';
    const header = fill(headerT, {
      PREFIX: prefix,
      STORE_URL: STORE_URL,
      NAV_HOME: nav === "home" ? NAV_ACTIVE : "",
      NAV_TOOLS: nav === "tools" ? NAV_ACTIVE : "",
      NAV_ABOUT: nav === "about" ? NAV_ACTIVE : "",
      NAV_CONTACT: nav === "contact" ? NAV_ACTIVE : "",
      NAV_SUPPORT: nav === "support" ? NAV_ACTIVE : "",
      NAV_PRIVACY: nav === "privacy" ? NAV_ACTIVE : "",
    });
    const footer = fill(footerT, {
      PREFIX: prefix,
      VERSION: version,
      FOOTER_CATEGORIES: footerCategories,
      FOOTER_TOP_TOOLS: footerTopTools,
      STORE_URL: STORE_URL,
      GITHUB_URL: GITHUB_URL,
      EXTRA_SCRIPTS: scriptTags,
    });
    return head + "\n" + header + "\n" + body + "\n" + footer;
  }

  function writePage(relDir, html) {
    const outDir = relDir ? path.join(DIST, relDir) : DIST;
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "index.html"), html);
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  /* ---- Step 4 helpers: deep sections + converter cards ---- */
  const faqItemsHtml = (items) =>
    items
      .map(
        (item) =>
          '          <details class="z-faq__item">\n' +
          "            <summary>" +
          esc(item.q) +
          "</summary>\n" +
          "            <p>" +
          esc(item.a) +
          "</p>\n" +
          "          </details>"
      )
      .join("\n");

  const faqSectionHtml = (items) =>
    items && items.length
      ? "          <h2>Frequently asked questions</h2>\n" + faqItemsHtml(items)
      : "";

  const faqPageLd = (items) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  });

  const exampleSectionHtml = (deep) => {
    const ex = deep.example;
    if (!ex) return "";
    return (
      "          <h2>See it in action</h2>\n" +
      "          <p>" +
      esc(ex.lead) +
      "</p>\n" +
      '          <div class="z-seo__example">\n' +
      '            <p class="z-seo__example-label">' +
      esc(ex.inputLabel) +
      "</p>\n" +
      "            <pre>" +
      esc(ex.input) +
      "</pre>\n" +
      '            <p class="z-seo__example-label">' +
      esc(ex.outputLabel) +
      "</p>\n" +
      "            <pre>" +
      esc(ex.output) +
      "</pre>\n" +
      "          </div>"
    );
  };

  const guideSectionHtml = (deep, tool) => {
    if (!deep.guide) return "";
    return (
      "          <h2>More about the " +
      esc(tool.name) +
      "</h2>\n" +
      deep.guide
        .map((g) => "          <h3>" + esc(g.h) + "</h3>\n          <p>" + esc(g.p) + "</p>")
        .join("\n")
    );
  };

  const converterCardHtml = (conv, prefix) => {
    const parent = tools.find((t) => t.id === conv.tool);
    return fill(cardT, {
      PREFIX: prefix,
      SLUG: conv.slug,
      NAME: esc(conv.name),
      DESCRIPTION: esc(conv.long),
      ICON_SVG: parent ? iconHtml(parent) : "",
      CAT_SLUG: parent ? categorySlug(parent.category) : "",
      SEARCH_TEXT: escAttr(conv.name.toLowerCase()),
    });
  };

  const converterSectionFor = (tool) => {
    const mine = CONVERTERS.filter((c) => c.tool === tool.id);
    if (!mine.length) return "";
    return fill(relatedT, {
      CARDS: mine.map((c) => converterCardHtml(c, "../")).join("\n"),
    }).replace("Related tools", "Popular conversions");
  };

  const converterHomeSection =
    '      <section class="z-wrap z-reveal">\n' +
    '        <div class="z-category__head">\n' +
    "          <h2>Popular converters</h2>\n" +
    "        </div>\n" +
    '        <div class="z-grid">\n' +
    CONVERTERS.map((c) => converterCardHtml(c, "")).join("\n") +
    "\n        </div>\n" +
    "      </section>";

  /* ---- Home page ---- */
  const categorySections = categories
    .map((cat) =>
      fill(sectionT, {
        CATEGORY: esc(cat),
        CAT_SLUG: categorySlug(cat),
        PREFIX: "",
        CARDS: toolsIn(cat).map((t) => cardHtml(t, "")).join("\n"),
      })
    )
    .join("\n");

  const faqItems = FAQ.map(
    (item) =>
      '          <details class="z-faq__item">\n' +
      "            <summary>" +
      esc(item.q) +
      "</summary>\n" +
      "            <p>" +
      esc(item.a) +
      "</p>\n" +
      "          </details>"
  ).join("\n");

  const homeHtml = renderPage({
    title: "Zase: Free Online Developer Tools",
    description:
      "Developer Toolkit by Zase: free online tools for developers. Format JSON, decode JWTs, test regex, encode Base64 and more. Everything runs locally in your browser: no uploads, no accounts.",
    path: "",
    prefix: "",
    nav: "home",
    body: fill(homeT, {
      CATEGORY_SECTIONS: categorySections,
      FAQ_ITEMS: faqItems,
      STORE_URL: STORE_URL,
      CONVERTER_SECTION: converterHomeSection,
    }),
    scripts: [],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Zase",
        url: BASE_URL + "/",
        logo: BASE_URL + "/site/icon-192.png",
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Zase: Developer Tools",
        url: BASE_URL + "/",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  });
  writePage("", homeHtml);

  /* ---- Tools page: every tool with live search, nothing else ---- */
  const toolsCategorySections = categories
    .map((cat) =>
      fill(sectionT, {
        CATEGORY: esc(cat),
        CAT_SLUG: categorySlug(cat),
        PREFIX: "../",
        CARDS: toolsIn(cat).map((t) => cardHtml(t, "../")).join("\n"),
      })
    )
    .join("\n");
  writePage(
    "tools",
    renderPage({
      title: "All Tools | Zase",
      description:
        "Every free Zase developer tool in one place: JSON, JWT, regex, Base64, hashes, QR codes and more. All run locally in your browser.",
      path: "tools",
      prefix: "../",
      nav: "tools",
      body: fill(toolsT, { CATEGORY_SECTIONS: toolsCategorySections }),
      scripts: [],
      jsonLd: [
        breadcrumbLd([
          { name: "Home", url: BASE_URL + "/" },
          { name: "Tools", url: BASE_URL + "/tools/" },
        ]),
      ],
    })
  );

  /* ---- One page per tool ---- */
  for (const tool of tools) {
    const slug = slugOf.get(tool.id);
    const sameCat = toolsIn(tool.category).filter((t) => t.id !== tool.id);
    const others = tools.filter(
      (t) => t.id !== tool.id && t.category !== tool.category
    );
    const related = sameCat.concat(others).slice(0, 4);
    const content = CONTENT[tool.id];
    const deep = DEEP_CONTENT[tool.id];

    const relatedSection = related.length
      ? fill(relatedT, { CARDS: related.map((t) => cardHtml(t, "../")).join("\n") })
      : "";

    const body = fill(toolT, {
      NAME: esc(tool.name),
      LONG_DESCRIPTION: esc(tool.description),
      ICON_SVG: iconHtml(tool),
      TOOL_ID: tool.id,
      CATEGORY: esc(tool.category),
      CAT_SLUG: categorySlug(tool.category),
      PREFIX: "../",
      RELATED_SECTION: relatedSection,
      STORE_URL: STORE_URL,
      INTRO: content ? esc(content.intro) : "",
      HOW_STEPS: content
        ? content.howTo
            .map((step) => "            <li>" + esc(step) + "</li>")
            .join("\n")
        : "",
      POINT_ITEMS: content
        ? content.points
            .map((point) => "            <li>" + esc(point) + "</li>")
            .join("\n")
        : "",
      EXAMPLE_SECTION: deep ? exampleSectionHtml(deep) : "",
      GUIDE_SECTION: deep ? guideSectionHtml(deep, tool) : "",
      FAQ_SECTION: deep ? faqSectionHtml(deep.faq) : "",
      CONVERTER_SECTION: converterSectionFor(tool),
      PRESET_SCRIPT: "",
    });

    const scripts = [
      "site/web-shim.js",
      ...RUNTIME_JS,
      "js/tools/" + tool.id + ".js",
      "site/web-boot.js",
      /* Tool pages only: the win-ask install card. Home, category
       * and info pages never load it. */
      "site/install-prompt.js",
    ];

    /* Tool pages load the shared component styles plus the
     * tool stylesheets (_shared + this tool's own) via EXTRA_CSS,
     * mirroring the link set in popup.html. */
    const ownCss = "tools/" + tool.id + ".css";
    const ownCssLink = toolCssFiles.includes(tool.id + ".css")
      ? '\n    <link rel="stylesheet" href="../css/' + ownCss + '" />'
      : "";
    const extraCss =
      '    <link rel="stylesheet" href="../css/components.css" />' +
      '\n    <link rel="stylesheet" href="../css/tools/_shared.css" />' +
      ownCssLink;

    writePage(
      slug,
      renderPage({
        title: tool.name + " Online Free | Zase",
        description: tool.description,
        path: slug,
        prefix: "../",
        nav: "tools",
        body,
        scripts,
        extraCss,
        jsonLd: [
          breadcrumbLd([
            { name: "Home", url: BASE_URL + "/" },
            {
              name: tool.category,
              url: BASE_URL + "/category/" + categorySlug(tool.category) + "/",
            },
            { name: tool.name, url: BASE_URL + "/" + slug + "/" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: tool.name,
            url: BASE_URL + "/" + slug + "/",
            description: tool.description,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          ...(deep && deep.faq ? [faqPageLd(deep.faq)] : []),
        ],
      })
    );
  }

  /* ---- Converter landing pages (Step 4) ---- */
  for (const conv of CONVERTERS) {
    const tool = tools.find((t) => t.id === conv.tool);
    if (!tool) {
      warnings.push(
        "Converter '" + conv.slug + "' points at unknown tool '" + conv.tool + "'."
      );
      continue;
    }
    const siblings = CONVERTERS.filter((c) => c.slug !== conv.slug).slice(0, 3);
    const relatedCards = [cardHtml(tool, "../")].concat(
      siblings.map((c) => converterCardHtml(c, "../"))
    );
    const relatedSection = fill(relatedT, { CARDS: relatedCards.join("\n") });

    const presetScript =
      "        <script>window.__ZASE_PRESET__ = " +
      JSON.stringify(conv.preset).split("<").join("\\u003c") +
      ";</script>";

    const body = fill(toolT, {
      NAME: esc(conv.name),
      LONG_DESCRIPTION: esc(conv.long),
      ICON_SVG: iconHtml(tool),
      TOOL_ID: tool.id,
      CATEGORY: esc(tool.category),
      CAT_SLUG: categorySlug(tool.category),
      PREFIX: "../",
      RELATED_SECTION: relatedSection,
      STORE_URL: STORE_URL,
      INTRO: esc(conv.intro),
      HOW_STEPS: conv.howTo
        .map((step) => "            <li>" + esc(step) + "</li>")
        .join("\n"),
      POINT_ITEMS: conv.points
        .map((point) => "            <li>" + esc(point) + "</li>")
        .join("\n"),
      EXAMPLE_SECTION: "",
      GUIDE_SECTION: "",
      FAQ_SECTION: faqSectionHtml(conv.faq),
      CONVERTER_SECTION: "",
      PRESET_SCRIPT: presetScript,
    });

    const scripts = [
      "site/web-shim.js",
      ...RUNTIME_JS,
      "js/tools/" + tool.id + ".js",
      "site/web-boot.js",
      "site/install-prompt.js",
    ];

    const ownCss = "tools/" + tool.id + ".css";
    const ownCssLink = toolCssFiles.includes(tool.id + ".css")
      ? '\n    <link rel="stylesheet" href="../css/' + ownCss + '" />'
      : "";
    const extraCss =
      '    <link rel="stylesheet" href="../css/components.css" />' +
      '\n    <link rel="stylesheet" href="../css/tools/_shared.css" />' +
      ownCssLink;

    writePage(
      conv.slug,
      renderPage({
        title: conv.title,
        description: conv.description,
        path: conv.slug,
        prefix: "../",
        nav: "tools",
        body,
        scripts,
        extraCss,
        jsonLd: [
          breadcrumbLd([
            { name: "Home", url: BASE_URL + "/" },
            {
              name: tool.category,
              url: BASE_URL + "/category/" + categorySlug(tool.category) + "/",
            },
            { name: conv.name, url: BASE_URL + "/" + conv.slug + "/" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: conv.name,
            url: BASE_URL + "/" + conv.slug + "/",
            description: conv.description,
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Any",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          faqPageLd(conv.faq),
        ],
      })
    );
  }

  /* ---- One landing page per category ---- */
  for (const cat of categories) {
    const catSlug = categorySlug(cat);
    const catTools = toolsIn(cat);
    const siblings = categories
      .filter((c) => c !== cat)
      .map(
        (c) =>
          '          <a href="../' + categorySlug(c) + '/">' + esc(c) + "</a>"
      )
      .join("\n");

    const body = fill(categoryT, {
      CATEGORY: esc(cat),
      INTRO: esc(CATEGORY_INTRO[cat] || ""),
      PREFIX: "../../",
      CARDS: catTools.map((t) => cardHtml(t, "../../")).join("\n"),
      SIBLING_LINKS: siblings,
    });

    writePage(
      path.join("category", catSlug),
      renderPage({
        title: cat + " Tools Online Free | Zase",
        description:
          CATEGORY_INTRO[cat] ||
          "Free online " + cat.toLowerCase() + " tools from Zase.",
        path: "category/" + catSlug,
        prefix: "../../",
        nav: "tools",
        body,
        scripts: [],
        jsonLd: [
          breadcrumbLd([
            { name: "Home", url: BASE_URL + "/" },
            { name: cat, url: BASE_URL + "/category/" + catSlug + "/" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: cat + " Tools",
            itemListElement: catTools.map((tool, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: tool.name,
              url: BASE_URL + "/" + slugOf.get(tool.id) + "/",
            })),
          },
        ],
      })
    );
  }

  /* ---- Static pages: about, contact, privacy ---- */
  const staticPages = [
    {
      dir: "about",
      title: "About | Zase",
      description:
        "About Zase: free developer tools that run entirely on your own device, built and maintained by software engineer Hamza Shabbir. No accounts, no tracking, open source.",
      template: aboutT,
      fillMap: { STORE_URL: STORE_URL, GITHUB_URL: GITHUB_URL },
    },
    {
      dir: "contact",
      title: "Contact | Zase",
      description:
        "Contact Zase: email, GitHub issues and the Chrome Web Store listing. Report a bug, request a tool or get extension support.",
      template: contactT,
      fillMap: { STORE_URL: STORE_URL, GITHUB_URL: GITHUB_URL },
    },
    {
      dir: "privacy",
      title: "Privacy Policy | Zase",
      description:
        "Zase privacy policy: every tool runs locally on your device. No uploads, no accounts, no analytics, no tracking, no data collection.",
      template: privacyT,
      fillMap: { GITHUB_URL: GITHUB_URL },
    },
    {
      dir: "support",
      title: "Support Zase | Patreon and Crypto",
      description:
        "Support Zase: become a member on Patreon or send a one-time USDT (Tron TRC20) transfer. Every tool is free: contributions keep them maintained and improving.",
      template: supportT,
      fillMap: { PATREON_URL: PATREON_URL, USDT_ADDRESS: USDT_ADDRESS },
    },
  ];
  for (const page of staticPages) {
    const body = fill(page.template, {
      PREFIX: "../",
      VERSION: version,
      ...page.fillMap,
    });
    writePage(
      page.dir,
      renderPage({
        title: page.title,
        description: page.description,
        path: page.dir,
        prefix: "../",
        nav: page.dir,
        body,
        scripts: [],
        jsonLd: [
          breadcrumbLd([
            { name: "Home", url: BASE_URL + "/" },
            {
              name: page.dir.charAt(0).toUpperCase() + page.dir.slice(1),
              url: BASE_URL + "/" + page.dir + "/",
            },
          ]),
        ],
      })
    );
  }

  /* ---- 404 (no prefix-relative assets: error pages can be
   * served from any depth, so use root-absolute paths) ---- */
  const notFound = renderPage({
    title: "Page Not Found | Zase",
    description: "The page you are looking for does not exist.",
    path: "404",
    prefix: "/",
    body: fill(notFoundT, { PREFIX: "/" }),
    scripts: [],
  });
  fs.writeFileSync(path.join(DIST, "404.html"), notFound);

  /* ---- Runtime + site asset copies ---- */
  for (const rel of [
    ...RUNTIME_JS,
    ...RUNTIME_CSS,
    ...toolCssFiles.map((f) => "css/tools/" + f),
    "assets/fonts/Sora-Variable.woff2",
    "assets/fonts/JetBrainsMono-Variable.woff2",
    "assets/icons/icon16.png",
    "assets/icons/icon32.png",
    "assets/icons/icon48.png",
    "assets/icons/icon128.png",
    "assets/icons/icon.svg",
  ]) {
    copyIntoDist(rel);
  }
  /* The shim carries manifest placeholders the build replaces
   * with the real name and version, like the extension runtime
   * would report through chrome.runtime.getManifest(). */
  const shimSource = fs
    .readFileSync(path.join(SRC, "assets", "web-shim.js"), "utf8")
    .split("__ZASE_MANIFEST_NAME__")
    .join(manifest.name)
    .split("__ZASE_MANIFEST_VERSION__")
    .join(version);
  fs.mkdirSync(path.join(DIST, "site"), { recursive: true });
  fs.writeFileSync(path.join(DIST, "site", "web-shim.js"), shimSource);
  copyFile(
    path.join(SRC, "assets", "web-boot.js"),
    path.join(DIST, "site", "web-boot.js")
  );
  copyFile(
    path.join(SRC, "assets", "install-prompt.js"),
    path.join(DIST, "site", "install-prompt.js")
  );
  copyFile(
    path.join(SRC, "assets", "site.js"),
    path.join(DIST, "site", "site.js")
  );
  copyFile(
    path.join(SRC, "assets", "site.css"),
    path.join(DIST, "site", "site.css")
  );
  /* Root-level site assets: favicon set, OG image, web manifest. */
  for (const name of ["favicon.ico", "og-image.png", "apple-touch-icon.png"]) {
    copyFile(path.join(SRC, "assets", name), path.join(DIST, name));
  }
  for (const name of ["icon-96.png", "icon-192.png", "icon-512.png", "chrome.svg", "usdt-qr.svg"]) {
    copyFile(path.join(SRC, "assets", name), path.join(DIST, "site", name));
  }
  /* head.html links the web manifest at the site root. */
  copyFile(
    path.join(SRC, "assets", "site.webmanifest"),
    path.join(DIST, "site.webmanifest")
  )
  for (const tool of tools) {
    copyIntoDist("js/tools/" + tool.id + ".js");
  }
  /* The manifest the web shim reads for name/version. */
  copyIntoDist("manifest.json");

  /* ---- sitemap.xml + robots.txt ---- */
  const urls = [
    { loc: BASE_URL + "/", priority: "1.0" },
    { loc: BASE_URL + "/tools/", priority: "0.9" },
    ...tools.map((t) => ({ loc: BASE_URL + "/" + slugOf.get(t.id) + "/", priority: "0.8" })),
    ...CONVERTERS.map((c) => ({ loc: BASE_URL + "/" + c.slug + "/", priority: "0.7" })),
    ...categories.map((c) => ({
      loc: BASE_URL + "/category/" + categorySlug(c) + "/",
      priority: "0.6",
    })),
    { loc: BASE_URL + "/about/", priority: "0.4" },
    { loc: BASE_URL + "/contact/", priority: "0.4" },
    { loc: BASE_URL + "/support/", priority: "0.4" },
    { loc: BASE_URL + "/privacy/", priority: "0.3" },
  ];
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "  <url><loc>" + u.loc + "</loc><priority>" + u.priority + "</priority></url>"
      )
      .join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(
    path.join(DIST, "robots.txt"),
    "User-agent: *\nAllow: /\n\nSitemap: " + BASE_URL + "/sitemap.xml\n"
  );

  /* ---- build report ---- */
  const missingContent = tools.filter((t) => !CONTENT[t.id]).map((t) => t.id);
  if (missingContent.length) {
    warnings.push("Tools without SEO content: " + missingContent.join(", "));
  }
  console.log("Zase site built into site/dist");
  console.log("  tools:      " + tools.length);
  console.log("  categories: " + categories.length);
  console.log("  sitemap:    " + urls.length + " URLs");
  console.log("  version:    " + version);
  for (const w of warnings) console.log("  WARNING: " + w);
}

main();
