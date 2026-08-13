import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function readJson(relativePath) {
  const contents = await readFile(new URL(relativePath, root), "utf8");
  return JSON.parse(contents);
}

test("package manifest exposes the shared project quality and packaging scripts", async () => {
  const manifest = await readJson("package.json");
  const requiredScripts = [
    "dev",
    "build",
    "typecheck",
    "lint",
    "format:check",
    "test",
    "package",
    "package:all",
    "prepare:harness",
    "verify:package",
  ];

  for (const script of requiredScripts) {
    assert.equal(
      typeof manifest.scripts?.[script],
      "string",
      `missing script: ${script}`,
    );
  }

  assert.equal(manifest.engines?.node, ">=22.19.0");
  assert.equal(manifest.packageManager, "pnpm@10.15.0");
});

test("Node and web TypeScript projects use strict compiler settings", async () => {
  const rootConfig = await readJson("tsconfig.json");
  const nodeConfig = await readJson("tsconfig.node.json");
  const webConfig = await readJson("tsconfig.web.json");

  assert.equal(rootConfig.compilerOptions?.strict, true);
  assert.equal(nodeConfig.compilerOptions?.strict, true);
  assert.equal(webConfig.compilerOptions?.strict, true);
  assert.notDeepEqual(nodeConfig.include, webConfig.include);
  assert.deepEqual(rootConfig.references, [
    { path: "./tsconfig.node.json" },
    { path: "./tsconfig.web.json" },
  ]);
});

test("Electron Builder declares macOS, Windows, and Linux release targets", async () => {
  const builderConfig = await readFile(
    new URL("../electron-builder.yml", import.meta.url),
    "utf8",
  );

  assert.match(builderConfig, /^mac:$/m);
  assert.match(builderConfig, /^win:$/m);
  assert.match(builderConfig, /^linux:$/m);
  assert.match(builderConfig, /target:.*dmg/);
  assert.match(builderConfig, /target:.*nsis/);
  assert.match(builderConfig, /target:.*AppImage/);
});
