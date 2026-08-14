/**
 * prepare-harness-runtime.mjs
 *
 * Prepares the pinned DeepSeek Harness runtime for packaging.
 * Downloads the official CLI package and places it under resources/harness/.
 * This script runs during CI builds and is optional for local development.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync, readdirSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Pin to a known-good version — update this when bumping upstream
const DSH_VERSION = "0.3.0";
const HARNESS_RESOURCES_DIR = path.join(root, "resources", "harness");

async function main() {
  console.log(`[prepare] Preparing DeepSeek Harness runtime v${DSH_VERSION}`);

  // Clean previous harness resources
  if (existsSync(HARNESS_RESOURCES_DIR)) {
    rmSync(HARNESS_RESOURCES_DIR, { recursive: true, force: true });
  }
  mkdirSync(HARNESS_RESOURCES_DIR, { recursive: true });

  // Install harness CLI to a temp directory
  const tmpDir = path.join(root, ".tmp-harness-install");
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  mkdirSync(tmpDir, { recursive: true });

  try {
    console.log("[prepare] Installing @deepseek-ai/dsh...");
    execSync(
      `pnpm add @deepseek-ai/dsh@${DSH_VERSION} --prefix "${tmpDir}" --prod --silent`,
      { cwd: root, stdio: "inherit" },
    );

    // Copy harness CLI files into resources
    const srcDir = path.join(tmpDir, "node_modules", "@deepseek-ai", "dsh");
    if (existsSync(srcDir)) {
      copyRecursive(srcDir, HARNESS_RESOURCES_DIR);
      console.log(`[prepare] Copied harness to ${HARNESS_RESOURCES_DIR}`);
    } else {
      console.warn("[prepare] Warning: @deepseek-ai/dsh not found at expected path");
    }
  } finally {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log("[prepare] Harness runtime preparation complete.");
}

function copyRecursive(src, dest) {
  const stats = statSync(src);
  if (stats.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

main().catch((err) => {
  console.error("[prepare] Failed:", err.message);
  process.exit(1);
});
