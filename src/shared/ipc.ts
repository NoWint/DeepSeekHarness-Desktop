export const IPC_CHANNELS = {
  getRuntimeStatus: "desktop:get-runtime-status",
  restartRuntime: "desktop:restart-runtime",
  selectWorkspace: "desktop:select-workspace",
  listRecentWorkspaces: "desktop:list-recent-workspaces",
  openLogs: "desktop:open-logs",
  copyDiagnostics: "desktop:copy-diagnostics",
  quit: "desktop:quit",
} as const;

export type RuntimeError =
  | {
      kind: "runtime-error";
      code: "launch-failed";
      message: string;
      cause?: string;
    }
  | {
      kind: "runtime-error";
      code:
        | "timeout"
        | "connection-refused"
        | "invalid-response"
        | "token-mismatch";
      message: string;
    }
  | {
      kind: "runtime-error";
      code: "unexpected-exit";
      message: string;
      exitCode: number | null;
    }
  | {
      kind: "runtime-error";
      code: "crash-loop" | "port-unavailable" | "configuration-invalid";
      message: string;
      recoverable: boolean;
    };

export type WorkspaceSummary = {
  kind: "workspace";
  path: string;
  name: string;
  lastOpenedAt: string;
};

export type RuntimeStatus =
  | {
      kind: "runtime-status";
      state: "idle";
      updatedAt: string;
    }
  | {
      kind: "runtime-status";
      state: "starting" | "stopping";
      updatedAt: string;
      attempt: number;
      message: string;
    }
  | {
      kind: "runtime-status";
      state: "ready";
      updatedAt: string;
      url: string;
      pid: number;
    }
  | {
      kind: "runtime-status";
      state: "error";
      updatedAt: string;
      error: RuntimeError;
    };

export type DiagnosticBundle = {
  kind: "diagnostic-bundle";
  createdAt: string;
  appVersion: string;
  platform: string;
  runtime: RuntimeStatus;
  recentErrors: RuntimeError[];
  logs: string[];
};

export interface DesktopApi {
  getRuntimeStatus(): Promise<RuntimeStatus>;
  restartRuntime(): Promise<RuntimeStatus>;
  selectWorkspace(): Promise<WorkspaceSummary | null>;
  listRecentWorkspaces(): Promise<WorkspaceSummary[]>;
  openLogs(): Promise<void>;
  copyDiagnostics(): Promise<DiagnosticBundle>;
  quit(): Promise<void>;
}

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
