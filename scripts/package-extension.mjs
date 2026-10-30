/**
 * File: scripts/package-extension.mjs
 * Purpose: Build the Chrome Web Store upload zip for the extension.
 *
 * The zip is assembled from a fixed WHITELIST of extension runtime
 * paths only. The website (site/), docs, tests, and tooling can
 * therefore never leak into the store package, no matter what else
 * lands in the repo.
 *
 * Output: ~/workspace/developer-toolkit-v<version>.zip
 *         (version read from manifest.json)
 * Usage:  node scripts/package-extension.mjs
 * Zero dependencies: uses Node built-ins plus the system `zip`.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "..");

/** The only paths allowed in the store zip. Nothing else, ever. */
const WHITELIST = [
  "manifest.json",
  "background.js",
  "LICENSE",
  "popup",
  "js",
  "css",
  "assets",
];

function main() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
  );
  const outFile = path.join(
    OUT_DIR,
    "developer-toolkit-v" + manifest.version + ".zip"
  );

  /* Sanity: every whitelist entry must exist before we zip. */
  for (const entry of WHITELIST) {
    if (!fs.existsSync(path.join(ROOT, entry))) {
      throw new Error("Whitelist entry missing from repo: " + entry);
    }
  }

  fs.rmSync(outFile, { force: true });

  /* -r recurse, -q quiet, -X strip extra file attributes so the
   * archive only carries the files themselves. */
  execFileSync("zip", ["-r", "-q", "-X", outFile].concat(WHITELIST), {
    cwd: ROOT,
    stdio: "inherit",
  });

  const listing = execFileSync("unzip", ["-Z1", outFile], {
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);

  /* Hard guard: fail loudly if anything outside the whitelist
   * somehow got in (a future edit must never weaken this). */
  const offenders = listing.filter((entry) => {
    const top = entry.split("/")[0];
    return !WHITELIST.includes(top);
  });
  if (offenders.length) {
    fs.rmSync(outFile, { force: true });
    throw new Error(
      "Non-whitelist entries found in zip, package deleted: " +
        offenders.join(", ")
    );
  }

  const sizeKb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(
    "[package] " +
      outFile.replace(os.homedir(), "~") +
      ": " +
      listing.length +
      " entries, " +
      sizeKb +
      " KB, manifest " +
      manifest.version +
      " (" +
      manifest.name +
      ")"
  );
}

main();
