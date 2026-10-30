/**
 * File: site/build.mjs
 * Purpose: Static site generator for the Zase website.
 *
 * Reads the REAL tool registry by loading the extension's tool
 * files in a Node vm sandbox (the same trick tests/smoke.js uses
 * with jsdom, minus the DOM: tool files only self-register into
 * window.DT at load time), then renders:
 *   - dist/index.html            home: hero, search, grouped grid
 *   - dist/<slug>/index.html     one page per tool
 *   - dist/about/index.html      about page
 *   - dist/privacy/index.html    privacy page
 *   - dist/404.html              not-found page
 *   - dist/sitemap.xml           every page
 *   - dist/robots.txt            allow all + sitemap line
 * plus copies of the extension runtime files the site needs
 * (js, css, fonts, icons) and the site assets from site/src/.
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

const BASE_URL = "https://devzase.pages.dev";
const STORE_URL =
  "https://chromewebstore.google.com/detail/developer-toolkit-json-jw/fhjlhcecanniahjgnjffdhmfkfikkkdg";
const GITHUB_URL = "https://github.com/mhamzase/developer-toolkit";
const OG_IMAGE = BASE_URL + "/assets/icons/icon128.png";

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

/* ---------------- page assembly ---------------- */

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
);

function renderPage({ prefix, title, description, canonical, body, extraCss, extraScripts }) {
  const head = fill(readTemplate("head.html"), {
    TITLE: esc(title),
    DESCRIPTION: escAttr(description),
    CANONICAL: canonical,
    OG_IMAGE,
    PREFIX: prefix,
    EXTRA_CSS: extraCss || "",
  });
  const header = fill(readTemplate("header.html"), {
    PREFIX: prefix,
    STORE_URL,
  });
  const footer = fill(readTemplate("footer.html"), {
    PREFIX: prefix,
    VERSION: esc(manifest.version),
    GITHUB_URL,
    EXTRA_SCRIPTS: extraScripts || "",
  });
  return head + header + body + footer;
}

function scriptTags(prefix, relPaths) {
  return relPaths
    .map((rel) => '    <script src="' + prefix + rel + '"></script>')
    .join("\n");
}

function cssLinks(prefix, relPaths) {
  return relPaths
    .map((rel) => '    <link rel="stylesheet" href="' + prefix + rel + '" />')
    .join("\n");
}

/* ---------------- main build ---------------- */

