/**
 * DeepSeek Harness Desktop — Renderer Process
 *
 * React-based desktop shell that displays runtime status,
 * provides workspace selection, and handles error recovery.
 */

import { createRoot } from "react-dom/client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { RuntimeStatus, WorkspaceSummary, RuntimeError } from "../shared/ipc.js";

// ---------------------------------------------------------------------------
// Status display components
// ---------------------------------------------------------------------------

function StatusDot({ state }: { state: RuntimeStatus["state"] }) {
  const dotClass =
    state === "ready" ? "ready" :
    state === "error" ? "error" :
    state === "starting" || state === "stopping" ? "starting" : "idle";
  return <span className={`status-dot ${dotClass}`} />;
}

function StatusText({ state }: { state: RuntimeStatus["state"] }) {
  const titles: Record<string, string> = {
    idle: "Harness Stopped",
    starting: "Starting Harness…",
    stopping: "Stopping Harness…",
    ready: "Harness Running",
    error: "Runtime Error",
  };
  return <div className="status-title">{titles[state]}</div>;
}

function StatusDetail({ state, message }: { state: RuntimeStatus["state"]; message?: string }) {
  const details: Record<string, string> = {
    idle: "Click Start to begin",
    starting: message ?? "Launching Harness process…",
    stopping: "Waiting for graceful shutdown…",
    ready: "Connected to Harness web UI",
    error: message ?? "Check logs for details",
  };
  return <div className="status-detail">{details[state]}</div>;
}

function ErrorDetails({ error }: { error: RuntimeError }) {
  if (!error) return null;
  return (
    <div className="error-details">
      <strong>{error.message}</strong>
      {"cause" in error && error.cause !== undefined && (
        <div style={{ marginTop: 4 }}>{error.cause}</div>
      )}
    </div>
  );
}

function RecentWorkspacesList({
  workspaces,
  onSelect,
}: {
  workspaces: WorkspaceSummary[];
  onSelect: (ws: WorkspaceSummary) => void;
}) {
  if (workspaces.length === 0) return null;
  return (
    <ul className="workspace-list">
      {workspaces.map((ws) => (
        <li key={ws.path} className="workspace-item" onClick={() => onSelect(ws)}>
          <span className="workspace-icon">📁</span>
          <div>
            <div>{ws.name}</div>
            <div className="workspace-path">{ws.path}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

function App() {
  const [status, setStatus] = useState<RuntimeStatus>({
    kind: "runtime-status",
    state: "starting",
    updatedAt: new Date().toISOString(),
    message: "Starting Harness…",
    attempt: 1,
  });
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceSummary[]>([]);
  const restartCountRef = useRef(0);
  const MAX_RESTARTS = 3;

  // Listen for runtime-status events from main process via preload bridge
  useEffect(() => {
    const win = window as Window & { onRuntimeStatus?: (s: RuntimeStatus) => void };
    win.onRuntimeStatus = (s: RuntimeStatus) => {
      setStatus(s);
      if (s.state === "error") {
        restartCountRef.current = 0;
      }
    };
    return () => { delete win.onRuntimeStatus; };
  }, []);

  const api = (window as Window & { desktopApi?: import("../shared/ipc.js").DesktopApi }).desktopApi!;

  const handleStart = useCallback(async () => {
    const result = await api.restartRuntime();
    setStatus(result);
    if (result.state === "ready") {
      restartCountRef.current = 0;
    }
  }, [api]);

  const handleRetry = useCallback(async () => {
    restartCountRef.current += 1;
    if (restartCountRef.current > MAX_RESTARTS) {
      setStatus((prev) => ({
        ...prev,
        error: {
          kind: "runtime-error",
          code: "crash-loop",
          message: `Too many restart attempts (${restartCountRef.current}). Please check logs.`,
          recoverable: true,
        },
      }));
      return;
    }
    const result = await api.restartRuntime();
    setStatus(result);
  }, [api]);

  const handleOpenLogs = useCallback(async () => {
    await api.openLogs();
  }, [api]);

  const handleCopyDiagnostics = useCallback(async () => {
    await api.copyDiagnostics();
  }, [api]);

  const handleQuit = useCallback(async () => {
    await api.quit();
  }, [api]);

  const handleSelectWorkspace = useCallback(async () => {
    const ws = await api.selectWorkspace();
    if (ws) {
      setRecentWorkspaces((prev) => {
        const filtered = prev.filter((w) => w.path !== ws.path);
        return [
          { ...ws, lastOpenedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, 10);
      });
    }
  }, [api]);

  const handleWorkspaceClick = useCallback(
    async (ws: WorkspaceSummary) => {
      setRecentWorkspaces((prev) => {
        const filtered = prev.filter((w) => w.path !== ws.path);
        return [
          { ...ws, lastOpenedAt: new Date().toISOString() },
          ...filtered,
        ].slice(0, 10);
      });
      await handleStart();
    },
    [handleStart],
  );

  const handleListRecent = useCallback(async () => {
    const list = await api.listRecentWorkspaces();
    setRecentWorkspaces(list);
  }, [api]);

  useEffect(() => {
    handleListRecent();
  }, [handleListRecent]);

  const isStarting = status.state === "starting";
  const isReady = status.state === "ready";
  const isError = status.state === "error";
  const isIdle = status.state === "idle";

  return (
    <div className="container">
      <div className="logo">
        <div className="logo-icon">D</div>
        <h1>DeepSeek Harness</h1>
        <p>Cross-platform desktop client</p>
      </div>

      <div className="status-card">
        <div className="status-header">
          <StatusDot state={status.state} />
          <div>
            <StatusText state={status.state} />
            <StatusDetail
              state={status.state}
              {...(status.state === "starting" || status.state === "stopping" ? { message: status.message } : {})}
            />
          </div>
        </div>
        {isError && <ErrorDetails error={status.error} />}
      </div>

      <div className="actions">
        {(isIdle || isError) && (
          <button className="btn btn-primary" onClick={handleStart}>
            {isStarting ? <span className="spinner" /> : "Start Harness"}
          </button>
        )}
        {isError && (
          <div className="btn-row">
            <button className="btn" onClick={handleRetry}>Retry</button>
            <button className="btn" onClick={handleOpenLogs}>Open Logs</button>
          </div>
        )}
        {isError && (
          <div className="btn-row">
            <button className="btn" onClick={handleCopyDiagnostics}>Copy Diagnostics</button>
            <button className="btn btn-danger" onClick={handleQuit}>Quit</button>
          </div>
        )}
        {isReady && (
          <div className="btn-row">
            <button className="btn" onClick={handleOpenLogs}>Open Logs</button>
            <button className="btn btn-danger" onClick={handleQuit}>Quit</button>
          </div>
        )}
      </div>

      <div className="workspace-section">
        <h3>Recent Workspaces</h3>
        <RecentWorkspacesList
          workspaces={recentWorkspaces}
          onSelect={handleWorkspaceClick}
        />
        <button
          className="btn"
          onClick={handleSelectWorkspace}
          style={{ marginTop: "0.75rem" }}
        >
          Select or Create Workspace…
        </button>
      </div>

      <div className="version-info">
        <span>DeepSeek Harness Desktop v0.1.0</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entry Point
// ---------------------------------------------------------------------------

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("Renderer root element is missing.");
}

createRoot(rootElement).render(<App />);
