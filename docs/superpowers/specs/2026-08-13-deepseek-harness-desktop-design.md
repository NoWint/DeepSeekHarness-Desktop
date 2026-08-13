# DeepSeek Harness Desktop — Design Specification

**Date:** 2026-08-13  
**Status:** Approved direction; implementation pending  
**Target platforms:** macOS, Windows, Linux  
**Destination repository:** `NoWint/DeepSeekHarness-Desktop`

## 1. Context and goals

`deepseek-harness` is a MIT-licensed, TypeScript/ESM, Cordis-based developer preview that currently runs as a local Node-hosted web application. It provides model providers, agent loops, sessions, workspaces, terminals, filesystem access, subprocess execution, and sandbox integrations.

This project will provide a distributable desktop application without rewriting the upstream Harness UI or forking its core runtime unnecessarily. The desktop client must make the existing workflow feel native while preserving upstream compatibility and clearly documenting the preview status and platform limitations.

### Success criteria

- A user can install and launch the application on macOS, Windows, or Linux without separately installing Node.js.
- The application starts an app-owned Harness host, waits for a verified health response, and loads the UI in a desktop window.
- A user can choose a workspace, configure a provider, run a session, use supported terminal/file capabilities, close the app, and resume it.
- Host failure, unavailable network, port conflicts, and malformed configuration produce actionable recovery UI rather than a blank window.
- CI validates type checking, linting, tests, and packaging on all three operating-system families.
- GitHub Releases contain reproducible artifacts and the repository includes licensing, security, contribution, issue, and release documentation.

## 2. Non-goals for the first release

- Reimplementing the Harness web UI or agent runtime.
- Building a hosted account service, cloud sync, telemetry backend, or model gateway.
- Promising identical sandbox behavior across operating systems.
- Adding an auto-updater before artifact signing and release provenance are configured.
- Supporting arbitrary third-party plugins through a new desktop-only API.

## 3. Architecture decision

### Selected approach: Electron shell plus a bundled Node host

Electron is selected over Tauri because the upstream runtime is Node-based and includes native Node modules (`node-pty`, `sharp`, `koffi`, SQLite, ripgrep, and platform-specific sandbox components). The desktop process will not execute the Harness inside Electron's embedded Node ABI. Instead, it will launch a separately bundled Node 22.x runtime as a child process, avoiding Electron ABI mismatches and allowing the upstream CLI to run with its expected environment.

The repository will contain a small desktop integration layer and a pinned upstream runtime dependency/build input. The upstream Host/Client split and Cordis bundle composition remain intact.

```text
Electron main process
├── App lifecycle and single-instance lock
├── Window and native menu manager
├── HarnessRuntimeManager
│   ├── Resolve app-owned Node runtime
│   ├── Resolve pinned DSH package/runtime files
│   ├── Allocate loopback port and launch `dsh web`
│   ├── Health-check with launch token
│   ├── Stream/redact child-process logs
│   └── Graceful shutdown and bounded restart
├── Workspace and native-dialog IPC handlers
├── Credential storage adapter
├── Diagnostics/logging service
└── Preload bridge (allowlisted APIs only)

Renderer
└── React + TypeScript desktop shell
    ├── Launch/loading/recovery screens
    ├── Workspace selection and recent workspaces
    ├── Harness web UI view
    └── desktop-only menus, shortcuts, and diagnostics affordances

Packaged resources
├── Electron application
├── Node runtime per OS/architecture
├── pinned Harness runtime and production dependencies
├── native modules and helper binaries
└── licenses and third-party notices
```

## 4. Runtime and process lifecycle

1. The main process obtains a single-instance lock. A second launch focuses the existing window and forwards a validated deep-link/open-path request.
2. The app creates platform-appropriate application, log, temporary, and Harness home directories. Existing user data is never silently deleted or migrated destructively.
3. `HarnessRuntimeManager` selects a free loopback port and generates a random per-launch token.
4. The manager launches the bundled Node executable with the pinned Harness CLI and `web` arguments, with `DSH_HOME` set to the app-owned Harness data directory and a sanitized environment.
5. The manager polls a loopback health endpoint and verifies both the expected process identity/token and an HTTP success response before the renderer navigates.
6. The renderer first shows a deterministic loading state, then mounts the local Harness UI. A navigation timeout presents restart/log/copy-diagnostics actions.
7. On window close, the app persists UI state, requests a graceful child-process shutdown, waits for a bounded timeout, and terminates only the app-owned process if necessary.
8. Unexpected exit transitions the renderer to a recoverable error state. Automatic restart is limited and backoff-based to avoid crash loops.

The local server must bind to loopback only. The app must not expose the Harness HTTP API on LAN interfaces by default.

## 5. Renderer and IPC security model

- `contextIsolation` and `sandbox` are enabled where compatible with the chosen Electron version.
- `nodeIntegration` is disabled.
- The preload script exposes a minimal, typed API: app metadata, runtime status, workspace dialogs, recent-workspace operations, diagnostics export, and safe lifecycle commands.
- IPC channels are explicit constants with runtime input validation. No generic `eval`, arbitrary shell, arbitrary path deletion, or unrestricted child-process API is exposed to the renderer.
- Navigation is restricted to the verified local Harness origin and approved external HTTPS links opened in the system browser.
- The local URL includes a launch token or equivalent origin check where supported by the upstream server. Tokens and credentials are never placed in logs or user-visible error messages.
- The desktop layer does not bypass upstream approval policies for tools or commands.

## 6. Workspace, configuration, and credentials

The app keeps project data separate from application-managed state:

