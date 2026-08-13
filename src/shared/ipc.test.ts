import { describe, expect, it } from "vitest";

import { IPC_CHANNELS } from "./ipc.js";
import type {
  DesktopApi,
  DiagnosticBundle,
  RuntimeError,
  RuntimeStatus,
  WorkspaceSummary,
} from "./ipc.js";

describe("shared IPC contract", () => {
  it("defines the allowlisted Desktop API surface", () => {
    const api: Pick<
      DesktopApi,
      | "getRuntimeStatus"
      | "restartRuntime"
      | "selectWorkspace"
      | "listRecentWorkspaces"
      | "openLogs"
      | "copyDiagnostics"
      | "quit"
    > = {
      getRuntimeStatus: async () => idleStatus,
      restartRuntime: async () => readyStatus,
      selectWorkspace: async () => workspace,
      listRecentWorkspaces: async () => [workspace],
      openLogs: async () => undefined,
      copyDiagnostics: async () => diagnostics,
      quit: async () => undefined,
    };

    expect(Object.keys(api)).toEqual([
      "getRuntimeStatus",
      "restartRuntime",
      "selectWorkspace",
      "listRecentWorkspaces",
      "openLogs",
      "copyDiagnostics",
      "quit",
    ]);
    expect(IPC_CHANNELS.restartRuntime).toBe("desktop:restart-runtime");
  });

  it("models runtime status and error states as discriminated unions", () => {
    const errors: RuntimeError[] = [
      {
        kind: "runtime-error",
        code: "launch-failed",
        message: "Unable to launch.",
      },
      { kind: "runtime-error", code: "timeout", message: "Timed out." },
      {
        kind: "runtime-error",
        code: "unexpected-exit",
        message: "Process exited.",
        exitCode: 1,
      },
      {
        kind: "runtime-error",
        code: "crash-loop",
        message: "Restart limit reached.",
        recoverable: true,
      },
    ];

    expect(errors.map((error) => error.code)).toEqual([
      "launch-failed",
      "timeout",
      "unexpected-exit",
      "crash-loop",
    ]);
  });
});

const idleStatus: RuntimeStatus = {
  kind: "runtime-status",
  state: "idle",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

const readyStatus: RuntimeStatus = {
  kind: "runtime-status",
  state: "ready",
  updatedAt: "2026-08-13T00:00:00.000Z",
  url: "http://127.0.0.1:12345",
  pid: 12345,
};

const workspace: WorkspaceSummary = {
  kind: "workspace",
  path: "/tmp/workspace",
  name: "workspace",
  lastOpenedAt: "2026-08-13T00:00:00.000Z",
};

const diagnostics: DiagnosticBundle = {
  kind: "diagnostic-bundle",
  createdAt: "2026-08-13T00:00:00.000Z",
  appVersion: "0.1.0",
  platform: "darwin",
  runtime: idleStatus,
  recentErrors: [],
  logs: [],
};
