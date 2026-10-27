/**
 * File: tests/smoke.js
 * Purpose: Rendered smoke tests for the whole extension, run in jsdom.
 *
 * Usage:
 *   npm install   (once; installs jsdom, a dev-only dependency)
 *   npm test
 *
 * What it proves:
 *   - The app boots, the sidebar shell renders, every registered
 *     tool mounts without throwing, and the home grid lists them.
 *   - Known-answer checks for the tools with famous vectors
 *     (Hash MD5, JSON sort keys, Cron builder, QR SVG output).
 *   - manifest.json parses, declares the Phase 3 integrations, and
 *     the footer version matches the manifest version.
 *
 * What it cannot prove: real Chrome visuals, the EyeDropper API,
 * clipboard permission behavior, side panel and context menu
 * behavior inside Chrome. Those stay on the manual QA list.
 */

"use strict";

const fs = require("fs");
const path = require("path");

let JSDOM;
try {
  JSDOM = require("jsdom").JSDOM;
} catch (e) {
  console.error("jsdom is not installed. Run: npm install");
  process.exit(2);
}
const { webcrypto } = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
const html = fs.readFileSync(path.join(ROOT, "popup/popup.html"), "utf8");

let pass = 0;
let fail = 0;
const failed = [];
function check(name, cond) {
  if (cond) pass++;
  else {
    fail++;
    failed.push(name);
  }
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms || 40));

async function main() {
  /* --- Manifest shape --- */
  check("manifest is MV3", manifest.manifest_version === 3);
  check("manifest has side_panel", !!manifest.side_panel);
  check("manifest omnibox keyword dt", manifest.omnibox && manifest.omnibox.keyword === "dt");
  check("manifest command open-toolkit", !!manifest.commands && !!manifest.commands["open-toolkit"]);
  check(
    "manifest permissions include contextMenus + sidePanel",
    manifest.permissions.includes("contextMenus") && manifest.permissions.includes("sidePanel"),
  );

  /* --- Boot the app in jsdom --- */
  const dom = new JSDOM(html, {
    url: "https://extension.local/popup/popup.html",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const store = {};
  window.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {};
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => {
            if (store[k] !== undefined) out[k] = store[k];
          });
          setTimeout(() => cb && cb(out), 0);
        },
        set: (obj, cb) => { Object.assign(store, obj); setTimeout(() => cb && cb(), 0); },
        remove: (keys, cb) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
          setTimeout(() => cb && cb(), 0);
        },
      },
      onChanged: { addListener: () => {} },
    },
    runtime: { getManifest: () => ({ version: manifest.version }) },
    tabs: { create: () => {} },
  };
  Object.defineProperty(window, "crypto", { value: webcrypto });
  window.matchMedia = (q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
  });
  window.HTMLElement.prototype.scrollIntoView = function () {};
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: async () => {}, readText: async () => "pasted!" },
    configurable: true,
  });

  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const src of srcs) {
    window.eval(fs.readFileSync(path.join(ROOT, "popup", src), "utf8"));
  }
  await tick(200);

  const doc = window.document;
  check("sidebar shell renders", !!doc.querySelector(".dt-sidebar"));
  check("home grid lists all tools", doc.querySelectorAll(".dt-tool-card").length >= 31);
  check("footer version matches manifest", doc.body.textContent.includes(manifest.version));

  const ids = window.eval("DT.core.registry.all().map(t => t.id)");
  check("registry holds 31 tools", ids.length === 31);

  const errs = [];
  for (const id of ids) {
    try {
      window.eval("DT.core.router.go('tool', { toolId: '" + id + "' })");
      await tick(10);
      if (!doc.querySelector(".dt-workspace")) errs.push(id);
    } catch (e) {
      errs.push(id + ": " + e.message);
    }
  }
  check("all tools mount (" + errs.join(", ") + ")", errs.length === 0);

  const btnByText = (root, text) =>
    [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
  const setVal = (el, v, ev) => {
    el.value = v;
    el.dispatchEvent(new window.Event(ev || "input", { bubbles: true }));
  };
  const ws = () => doc.querySelector(".dt-workspace");

  /* --- Hash MD5 known vector --- */
  window.eval("DT.core.router.go('tool', { toolId: 'hash' })");
  await tick(20);
  setVal(ws().querySelector("#dt-hash-algo"), "MD5", "change");
  setVal(ws().querySelector("#dt-hash-input"), "abc");
  await tick(350);
  check(
    "hash MD5 of abc",
    ws().querySelector("#dt-hash-output").value === "900150983cd24fb0d6963f7d28e17f72",
  );

  /* --- JSON sort keys --- */
  window.eval("DT.core.router.go('tool', { toolId: 'json' })");
  await tick(20);
  setVal(ws().querySelector("#dt-json-input"), '{"b":1,"a":2}');
  btnByText(ws(), "Sort keys").click();
  await tick(10);
  const sorted = ws().querySelector("#dt-json-output").value;
  check("json sort keys", sorted.indexOf('"a"') < sorted.indexOf('"b"'));

  /* --- Cron builder --- */
  window.eval("DT.core.router.go('tool', { toolId: 'cron' })");
  await tick(20);
  setVal(ws().querySelector("#dt-cron-b-freq"), "weekly", "change");
  setVal(ws().querySelector("#dt-cron-b-dow"), "1", "change");
  setVal(ws().querySelector("#dt-cron-b-hour"), "9", "change");
  setVal(ws().querySelector("#dt-cron-b-minute"), "30", "change");
  check(
    "cron builder composes 30 9 * * 1",
    ws().querySelector("#dt-cron-input").value === "30 9 * * 1",
  );

  /* --- QR renders an SVG --- */
  window.eval("DT.core.router.go('tool', { toolId: 'qr' })");
  await tick(20);
  setVal(ws().querySelector("#dt-qr-input"), "HELLO");
  await tick(400);
  check("qr preview has svg", !!ws().querySelector("#dt-qr-preview svg"));

  console.log("SMOKE PASS " + pass + " FAIL " + fail);
  if (failed.length) console.log("FAILED: " + failed.join(" | "));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error("SMOKE ERROR", e);
  process.exit(2);
});
