/**
 * DeepSeek Harness Desktop — Main Process
 *
 * Electron main process that manages the Harness runtime lifecycle,
 * provides typed IPC handlers for the renderer, and configures native menus.
 */

import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  shell,
} from "electron";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";

import { redact } from "../shared/redaction.js";
import {
  IPC_CHANNELS,
  type DiagnosticBundle,
  type RuntimeError,
  type RuntimeStatus,
} from "../shared/ipc.js";
import { resolvePlatformPaths, type Platform } from "../shared/platform-paths.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let harnessProcess: ChildProcess | null = null;
let launchToken: string | null = null;
let currentPort: number | null = null;

const MAX_RECENT_WORKSPACES = 10;
const MAX_LOG_LINES = 300;
const healthCheckPollIntervalMs = 500;
const healthCheckMaxWaitMs = 30_000;
const gracefulShutdownTimeoutMs = 5_000;

const logBuffer: string[] = [];
const recentErrors: RuntimeError[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPlatform(): Platform {
  const raw = process.platform as string;
  if (raw === "darwin" || raw === "win32" || raw === "linux") return raw;
  throw new Error(`Unsupported platform: ${raw}`);
}

function getPaths() {
  const platform = getPlatform();
  const appDataRoot = app.getPath("appData");
  const homeDir = app.getPath("home");
  return resolvePlatformPaths(appDataRoot, platform, homeDir);
}

function ensureDirectory(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // Directory may already exist or be restricted
  }
}

function appendLog(message: string): void {
  logBuffer.push(message);
  while (logBuffer.length > MAX_LOG_LINES) {
    logBuffer.shift();
  }
}

function pushError(error: RuntimeError): void {
  recentErrors.unshift(error);
  while (recentErrors.length > 50) {
    recentErrors.pop();
  }
}

function makeRuntimeError(
  code: RuntimeError["code"],
  message: string,
  extra?: Omit<RuntimeError & { kind: "runtime-error" }, "kind" | "code" | "message">,
): RuntimeError {
  return {
    kind: "runtime-error",
    code,
    message,
    ...extra,
  } as RuntimeError;
}

