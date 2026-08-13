import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import test from "node:test";

const mainEntrypoint = new URL("../dist/main/main/index.js", import.meta.url);
const sharedIpcModule = new URL("../dist/main/shared/ipc.js", import.meta.url);

test("Electron output emits the shared IPC module at the main-process relative-import path", async () => {
  await access(sharedIpcModule, constants.R_OK);

  const source = await readFile(
    new URL("../src/shared/ipc.ts", import.meta.url),
    "utf8",
  );
  const emittedModule = await readFile(sharedIpcModule, "utf8");

  assert.match(source, /export const IPC_CHANNELS/);
  assert.match(emittedModule, /export const IPC_CHANNELS/);
  assert.equal(
    path.resolve(new URL("../shared/ipc.js", mainEntrypoint).pathname),
    path.resolve(sharedIpcModule.pathname),
  );
});
