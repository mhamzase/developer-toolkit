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
 *   - dist/about, dist/contact, dist/privacy, dist/404.html
 *   - dist/sitemap.xml           every page (49 URLs)
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

const BASE_URL = "https://zase-tools.pages.dev";
const STORE_URL =
  "https://chromewebstore.google.com/detail/developer-toolkit-json-jw/fhjlhcecanniahjgnjffdhmfkfikkkdg";
const GITHUB_URL = "https://github.com/mhamzase/developer-toolkit";
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
      NAV_TOOLS: nav === "tools" ? NAV_ACTIVE : "",
      NAV_ABOUT: nav === "about" ? NAV_ACTIVE : "",
      NAV_CONTACT: nav === "contact" ? NAV_ACTIVE : "",
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
    nav: "tools",
    body: fill(homeT, {
      CATEGORY_SECTIONS: categorySections,
      FAQ_ITEMS: faqItems,
      STORE_URL: STORE_URL,
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

  /* ---- One page per tool ---- */
  for (const tool of tools) {
    const slug = slugOf.get(tool.id);
    const sameCat = toolsIn(tool.category).filter((t) => t.id !== tool.id);
    const others = tools.filter(
      (t) => t.id !== tool.id && t.category !== tool.category
    );
    const related = sameCat.concat(others).slice(0, 4);
    const content = CONTENT[tool.id];

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
    });

    const scripts = [
      "site/web-shim.js",
      ...RUNTIME_JS,
      "js/tools/" + tool.id + ".js",
      "site/web-boot.js",
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
  for (const name of ["icon-96.png", "icon-192.png", "icon-512.png", "chrome.svg"]) {
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
    ...tools.map((t) => ({ loc: BASE_URL + "/" + slugOf.get(t.id) + "/", priority: "0.8" })),
    ...categories.map((c) => ({
      loc: BASE_URL + "/category/" + categorySlug(c) + "/",
      priority: "0.6",
    })),
    { loc: BASE_URL + "/about/", priority: "0.4" },
    { loc: BASE_URL + "/contact/", priority: "0.4" },
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
