/**
 * DeepSeek Harness Desktop — Main Process
 *
 * Simple Electron shell that launches dsh web and loads its UI.
 */

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn, ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";

import { resolvePlatformPaths, type Platform } from "../shared/platform-paths.js";
import { IPC_CHANNELS, type DiagnosticBundle, type RuntimeError, type RuntimeStatus, type WorkspaceSummary } from "../shared/ipc.js";

const require = createRequire(import.meta.url);
const pkg = require(path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "..", "..", "..",
  "package.json",
)) as { version: string };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let harnessProcess: ChildProcess | null = null;
let currentPort = 0;
const logBuffer: string[] = [];
const MAX_LOG_LINES = 300;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlatform(): Platform {
  const p = process.platform;
  if (p === "darwin" || p === "win32" || p === "linux") return p as Platform;
  throw new Error(`Unsupported platform: ${p}`);
}

function getPaths() {
  const platform = getPlatform();
  const appDataRoot = app.getPath("appData");
  const homeDir = app.getPath("home");
  return resolvePlatformPaths(appDataRoot, platform, homeDir);
}

function ensureDirectory(dir: string): void {
  try { mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
}

function appendLog(message: string): void {
  logBuffer.push(message);
  while (logBuffer.length > MAX_LOG_LINES) logBuffer.shift();
}

function sendToRenderer(channel: string, data: unknown): void {
  mainWindow?.webContents.send(channel, data);
}

function buildStatus(state: RuntimeStatus["state"], extra?: Record<string, unknown>): RuntimeStatus {
  return {
    kind: "runtime-status",
    state,
    updatedAt: new Date().toISOString(),
    ...extra,
  } as RuntimeStatus;
}

function makeError(code: RuntimeError["code"], message: string, extra?: Partial<RuntimeError>): RuntimeError {
  return { kind: "runtime-error", code, message, ...extra } as RuntimeError;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = require("node:http").createServer();
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Harness Lifecycle
// ---------------------------------------------------------------------------

async function startHarness(): Promise<RuntimeStatus> {
  if (harnessProcess) return buildStatus("ready", { url: `http://127.0.0.1:${currentPort}`, pid: harnessProcess.pid });

  // Stop any previous instance
  if (harnessProcess) await stopHarness();

  const paths = getPaths();
  ensureDirectory(paths.harnessHome);
  ensureDirectory(paths.logs);

  const port = await freePort();
  currentPort = port;

  appendLog(`Starting dsh web on port ${port}`);
  sendToRenderer("runtime-status", buildStatus("starting", { message: `Starting Harness on port ${port}…` }));

  const env = {
    ...process.env,
    DSH_HOME: paths.harnessHome,
    PORT: String(port),
    NODE_ENV: "production",
  };

  harnessProcess = spawn("dsh", ["web", "--port", String(port)], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  harnessProcess.stdout?.on("data", (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) appendLog(line);
  });
  harnessProcess.stderr?.on("data", (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) appendLog(line);
  });

  harnessProcess.on("close", (code, signal) => {
    appendLog(`Harness exited: code=${code} signal=${signal}`);
    harnessProcess = null;
    currentPort = 0;
    if (mainWindow) {
      sendToRenderer("runtime-status", buildStatus("idle"));
    }
  });

  harnessProcess.on("error", (err: Error) => {
    appendLog(`Harness error: ${err.message}`);
    harnessProcess = null;
    currentPort = 0;
    sendToRenderer("runtime-status", buildStatus("error", { error: makeError("launch-failed", `Failed to start Harness: ${err.message}`) }));
  });

  // Wait for server to be ready
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        appendLog(`Harness ready on port ${port}`);
        sendToRenderer("runtime-status", buildStatus("ready", { url: `http://127.0.0.1:${port}`, pid: harnessProcess!.pid }));
        return buildStatus("ready", { url: `http://127.0.0.1:${port}`, pid: harnessProcess.pid });
      }
    } catch { /* try again */ }
    await delay(500);
  }

  const err = makeError("timeout", `Harness did not start within 30s`);
  sendToRenderer("runtime-status", buildStatus("error", { error: err }));
  return buildStatus("error", { error: err });
}

async function stopHarness(): Promise<void> {
  if (!harnessProcess) return;
  appendLog("Stopping Harness…");
  harnessProcess.kill("SIGTERM");
  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        harnessProcess!.once("exit", () => resolve());
        setTimeout(() => resolve(), 5000);
      }),
      delay(5000),
    ]);
  } finally {
    if (!harnessProcess!.killed) harnessProcess!.kill("SIGKILL");
    harnessProcess = null;
    currentPort = 0;
  }
}

// ---------------------------------------------------------------------------
// Workspace Persistence
// ---------------------------------------------------------------------------

const RECENT_FILE = "recent-workspaces.json";

function recentWorkspacesPath(paths: ReturnType<typeof getPaths>) {
  return path.join(paths.appData, RECENT_FILE);
}

