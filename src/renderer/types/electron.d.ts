/**
 * Type declarations for the Electron preload-exposed DesktopApi.
 * Declared here so the renderer can access window.desktopApi with full types.
 */

import type { DiagnosticBundle, RuntimeStatus, WorkspaceSummary } from "../shared/ipc.js";

export interface DesktopApi {
  getRuntimeStatus(): Promise<RuntimeStatus>;
  restartRuntime(): Promise<RuntimeStatus>;
  selectWorkspace(): Promise<WorkspaceSummary | null>;
  listRecentWorkspaces(): Promise<WorkspaceSummary[]>;
  openLogs(): Promise<void>;
  copyDiagnostics(): Promise<DiagnosticBundle>;
  quit(): Promise<void>;
}

export interface WindowWithDesktopApi extends Window {
  desktopApi: DesktopApi;
  onRuntimeStatus?: (status: RuntimeStatus) => void;
}
