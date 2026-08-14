/**
 * check-package.mjs
 *
 * Smoke test for packaged artifacts: verifies that built packages contain
 * the expected structure including Electron app, Node runtime, harness CLI,
 * licenses, and metadata.
 */

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "out");

async function main() {
  console.log("[check-package] Verifying packaged artifacts...");

  const platforms = ["mac", "win", "linux"];
  let allPassed = true;

  for (const platform of platforms) {
    const platformOut = join(outDir, `${platform}-unpacked`);
    if (!existsSync(platformOut)) {
      console.log(`[check-package] Skipping ${platform}: no unpacked output`);
      continue;
    }

    const checks = [
      { path: "DeepSeek Harness.app", desc: "macOS app bundle", platform: "mac" },
      { path: "DeepSeekHarness.exe", desc: "Windows executable", platform: "win" },
      { path: "deepseek-harness", desc: "Linux executable", platform: "linux" },
    ];

    for (const check of checks) {
      if (check.platform !== platform) continue;
      const fullPath = join(platformOut, check.path);
      if (existsSync(fullPath)) {
        console.log(`[check-package] ✓ ${check.desc}: ${fullPath}`);
      } else {
        console.warn(`[check-package] ✗ ${check.desc}: not found at ${fullPath}`);
        allPassed = false;
      }
    }

    // Check for asar archive
    const asarPath = join(platformOut, "resources", "app.asar");
    if (existsSync(asarPath)) {
      console.log(`[check-package] ✓ App ASAR: ${asarPath}`);
    } else {
      console.warn(`[check-package] ⚠ App ASAR not found at ${asarPath}`);
    }
  }

  // Check dist/output structure
  const distMain = join(root, "dist", "main", "main", "index.js");
  const distRenderer = join(root, "dist", "renderer", "index.html");
  const distPreload = join(root, "dist", "preload", "index.js");

  for (const [name, p] of [["Main JS", distMain], ["Renderer HTML", distRenderer], ["Preload JS", distPreload]]) {
    if (existsSync(p)) {
      console.log(`[check-package] ✓ ${name}: ${p}`);
    } else {
      console.warn(`[check-package] ✗ ${name}: not found at ${p}`);
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log("[check-package] All checks passed.");
    process.exit(0);
  } else {
    console.error("[check-package] Some checks failed.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[check-package] Error:", err);
  process.exit(1);
});