function main() {
  const { tools, iconSvg } = loadRegistry();

  /* Resolve slugs; warn on any tool id missing from the map. */
  const usedSlugs = new Set();
  for (const tool of tools) {
    tool.slug = SLUGS[tool.id];
    if (!tool.slug) {
      tool.slug = tool.id;
      console.warn(
        "[build] WARNING: no SEO slug mapped for tool '" +
          tool.id +
          "', falling back to the id."
      );
    }
    if (usedSlugs.has(tool.slug)) {
      throw new Error("Duplicate slug: " + tool.slug);
    }
    usedSlugs.add(tool.slug);
    tool.catSlug = categorySlug(tool.category);
  }

  /* Categories in first-seen (popup) order; tools name-sorted
   * inside each category, matching the extension grid order. */
  const categories = [];
  for (const tool of tools) {
    let cat = categories.find((c) => c.name === tool.category);
    if (!cat) {
      cat = { name: tool.category, slug: tool.catSlug, tools: [] };
      categories.push(cat);
    }
    cat.tools.push(tool);
  }
  for (const cat of categories) {
    cat.tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  /* Fresh dist. */
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  /* Copy extension runtime assets (paths preserved so relative
   * URLs inside the CSS, e.g. fonts, keep resolving). */
  for (const rel of RUNTIME_JS) copyIntoDist(rel);
  for (const file of fs.readdirSync(path.join(ROOT, "js/tools"))) {
    if (file.endsWith(".js")) copyIntoDist("js/tools/" + file);
  }
  for (const rel of RUNTIME_CSS) copyIntoDist(rel);
  for (const file of fs.readdirSync(path.join(ROOT, "css/tools"))) {
    if (file.endsWith(".css")) copyIntoDist("css/tools/" + file);
  }
  for (const file of fs.readdirSync(path.join(ROOT, "assets/fonts"))) {
    copyIntoDist("assets/fonts/" + file);
  }
  for (const file of fs.readdirSync(path.join(ROOT, "assets/icons"))) {
    copyIntoDist("assets/icons/" + file);
  }

  /* Copy site assets. web-shim.js gets the real manifest name and
   * version injected in place of its placeholder tokens. */
  copyFile(path.join(SRC, "assets/site.css"), path.join(DIST, "site/site.css"));
  copyFile(path.join(SRC, "assets/site.js"), path.join(DIST, "site/site.js"));
  copyFile(
    path.join(SRC, "assets/web-boot.js"),
    path.join(DIST, "site/web-boot.js")
  );
  const shim = fs
    .readFileSync(path.join(SRC, "assets/web-shim.js"), "utf8")
    .split("__ZASE_MANIFEST_NAME__")
    .join(manifest.name)
    .split("__ZASE_MANIFEST_VERSION__")
    .join(manifest.version);
  fs.writeFileSync(path.join(DIST, "site/web-shim.js"), shim);

  /* Card renderer shared by home grid and related rows. */
  const cardTpl = readTemplate("tool-card.html");
  const renderCard = (tool, prefix) =>
    fill(cardTpl, {
      PREFIX: prefix,
      SLUG: tool.slug,
      CAT_SLUG: tool.catSlug,
      ICON_SVG: iconSvg(tool.icon),
      NAME: esc(tool.name),
      DESCRIPTION: esc(tool.description),
      SEARCH_TEXT: escAttr(
        (tool.name + " " + tool.description + " " + (tool.keywords || "") + " " + tool.category).toLowerCase()
      ),
    });

  /* ---- Home ---- */
  const sectionTpl = readTemplate("category-section.html");
  const sectionsHtml = categories
    .map((cat) =>
      fill(sectionTpl, {
        CAT_SLUG: cat.slug,
        CATEGORY: esc(cat.name),
        CARDS: cat.tools.map((t) => renderCard(t, "")).join("\n"),
      })
    )
    .join("\n");

  const homeBody = fill(readTemplate("home.html"), {
    STORE_URL,
    CATEGORY_SECTIONS: sectionsHtml,
  });
  fs.writeFileSync(
    path.join(DIST, "index.html"),
    renderPage({
      prefix: "",
      title: "Zase: Free Online Developer Tools (JSON, JWT, Regex and More)",
      description:
        "Free online developer tools by Zase: JSON formatter, JWT decoder and signer, regex tester, Base64, YAML and XML formatters, hash and password generators, QR codes and more. Everything runs in your browser: nothing is uploaded, tracked, or stored on a server.",
      canonical: BASE_URL + "/",
      body: homeBody,
    })
  );

  /* ---- One page per tool ---- */
  const relatedTpl = readTemplate("related-section.html");
  const toolTpl = readTemplate("tool.html");
  for (const tool of tools) {
    const prefix = "../";
    const related = tools
      .filter((t) => t.category === tool.category && t.id !== tool.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 4);
    const relatedHtml = related.length
      ? fill(relatedTpl, {
          CARDS: related.map((t) => renderCard(t, prefix)).join("\n"),
        })
      : "";

    const desc = String(tool.description || "").replace(/\.\s*$/, "");
    const body = fill(toolTpl, {
      PREFIX: prefix,
      CAT_SLUG: tool.catSlug,
      CATEGORY: esc(tool.category),
      NAME: esc(tool.name),
      LONG_DESCRIPTION:
        esc(desc) +
        ". Runs 100% in your browser: nothing you type or paste is uploaded, tracked, or sent to a server.",
      TOOL_ID: escAttr(tool.id),
      STORE_URL,
      RELATED_SECTION: relatedHtml,
    });

    const scripts = ["site/web-shim.js"]
      .concat(RUNTIME_JS)
      .concat(["js/tools/" + tool.id + ".js", "site/web-boot.js"]);

    const page = renderPage({
      prefix,
      title: tool.name + " Online | Zase Developer Tools",
      description:
        tool.name +
        ": " +
        desc +
        ". Free online tool by Zase that runs 100% in your browser: no sign up, no uploads, nothing leaves your device.",
      canonical: BASE_URL + "/" + tool.slug + "/",
      body,
      extraCss: cssLinks(prefix, [
        "css/components.css",
        "css/tools/_shared.css",
        "css/tools/" + tool.id + ".css",
      ]),
      extraScripts: scriptTags(prefix, scripts),
    });

    const dir = path.join(DIST, tool.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), page);
  }

  /* ---- About + Privacy ---- */
  const staticPages = [
    {
      slug: "about",
      title: "About | Zase Developer Tools",
      description:
        "About Zase: the free developer toolkit that runs entirely in your browser, with no accounts, no tracking, and no uploads. Also available as a Chrome extension.",
      template: "about.html",
    },
    {
      slug: "privacy",
      title: "Privacy Policy | Zase Developer Tools",
      description:
        "Zase privacy policy: everything runs locally in your browser. No analytics, no tracking, no accounts, no cookies, and no data ever leaves your device.",
      template: "privacy.html",
    },
  ];
  for (const p of staticPages) {
    const body = fill(readTemplate(p.template), {
      PREFIX: "../",
      STORE_URL,
      GITHUB_URL,
    });
    const dir = path.join(DIST, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      renderPage({
        prefix: "../",
        title: p.title,
        description: p.description,
        canonical: BASE_URL + "/" + p.slug + "/",
        body,
      })
    );
  }

  /* ---- 404 (root-absolute prefix: it can be served at any depth) ---- */
  const notFoundBody = fill(readTemplate("404.html"), { PREFIX: "/" });
  fs.writeFileSync(
    path.join(DIST, "404.html"),
    renderPage({
      prefix: "/",
      title: "Page not found | Zase Developer Tools",
      description: "The page you are looking for does not exist. Browse all free Zase developer tools on the home page.",
      canonical: BASE_URL + "/404.html",
      body: notFoundBody,
    })
  );

  /* ---- sitemap.xml + robots.txt ---- */
  const today = new Date().toISOString().slice(0, 10);
  const urls = [{ loc: BASE_URL + "/", priority: "1.0" }]
    .concat(
      tools.map((t) => ({
        loc: BASE_URL + "/" + t.slug + "/",
        priority: "0.8",
      }))
    )
    .concat([
      { loc: BASE_URL + "/about/", priority: "0.5" },
      { loc: BASE_URL + "/privacy/", priority: "0.3" },
    ]);
  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          "  <url><loc>" +
          u.loc +
          "</loc><lastmod>" +
          today +
          "</lastmod><priority>" +
          u.priority +
          "</priority></url>"
      )
      .join("\n") +
    "\n</urlset>\n";
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap);
  fs.writeFileSync(
    path.join(DIST, "robots.txt"),
    "User-agent: *\nAllow: /\n\nSitemap: " + BASE_URL + "/sitemap.xml\n"
  );

  console.log(
    "[build] Done: " +
      tools.length +
      " tool pages, home, about, privacy, 404, sitemap (" +
      urls.length +
      " URLs), robots.txt"
  );
}

main();