- **Application resources:** immutable packaged files.
- **User application data:** platform-standard Electron user-data directory.
- **Harness home (`DSH_HOME`):** an app-owned subdirectory with migration/version metadata.
- **Workspace:** an explicit user-selected directory; recent-workspace entries store normalized paths only.
- **Logs and diagnostics:** platform-standard log directory with redaction.
- **Credentials:** use the operating-system keychain through a maintained secret-storage adapter where possible. If upstream requires a file-backed credential format, the adapter writes only to the app-owned Harness home with restrictive permissions and documents the limitation.

Provider setup must never echo secret values into renderer state, crash reports, CI logs, or diagnostic bundles. Diagnostics include versions, platform, lifecycle events, and redacted error output only.

## 7. User experience

### First run

- Branded launch screen with clear status: preparing runtime, starting Harness, checking connection, or recovering.
- Workspace picker with create-folder support and a recent-workspace list.
- A provider setup path that links to upstream configuration guidance without inventing a second incompatible configuration model.

### Main window

- Upstream Harness UI remains the primary workspace.
- Native application menu: File, Workspace, View, Window, Help.
- Platform-standard shortcuts for new window/session, reload, developer diagnostics (development builds only), and quit.
- Optional tray/menu-bar entry to show, hide, restart runtime, open logs, and quit.
- Accessible loading, empty, offline, and fatal-error states with keyboard focus management.

### Recovery

Every startup failure offers at least: retry, restart runtime, open logs, copy redacted diagnostics, and quit. Network/provider failures are distinguished from local runtime failures.

## 8. Packaging and release

The build will use Electron Builder (or an equivalent pinned packager) with platform-specific targets:

- macOS: DMG for Apple Silicon and Intel; signing/notarization hooks are environment-driven.
- Windows: signed-ready NSIS installer for x64, with ARM64 configuration reserved for a later verified matrix.
- Linux: AppImage and deb for x64; additional architectures are enabled only after native dependency verification.

A packaging preparation step will:

1. Pin the upstream Harness version/commit.
2. Install production dependencies using the upstream-required pnpm/Corepack toolchain.
3. Obtain the matching official Node runtime for each target OS/architecture.
4. Preserve required native modules and helper binaries; do not assume one universal `node_modules` tree.
5. Generate `THIRD_PARTY_NOTICES.md` from the authoritative lockfile and upstream notices.
6. Place runtime files under packaged resources and configure unpacking for native binaries.

Release workflows will run on native GitHub-hosted runners, build unsigned artifacts on pull requests, and publish signed artifacts only when repository secrets and tag protections are present. Checksums and build metadata will accompany release assets.

## 9. Repository engineering

The initial repository setup will include:

- `README.md` with user installation, development, build, troubleshooting, supported-platform notes, and upstream attribution.
- `LICENSE` (MIT for the desktop integration code) and preserved upstream license/notice files.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.
- Pull-request template and issue templates for bugs, feature requests, and packaging/platform failures.
- `.editorconfig`, `.gitignore`, pinned package-manager metadata, TypeScript configuration, lint/format configuration, and test configuration.
- Dependabot configuration and a changelog/release convention.
- GitHub Actions for quality checks, native packaging, artifact retention, and tagged releases.

The README will distinguish desktop code from upstream code and document how to update the pinned upstream runtime, review dependency/license changes, and reproduce a local package.

## 10. Testing strategy

### Unit tests

- Free-port selection and collision handling.
- Platform path resolution and migration rules.
- Launch state machine and bounded retry/backoff.
- Child-process command construction and environment sanitization.
- IPC validation and allowlist behavior.
- Log/diagnostic redaction.

### Integration tests

- Start a fixture HTTP host and verify readiness/launch-token handling.
- Start and stop a fixture child process through `HarnessRuntimeManager`.
- Simulate startup timeout, unexpected exit, repeated crash, and malformed response.
- Verify workspace selection and recent-workspace persistence in an isolated temp directory.

### Packaging smoke tests

- Build the desktop artifact on macOS, Windows, and Linux runners.
- Verify expected resources, Node executable, native helper files, notices, and application metadata are present.
- Launch a packaged build in a smoke-test mode and validate the local health handshake.

Manual release acceptance will cover workspace creation, provider configuration, a model session, terminal/file operations, restart/resume behavior, and clean uninstall expectations on all three OS families.

## 11. Risks and mitigations

- **Upstream developer-preview churn:** pin a known-good version, isolate integration code, and document update procedure.
- **Native module ABI/packaging failures:** run builds on native runners, bundle a matching Node runtime, and add resource inspection smoke tests.
- **OS sandbox differences:** expose capability status, preserve upstream approvals, and avoid claiming equivalent enforcement.
- **Local HTTP attack surface:** loopback-only binding, random port, launch-token verification, strict navigation policy.
- **Secret leakage:** keychain/file-permission adapter and redacted diagnostics.
- **Large installer size:** accept size for compatibility; avoid premature compression/runtime rewrites until measured.
- **Unsigned artifacts:** label development artifacts clearly and make signing/notarization configuration explicit.

## 12. Initial implementation slices

1. Repository scaffold and documentation/configuration baseline.
2. Electron main/preload/renderer shell with typed IPC and launch/recovery screens.
3. Harness runtime manager with bundled-runtime development fallback and fixture tests.
4. Upstream runtime packaging preparation and native-resource handling.
5. Workspace/recent-workspace and diagnostics integrations.
6. Cross-platform CI, packaging smoke tests, release workflow, and final documentation.

This sequence keeps the desktop lifecycle testable before adding the full upstream runtime packaging surface.
