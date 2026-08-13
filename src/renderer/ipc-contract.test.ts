import { expect, it } from "vitest";

import { IPC_CHANNELS } from "../shared/ipc.js";
import type { DesktopApi } from "../shared/ipc.js";

it("allows renderer code to import the shared desktop IPC contract", () => {
  const api: Partial<DesktopApi> = {
    getRuntimeStatus: async () => ({
      kind: "runtime-status",
      state: "idle",
      updatedAt: "2026-08-13T00:00:00.000Z",
    }),
  };

  expect(api.getRuntimeStatus).toBeTypeOf("function");
  expect(IPC_CHANNELS.getRuntimeStatus).toBe("desktop:get-runtime-status");
});
