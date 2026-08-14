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
  assert.deepEqual(manifest.volta, {
    node: "22.20.0",
    pnpm: "10.15.0",
  });
});

test("Node and web TypeScript projects use strict compiler settings and share IPC contracts", async () => {
  const rootConfig = await readJson("tsconfig.json");
  const nodeConfig = await readJson("tsconfig.node.json");
  const webConfig = await readJson("tsconfig.web.json");
  const toolingConfig = await readJson("tsconfig.tooling.json");

  assert.equal(rootConfig.compilerOptions?.strict, true);
  assert.equal(nodeConfig.compilerOptions?.strict, true);
  assert.equal(webConfig.compilerOptions?.strict, true);
  assert.equal(toolingConfig.compilerOptions?.strict, true);
  // Node and web configs have different includes (Node has main/preload, web has renderer)
  assert.notDeepEqual(nodeConfig.include, webConfig.include);
  // Root references are node, web, and tooling only (no shared project)
  assert.deepEqual(rootConfig.references, [
    { path: "./tsconfig.node.json" },
    { path: "./tsconfig.web.json" },
    { path: "./tsconfig.tooling.json" },
  ]);
  // Both node and web include shared sources directly
  assert.deepEqual(
    nodeConfig.include.filter((p) => p.includes("shared")),
    ["src/shared/**/*.ts"],
  );
  assert.deepEqual(
    webConfig.include.filter((p) => p.includes("shared")),
    ["src/shared/**/*.ts"],
  );
  // Shared files must be excluded from test inclusion
  assert.equal(webConfig.exclude?.includes("src/shared/**/*.test.ts"), true);
});

test("Electron production emit excludes Vite and Vitest tooling configuration", async () => {
  const nodeConfig = await readJson("tsconfig.node.json");
  const toolingConfig = await readJson("tsconfig.tooling.json");

  assert.equal(nodeConfig.include.includes("vite.config.ts"), false);
  assert.equal(nodeConfig.include.includes("vitest.config.ts"), false);
  assert.deepEqual(toolingConfig.include, [
    "vite.config.ts",
    "vitest.config.ts",
  ]);
  assert.equal(toolingConfig.compilerOptions?.noEmit, true);
  assert.equal(
    await readFile(new URL("../.node-version", import.meta.url), "utf8"),
    "22.20.0\n",
  );
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
