/**
 * DeepSeek Harness Desktop — Preload Script
 *
 * Exposes a minimal, typed DesktopApi to the renderer process via IPC.
 * No Node.js APIs are exposed; only allowlisted channels are forwarded.
 */

import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS, type DiagnosticBundle, type DesktopApi, type RuntimeStatus, type WorkspaceSummary } from "../shared/ipc.js";

const api: DesktopApi = {
  getRuntimeStatus: () =>
    ipcRenderer.invoke(IPC_CHANNELS.getRuntimeStatus),
  restartRuntime: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.restartRuntime);
    return result as RuntimeStatus;
  },
  selectWorkspace: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.selectWorkspace);
    return result as WorkspaceSummary | null;
  },
  listRecentWorkspaces: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.listRecentWorkspaces);
    return result as WorkspaceSummary[];
  },
  openLogs: () => ipcRenderer.invoke(IPC_CHANNELS.openLogs),
  copyDiagnostics: async () => {
    const result = await ipcRenderer.invoke(IPC_CHANNELS.copyDiagnostics);
    return result as DiagnosticBundle;
  },
  quit: () => ipcRenderer.invoke(IPC_CHANNELS.quit),
};

contextBridge.exposeInMainWorld("desktopApi", api);

// Forward runtime-status events from main process to renderer
ipcRenderer.on("runtime-status", (_event, status: unknown) => {
  const win = globalThis as unknown as { onRuntimeStatus?: (s: RuntimeStatus) => void };
  if (typeof win.onRuntimeStatus === "function") {
    win.onRuntimeStatus(status as RuntimeStatus);
  }
});
