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

  assert.equal(manifest.engines?.node, ">=22.20.0");
  assert.equal(manifest.packageManager, "pnpm@10.15.0");
  assert.equal(
    await readFile(new URL("../.node-version", import.meta.url), "utf8"),
    "22.20.0\n",
  );
});

test("Node and web TypeScript projects use strict compiler settings and share IPC contracts", async () => {
  const rootConfig = await readJson("tsconfig.json");
  const sharedConfig = await readJson("tsconfig.shared.json");
  const nodeConfig = await readJson("tsconfig.node.json");
  const webConfig = await readJson("tsconfig.web.json");

  assert.equal(rootConfig.compilerOptions?.strict, true);
  assert.equal(sharedConfig.compilerOptions?.strict, true);
  assert.equal(nodeConfig.compilerOptions?.strict, true);
  assert.equal(webConfig.compilerOptions?.strict, true);
  assert.notDeepEqual(nodeConfig.include, webConfig.include);
  assert.deepEqual(rootConfig.references, [
    { path: "./tsconfig.shared.json" },
    { path: "./tsconfig.node.json" },
    { path: "./tsconfig.web.json" },
    { path: "./tsconfig.tooling.json" },
  ]);
  assert.deepEqual(nodeConfig.references, [{ path: "./tsconfig.shared.json" }]);
  assert.deepEqual(webConfig.references, [{ path: "./tsconfig.shared.json" }]);
  assert.deepEqual(sharedConfig.include, ["src/shared/**/*.ts"]);
  assert.equal(nodeConfig.include.includes("src/shared/**/*.ts"), false);
  assert.equal(webConfig.include.includes("src/shared/**/*.ts"), false);
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