function buildStatus(state: RuntimeStatus["state"]): RuntimeStatus {
  const base = { updatedAt: new Date().toISOString() } as const;

  switch (state) {
    case "idle":
      return { kind: "runtime-status", state: "idle", ...base };
    case "starting":
      return {
        kind: "runtime-status",
        state: "starting",
        ...base,
        attempt: 1,
        message: "Starting Harness runtime…",
      };
    case "ready":
      if (currentPort === null || launchToken === null) {
        throw new Error("Ready status requires port and token");
      }
      return {
        kind: "runtime-status",
        state: "ready",
        ...base,
        url: `http://127.0.0.1:${currentPort}/?token=${encodeURIComponent(launchToken)}`,
        pid: harnessProcess?.pid ?? 0,
      };
    case "stopping":
      return {
        kind: "runtime-status",
        state: "stopping",
        ...base,
        message: "Stopping Harness runtime…",
      };
    case "error": {
      const err = recentErrors[0];
      if (!err) throw new Error("Error status requires a recent error");
      return { kind: "runtime-status", state: "error", ...base, error: err };
    }
    default:
      throw new Error(`Unhandled runtime state: ${String(state)}`);
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    import("node:http").then(({ createServer }) => {
      const s = createServer(() => {});
      s.unref();
      s.on("error", reject);
      s.listen(0, "127.0.0.1", () => {
        const port = (s.address() as { port: number }).port;
        s.close(() => resolve(port));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Recent workspaces persistence
// ---------------------------------------------------------------------------

function loadRecentWorkspaces(): Set<string> {
  try {
    const paths = getPaths();
    ensureDirectory(paths.appData);
    const filePath = path.join(paths.appData, "recent-workspaces.json");
    if (!existsSync(filePath)) return new Set();
    const data = readFileSync(filePath, "utf8");
    const arr = JSON.parse(data) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveRecentWorkspaces(set: Set<string>): void {
  try {
    const paths = getPaths();
    ensureDirectory(paths.appData);
    const filePath = path.join(paths.appData, "recent-workspaces.json");
    writeFileSync(filePath, JSON.stringify(Array.from(set), null, 2));
  } catch {
    // silently ignore
  }
}

// ---------------------------------------------------------------------------
// Harness Runtime Management
// ---------------------------------------------------------------------------

async function startRuntime(forceRestart = false): Promise<RuntimeStatus> {
  if (harnessProcess && !forceRestart) {
    return buildStatus("ready");
  }

  if (harnessProcess) {
    await stopRuntime();
  }

  pushError(makeRuntimeError("launch-failed", "Harness runtime starting…"));
  const startingStatus = buildStatus("starting");
  sendToRenderer("runtime-status", startingStatus);

  const paths = getPaths();
  ensureDirectory(paths.harnessHome);
  ensureDirectory(paths.logs);

  launchToken = randomUUID();

  let port: number;
  try {
    port = await freePort();
  } catch {
    const err = makeRuntimeError(
      "port-unavailable",
      "Could not allocate a free loopback port.",
      { recoverable: true },
    );
    pushError(err);
    appendLog("Port allocation failed");
    return buildStatus("error");
  }
  currentPort = port;

  const harnessBin = resolveHarnessEntry(paths);
  const nodeBin = resolveNodeBinary(paths);
  const args = ["web"];
  const env = sanitizeEnvironment({
    ...process.env,
    DSH_HOME: paths.harnessHome,
    PORT: String(port),
    NODE_ENV: "production",
  });

  appendLog(`Launching harness: ${nodeBin} ${harnessBin} ${args.join(" ")} on port ${port}`);

  let child: ChildProcess;
  try {
    child = spawn(nodeBin, [harnessBin, ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    const err = makeRuntimeError(
      "launch-failed",
      `Failed to spawn Harness process: ${String(error)}`,
    );
    pushError(err);
    currentPort = null;
    launchToken = null;
    return buildStatus("error");
  }

  harnessProcess = child;

  child.stdout?.on("data", (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) appendLog(line);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const line = chunk.toString().trim();
    if (line) appendLog(line);
  });

  child.on("close", (exitCode, signal) => {
    appendLog(`Harness process exited: code=${exitCode} signal=${signal}`);
    const wasExpected = mainWindow === null;
    harnessProcess = null;
    currentPort = null;
    launchToken = null;

    if (wasExpected) return;

    const err = makeRuntimeError(
      "unexpected-exit",
      `Harness process exited unexpectedly: code=${exitCode}, signal=${signal}`,
      { exitCode, recoverable: true },
    );
    pushError(err);
    sendToRenderer("runtime-status", buildStatus("error"));
  });

  child.on("error", (error: Error) => {
    appendLog(`Harness process error: ${error.message}`);
    const err = makeRuntimeError(
      "launch-failed",
      `Harness process error: ${error.message}`,
    );
    pushError(err);
    sendToRenderer("runtime-status", buildStatus("error"));
  });

  await waitForHealth(port, launchToken);
  return buildStatus("ready");
}

function resolveHarnessEntry(paths: ReturnType<typeof getPaths>): string {
  const bundledCli = path.join(paths.appData, "harness", "bin.js");
  if (existsSync(bundledCli)) {
    return bundledCli;
  }
  // Development fallback: resolve from local workspace
  try {
    return require.resolve("@deepseek-ai/dsh/lib/bin.js", {
      paths: [import.meta.dirname],
    });
  } catch {
    return bundledCli;
  }
}

function resolveNodeBinary(paths: ReturnType<typeof getPaths>): string {
  const bundledNode = path.join(paths.appData, "node", "bin", "node");
  if (existsSync(bundledNode)) {
    return bundledNode;
  }
  return process.execPath;
}

function sanitizeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowedPrefixes = ["PATH", "HOME", "USERPROFILE", "APPDATA", "NODE_PATH", "DSH_"];
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env ?? {})) {
    if (value === undefined || value === null) continue;
    const upperKey = key.toUpperCase();
    const allowed = allowedPrefixes.some((prefix) => upperKey.startsWith(prefix));
    if (allowed) result[key] = value;
  }
  return result;
}

async function waitForHealth(port: number, token: string): Promise<void> {
  const deadline = Date.now() + healthCheckMaxWaitMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/?token=${encodeURIComponent(token)}`,
        { signal: AbortSignal.timeout(2000) },
      );

      if (!response.ok) {
        if (attempts % 20 === 0) {
          appendLog(`Health check attempt ${attempts}: HTTP ${response.status}`);
        }
        await delay(healthCheckPollIntervalMs);
        continue;
      }

      const body = await response.text();
      let data: { ok?: boolean; token?: string };
      try {
        data = JSON.parse(body);
      } catch {
        await delay(healthCheckPollIntervalMs);
        continue;
      }

      if (data.ok !== true) {
        await delay(healthCheckPollIntervalMs);
        continue;
      }

      if (data.token !== token) {
        const err = makeRuntimeError("token-mismatch", "Launch token mismatch during health check.");
        pushError(err);
        await stopRuntime();
        return;
      }

      appendLog(`Harness health check passed after ${attempts} attempt(s)`);
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("fetch") || error.message.includes("timeout") || error.message.includes("ECONNREFUSED"))
      ) {
        if (attempts % 10 === 0) {
          appendLog(`Health check attempt ${attempts}: waiting…`);
        }
        await delay(healthCheckPollIntervalMs);
        continue;
      }
      throw error;
    }
  }

  const err = makeRuntimeError(
    "timeout",
    `Harness did not become healthy within ${healthCheckMaxWaitMs / 1000}s`,
  );
  pushError(err);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopRuntime(): Promise<void> {
  if (!harnessProcess) return;

  appendLog("Requesting graceful Harness shutdown…");
  const processRef = harnessProcess;
  harnessProcess = null;
  currentPort = null;
  launchToken = null;

  try {
    processRef.kill("SIGTERM");
    await Promise.race([
      waitForProcessExit(processRef, gracefulShutdownTimeoutMs),
      delay(gracefulShutdownTimeoutMs).then(() => {
        if (!processRef.killed) processRef.kill("SIGKILL");
      }),
    ]);
    appendLog("Harness stopped gracefully.");
  } catch {
    appendLog("Harness shutdown timed out; force-killed.");
  }
}

function waitForProcessExit(proc: ChildProcess, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    proc.once("exit", () => { clearTimeout(timer); resolve(); });
    proc.once("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

// ---------------------------------------------------------------------------
// Window management
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
    if (url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (_event, url) => {
    if (!url.startsWith("http://127.0.0.1:")) {
      _event.preventDefault();
    }
  });

  return win;
}

function loadWindowContent(win: BrowserWindow, status: RuntimeStatus): void {
  if (status.state === "ready" && status.url) {
    win.loadURL(status.url).catch((err) => {
      appendLog(`Failed to load URL: ${String(err)}`);
      pushError(makeRuntimeError("invalid-response", `Failed to load Harness UI: ${String(err)}`, { recoverable: true }));
      sendToRenderer("runtime-status", buildStatus("error"));
    });
  } else {
    const indexPath = path.join(import.meta.dirname, "..", "renderer", "index.html");
    win.loadFile(indexPath).catch((err) => {
      appendLog(`Failed to load index.html: ${String(err)}`);
    });
  }
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

async function showDialog(): Promise<string | null> {
  if (mainWindow === null) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select or create workspace",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0] ?? null;
}

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.getRuntimeStatus, () => {
    if (harnessProcess && currentPort !== null) {
      return buildStatus("ready");
    }
    return buildStatus("idle");
  });

  ipcMain.handle(IPC_CHANNELS.restartRuntime, async () => {
    appendLog("Restart requested by renderer.");
    const status = await startRuntime(true);
    sendToRenderer("runtime-status", status);
    return status;
  });

  ipcMain.handle(IPC_CHANNELS.selectWorkspace, async () => {
    const selectedPath = await showDialog();
    if (selectedPath === null) return null;
    addToRecentWorkspaces(selectedPath);
    return {
      kind: "workspace" as const,
      path: selectedPath,
      name: selectedPath.split(/[\\/]/).pop() ?? selectedPath,
      lastOpenedAt: new Date().toISOString(),
    };
  });

  ipcMain.handle(IPC_CHANNELS.listRecentWorkspaces, () => {
    const set = loadRecentWorkspaces();
    return Array.from(set).map((p) => ({
      kind: "workspace" as const,
      path: p,
      name: p.split(/[\\/]/).pop() ?? p,
      lastOpenedAt: new Date().toISOString(),
    }));
  });

  ipcMain.handle(IPC_CHANNELS.openLogs, () => {
    const paths = getPaths();
    ensureDirectory(paths.logs);
    shell.openPath(paths.logs).catch(() => {});
  });

  ipcMain.handle(IPC_CHANNELS.copyDiagnostics, async () => {
    const bundle: DiagnosticBundle = {
      kind: "diagnostic-bundle",
      createdAt: new Date().toISOString(),
      appVersion: pkg.version,
      platform: process.platform,
      runtime: buildStatus("error"),
      recentErrors: recentErrors.map((e) => redact(e) as RuntimeError),
      logs: [...logBuffer],
    };
    clipboard.writeText(JSON.stringify(bundle, null, 2));
    return bundle;
  });

  ipcMain.handle(IPC_CHANNELS.quit, () => {
    app.quit();
  });
}

function addToRecentWorkspaces(workspacePath: string): void {
  const set = loadRecentWorkspaces();
  const normalized = path.normalize(workspacePath);
  set.delete(normalized);
  set.add(normalized);
  while (set.size > MAX_RECENT_WORKSPACES) {
    const first = Array.from(set).shift();
    if (first !== undefined) set.delete(first);
  }
  saveRecentWorkspaces(set);
}

// ---------------------------------------------------------------------------
// Renderer communication
// ---------------------------------------------------------------------------

function sendToRenderer(channel: string, data: unknown): void {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ---------------------------------------------------------------------------
// Native Menu
// ---------------------------------------------------------------------------

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Application",
      submenu: [
        { label: "About DeepSeek Harness", role: "about" },
        { type: "separator" },
        {
          label: "Start/Restart Harness",
          click: async () => {
            const status = await startRuntime(true);
            sendToRenderer("runtime-status", status);
          },
        },
        { type: "separator" },
        { label: "Hide", role: "hide" },
        { label: "Hide Others", role: "hideOthers" },
        { type: "separator" },
        { label: "Quit", accelerator: "CommandOrControl+Q", role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Select Workspace…",
          accelerator: "CommandOrControl+O",
          click: async () => {
            const selectedPath = await showDialog();
            if (selectedPath !== null) {
              addToRecentWorkspaces(selectedPath);
            }
          },
        },
        { type: "separator" },
        { label: "Close Window", role: "close" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Reload", accelerator: "CommandOrControl+R", role: "reload" },
        {
          label: "Force Reload",
          accelerator: "CommandOrControl+Shift+R",
          role: "forceReload",
        },
        { type: "separator" },
        { label: "Toggle Developer Tools", role: "toggleDevTools" },
        { type: "separator" },
        { label: "Actual Size", role: "resetZoom" },
        { label: "Zoom In", role: "zoomIn" },
        { label: "Zoom Out", role: "zoomOut" },
        { type: "separator" },
        { label: "Toggle Full Screen", role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Logs",
          click: () => {
            const paths = getPaths();
            ensureDirectory(paths.logs);
            shell.openPath(paths.logs).catch(() => {});
          },
        },
        {
          label: "Copy Diagnostics",
          click: async () => {
            const bundle: DiagnosticBundle = {
              kind: "diagnostic-bundle",
              createdAt: new Date().toISOString(),
              appVersion: pkg.version,
              platform: process.platform,
              runtime: buildStatus("error"),
              recentErrors: recentErrors.map((e) => redact(e) as RuntimeError),
              logs: [...logBuffer],
            };
            clipboard.writeText(JSON.stringify(bundle, null, 2));
          },
        },
        { type: "separator" },
        {
          label: "DeepSeek Harness Documentation",
          click: () =>
            shell.openExternal("https://github.com/deepseek-ai/deepseek-harness"),
        },
        {
          label: "DeepSeek Harness Desktop Issues",
          click: () =>
            shell.openExternal("https://github.com/NoWint/DeepSeekHarness-Desktop/issues"),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    if (mainWindow !== null) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const deepLink = argv.find((arg) => arg.startsWith("deepseek-harness://"));
    if (deepLink) appendLog(`Deep link received: ${deepLink}`);
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();
    buildMenu();
    mainWindow = createWindow();

    const indexPath = path.join(import.meta.dirname, "..", "renderer", "index.html");

    // Development mode: load Vite dev server directly
    if (process.env.NODE_ENV === "development") {
      mainWindow.loadURL("http://127.0.0.1:5173/").catch((err) => {
        appendLog(`Failed to load Vite dev server: ${String(err)}`);
      });
      // Enable DevTools in development
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(indexPath).catch((err) => {
        appendLog(`Failed to load renderer: ${String(err)}`);
      });

      const status = await startRuntime();
      sendToRenderer("runtime-status", status);
      if (status.state === "ready") {
        loadWindowContent(mainWindow, status);
      }
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
        mainWindow.loadFile(indexPath).catch(() => {});
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("before-quit", async () => {
    await stopRuntime();
  });

  app.on("quit", () => {
    appendLog("Application quitting.");
  });
}