async function loadRecentWorkspaces(): Promise<WorkspaceSummary[]> {
  try {
    const raw = await import("node:fs/promises").then((fs) => fs.readFile(recentWorkspacesPath(getPaths()), "utf8"));
    return JSON.parse(raw) as WorkspaceSummary[];
  } catch { return []; }
}

async function saveRecentWorkspaces(workspaces: WorkspaceSummary[]): Promise<void> {
  const sorted = workspaces.slice(0, 10);
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(recentWorkspacesPath(getPaths()), JSON.stringify(sorted, null, 2))
  );
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getRuntimeStatus, async () => {
    if (!harnessProcess) return buildStatus("idle");
    return buildStatus("ready", { url: `http://127.0.0.1:${currentPort}`, pid: harnessProcess.pid });
  });

  ipcMain.handle(IPC_CHANNELS.restartRuntime, async () => {
    await stopHarness();
    return startHarness();
  });

  ipcMain.handle(IPC_CHANNELS.selectWorkspace, async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ["openDirectory", "createDirectory"],
      title: "Select or Create Workspace",
    });
    if (result?.canceled || !result?.filePaths[0]) return null;
    const dir = result.filePaths[0];
    const name = path.basename(dir);
    const ws: WorkspaceSummary = { kind: "workspace", path: dir, name, lastOpenedAt: new Date().toISOString() };
    const list = await loadRecentWorkspaces();
    const filtered = list.filter((w) => w.path !== dir);
    await saveRecentWorkspaces([ws, ...filtered]);
    return ws;
  });

  ipcMain.handle(IPC_CHANNELS.listRecentWorkspaces, async () => loadRecentWorkspaces());

  ipcMain.handle(IPC_CHANNELS.openLogs, async () => {
    const paths = getPaths();
    ensureDirectory(paths.logs);
    shell.openPath(paths.logs);
  });

  ipcMain.handle(IPC_CHANNELS.copyDiagnostics, async () => {
    const bundle: DiagnosticBundle = {
      kind: "diagnostic-bundle",
      createdAt: new Date().toISOString(),
      appVersion: pkg.version,
      platform: process.platform,
      runtime: harnessProcess ? buildStatus("ready", { url: `http://127.0.0.1:${currentPort}`, pid: harnessProcess.pid }) : buildStatus("idle"),
      recentErrors: [],
      logs: logBuffer.slice(-MAX_LOG_LINES),
    };
    const { clipboard } = require("electron") as typeof import("electron");
    clipboard.writeText(JSON.stringify(bundle, null, 2));
    return bundle;
  });

  ipcMain.handle(IPC_CHANNELS.quit, async () => {
    await stopHarness();
    app.quit();
  });
}

// ---------------------------------------------------------------------------
// Window & Menu
// ---------------------------------------------------------------------------

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "DeepSeek Harness",
    backgroundColor: "#0f172a",
    trafficLightPosition: { x: 12, y: 12 },
    webPreferences: {
      preload: path.join(import.meta.dirname, "..", "preload", "index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1:")) return { action: "allow" };
    if (url.startsWith("https://")) { shell.openExternal(url); return { action: "deny" }; }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (_event, url) => {
    if (!url.startsWith("http://127.0.0.1:")) _event.preventDefault();
  });

  return win;
}

function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "New Window", accelerator: "CmdOrCtrl+N", click: () => createWindow() },
        { type: "separator" },
        { label: "Restart Harness", accelerator: "CmdOrCtrl+R", click: async () => {
          await stopHarness();
          const status = await startHarness();
          if (status.state === "ready" && mainWindow) mainWindow.loadURL(status.url!);
        }},
        { type: "separator" },
        { label: "Quit", accelerator: "CmdOrCtrl+Q", click: () => { app.quit(); } },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+Shift+R", click: () => mainWindow?.reload() },
        { label: "Toggle DevTools", accelerator: "Alt+CmdOrCtrl+I", click: () => mainWindow?.webContents.openDevTools() },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "GitHub Repository",
          click: () => shell.openExternal("https://github.com/deepseek-ai/deepseek-harness"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// App Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  await app.whenReady();

  const paths = getPaths();
  ensureDirectory(paths.harnessHome);
  ensureDirectory(paths.logs);

  createMenu();
  mainWindow = createWindow();
  registerHandlers();

  // Load renderer first, then start harness in background
  const indexPath = path.join(import.meta.dirname, "..", "renderer", "index.html");
  mainWindow.loadFile(indexPath);

  // Start harness after a brief delay to let renderer initialize
  setTimeout(async () => {
    const status = await startHarness();
    sendToRenderer("runtime-status", status);
    if (status.state === "ready" && status.url) {
      mainWindow?.loadURL(status.url);
    }
  }, 500);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on("window-all-closed", () => {
    stopHarness().catch(() => undefined);
    if (process.platform !== "darwin") app.quit();
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  app.quit();
});
