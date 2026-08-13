# DeepSeek Harness Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a secure Electron desktop client that runs a pinned DeepSeek Harness web host on macOS, Windows, and Linux with native lifecycle, workspace, diagnostics, packaging, tests, and repository automation.

**Architecture:** Electron main process owns lifecycle, filesystem dialogs, secure storage, and an app-owned child Node runtime. A preload bridge exposes a small validated API to a React/TypeScript renderer. The renderer presents launch/recovery screens and then loads the verified loopback Harness web UI; upstream Host/Client and Cordis composition remain outside the desktop shell.

**Tech Stack:** Electron 39.x, React 19.x, TypeScript 5.x, Vite 7.x, Vitest, Playwright component tests where useful, electron-builder, pnpm 10.x via Corepack, Node 22.x, `@deepseek-ai/dsh` pinned to a reviewed version/lockfile, GitHub Actions.

## Global Constraints

- Target macOS, Windows, and Linux; primary release artifacts are macOS DMG (arm64/x64), Windows NSIS x64, Linux AppImage and deb x64.
- Bundle a matching Node 22.x runtime for packaged builds; development may use the local Node executable only when explicitly configured.
- Keep `contextIsolation: true`, `nodeIntegration: false`, a typed allowlisted preload API, loopback-only Harness binding, random ports, and a per-launch readiness token.
- Never log or export provider secrets; diagnostic bundles must redact tokens, authorization headers, credential files, and environment values.
- Preserve MIT attribution and ship upstream/third-party notices generated from the pinned dependency closure.
- Do not bypass upstream tool approval policies or expose arbitrary shell/file APIs to the renderer.
- Use TDD for runtime, IPC, path, and redaction behavior; each task ends with focused tests and a commit.
- Do not add accounts, cloud sync, telemetry backend, or a second incompatible provider configuration model.

---

## File map

### Root/configuration

- Create: `package.json` — scripts, pinned dependencies, package metadata, release entry points.
- Create: `pnpm-lock.yaml` — reproducible dependency graph.
- Create: `pnpm-workspace.yaml` — workspace boundary for desktop packages and vendored integration if needed.
- Create: `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json` — strict main/preload/renderer type checking without merging upstream host/client declarations.
- Create: `vite.config.ts` — renderer build and Vitest configuration.
- Create: `electron-builder.yml` — target formats, resource unpacking, metadata, and signing hooks.
- Create: `.editorconfig`, `.gitignore`, `.npmrc`, `.node-version`.
- Create: `LICENSE`, `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md`.

### Main process and shared contracts

- Create: `src/shared/ipc.ts` — typed request/response contracts and channel names.
- Create: `src/shared/platform-paths.ts` — deterministic app-data/log/temp/Harness-home path resolution.
- Create: `src/shared/redaction.ts` — recursive redaction for strings, objects, headers, paths, and diagnostics.
- Create: `src/main/index.ts` — Electron bootstrap, single-instance lock, lifecycle wiring.
- Create: `src/main/window-manager.ts` — secure BrowserWindow construction and navigation policy.
- Create: `src/main/runtime/runtime-types.ts` — runtime state/error types and process interface.
- Create: `src/main/runtime/runtime-manager.ts` — port/token selection, child launch, readiness, restart, shutdown.
- Create: `src/main/runtime/command-builder.ts` — platform-safe command/env construction.
- Create: `src/main/runtime/health-check.ts` — loopback readiness and token verification.
- Create: `src/main/workspace-service.ts` — native directory selection and recent-workspace persistence.
- Create: `src/main/diagnostics-service.ts` — redacted logs and exportable diagnostics.
- Create: `src/main/secure-store.ts` — OS keychain adapter boundary with file-backed restricted fallback.
- Create: `src/main/ipc-handlers.ts` — validated handlers for the allowlisted preload API.
- Create: `src/preload/index.ts` — context-isolated bridge using `contextBridge`.

### Renderer

- Create: `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/styles.css`.
- Create: `src/renderer/app.tsx` — launch, recovery, workspace, and embedded Harness states.
- Create: `src/renderer/api.ts` — typed wrapper around `window.desktop`.
- Create: `src/renderer/components/LaunchScreen.tsx`, `RecoveryScreen.tsx`, `WorkspacePicker.tsx`, `HarnessView.tsx`, `StatusBar.tsx`.
- Create: `src/renderer/state/app-state.ts` — reducer/state machine for lifecycle transitions.

### Tests

- Create: `src/main/runtime/*.test.ts` — command, health, lifecycle, retry, and shutdown tests.
- Create: `src/shared/*.test.ts` — paths, IPC validation, and redaction tests.
- Create: `src/main/*.test.ts` — workspace, diagnostics, and secure-store tests.
- Create: `src/renderer/state/app-state.test.ts` — deterministic UI state transitions.
- Create: `tests/packaging/inspect-artifact.mjs` — verifies expected runtime/native resources and notices.

### CI/docs/GitHub configuration

- Create: `.github/workflows/quality.yml`, `package.yml`, `release.yml`.
- Create: `.github/dependabot.yml`, `.github/pull_request_template.md`.
- Create: `.github/ISSUE_TEMPLATE/bug.yml`, `feature.yml`, `packaging.yml`.
- Create: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `README.md`.
- Create: `scripts/prepare-harness-runtime.mjs`, `scripts/fetch-node-runtime.mjs`, `scripts/generate-notices.mjs`, `scripts/check-package.mjs`.

---

## Task 1: Scaffold the project and quality gates

**Files:** root/configuration files listed above; `src/shared/ipc.ts`.

**Interfaces:** Produces package scripts consumed by every later task: `dev`, `build`, `typecheck`, `lint`, `format:check`, `test`, `package`, `package:all`, `prepare:harness`, and `verify:package`.

- [ ] **Step 1: Add failing baseline checks.** Create `tests/project-config.test.mjs` that asserts `package.json` contains the required scripts, strict TypeScript options, and three platform packaging targets.
- [ ] **Step 2: Run the check before configuration.** Run `node --test tests/project-config.test.mjs`; expected failure because the project manifest does not exist.
- [ ] **Step 3: Create manifests and strict configs.** Add package metadata, pnpm settings, TypeScript project references, Vite/Vitest setup, and the Electron Builder target matrix. Pin exact major/minor versions and add `engines.node >=22.19.0`.
- [ ] **Step 4: Define shared IPC contracts.** Add discriminated unions for `RuntimeStatus`, `RuntimeError`, `WorkspaceSummary`, `DiagnosticBundle`, and methods `getRuntimeStatus`, `restartRuntime`, `selectWorkspace`, `listRecentWorkspaces`, `openLogs`, `copyDiagnostics`, `quit`.
- [ ] **Step 5: Install and lock dependencies.** Run `corepack enable`, `corepack prepare pnpm@10.15.0 --activate`, then `pnpm install --frozen-lockfile` after lockfile generation; do not use npm for project dependencies.
- [ ] **Step 6: Run all baseline checks.** Run `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `pnpm test`; expected to pass with only placeholder-safe entrypoints.
- [ ] **Step 7: Commit.** `git add . && git commit -m "chore: scaffold desktop project"`.

## Task 2: Implement secure platform paths and redaction first

**Files:** `src/shared/platform-paths.ts`, `src/shared/platform-paths.test.ts`, `src/shared/redaction.ts`, `src/shared/redaction.test.ts`.

**Interfaces:** `resolvePlatformPaths(appDataRoot, platform, homeDir?) -> PlatformPaths`; `redact(value: unknown) -> unknown`; `redactText(text: string) -> string`.

- [ ] **Step 1: Write failing tests** for macOS/Windows/Linux path names, workspace path normalization, removal of path traversal in app-owned subpaths, and redaction of API keys, Bearer headers, credential fields, `.credentials.yaml` content, and nested error objects.
- [ ] **Step 2: Run focused tests.** `pnpm vitest run src/shared/platform-paths.test.ts src/shared/redaction.test.ts`; expected failures.
- [ ] **Step 3: Implement pure functions.** Use `path.join`/`path.resolve` and explicit platform folders; never concatenate user-controlled segments; make redaction preserve error shape while replacing secret values with `[REDACTED]`.
- [ ] **Step 4: Run focused tests and lint.** Expected PASS with no unsafe `any` or silent catches.
- [ ] **Step 5: Commit.** `git add src/shared && git commit -m "feat: add platform paths and diagnostic redaction"`.

## Task 3: Build the runtime command and health-check boundaries

**Files:** `src/main/runtime/runtime-types.ts`, `command-builder.ts`, `health-check.ts`, and their tests.

**Interfaces:** `buildHarnessCommand(options: CommandOptions) -> ChildProcessSpec`; `checkHarnessHealth(url, token, fetchImpl, timeoutMs) -> Promise<HealthResult>`; `RuntimeProcess` interface with `spawn`, `kill`, `pid`, and event subscriptions.

- [ ] **Step 1: Write failing tests** for sanitized environment, `DSH_HOME`, random port argument, launch token, Windows executable handling, no shell interpolation, timeout, non-200 response, wrong token, and successful health response.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Implement command builder.** Pass argv as an array to `spawn`; set `HOST=127.0.0.1`/equivalent, selected port, token, app-owned `DSH_HOME`, and a minimal inherited environment. Reject workspace paths outside explicit fields.
- [ ] **Step 4: Implement health checker.** Use an `AbortController`, bounded timeout, loopback URL parsing, constant-time token comparison where applicable, and typed errors (`timeout`, `connection-refused`, `invalid-response`, `token-mismatch`).
- [ ] **Step 5: Run focused tests.** `pnpm vitest run src/main/runtime/command-builder.test.ts src/main/runtime/health-check.test.ts`.
- [ ] **Step 6: Commit.** `git add src/main/runtime && git commit -m "feat: add safe harness command and health handshake"`.

## Task 4: Implement the Harness runtime state machine

**Files:** `src/main/runtime/runtime-manager.ts`, `runtime-manager.test.ts`.

**Interfaces:** `new HarnessRuntimeManager(deps: RuntimeDependencies)`; `start() -> Promise<RuntimeStatus>`; `restart() -> Promise<RuntimeStatus>`; `stop() -> Promise<void>`; `getStatus() -> RuntimeStatus`; `onStatus(listener) -> () => void`.

- [ ] **Step 1: Write failing tests** for idle→starting→ready, launch failure, bounded health timeout, unexpected exit, one automatic backoff restart, crash-loop terminal error, graceful stop, forced stop after timeout, and no killing unrelated PIDs.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Implement the manager.** Inject process factory, clock/sleep, port allocator, health checker, and logger for deterministic tests. Track only the child process object created by the manager. Emit immutable status snapshots.
- [ ] **Step 4: Add bounded retry/backoff.** Use three attempts with 250ms/1s/2s delays, then expose a recoverable `crash-loop` error; manual restart resets the counter.
- [ ] **Step 5: Run focused tests plus typecheck.** Expected PASS.
- [ ] **Step 6: Commit.** `git add src/main/runtime && git commit -m "feat: manage harness lifecycle and recovery"`.

## Task 5: Add Electron main process, secure window, and preload IPC

**Files:** `src/main/index.ts`, `window-manager.ts`, `ipc-handlers.ts`, `src/preload/index.ts`, tests.

**Interfaces:** `createMainWindow(runtime, services) -> BrowserWindow`; `registerIpcHandlers(deps) -> void`; preload `window.desktop` implementing `DesktopApi` from `src/shared/ipc.ts`.

- [ ] **Step 1: Write failing tests** for BrowserWindow security flags, allowed local navigation, blocked non-HTTPS external navigation, IPC argument validation, and no arbitrary channel registration.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Implement main bootstrap.** Acquire single-instance lock, create app paths, initialize logger/store/runtime, register handlers, create the window, and start runtime after `app.whenReady()`.
- [ ] **Step 4: Implement window policy.** Enable context isolation, disable node integration, set preload explicitly, deny unexpected navigation/new windows, and open approved HTTPS URLs externally.
- [ ] **Step 5: Implement preload.** Expose only named methods and a status subscription; validate received data before returning it to the renderer.
- [ ] **Step 6: Run tests/typecheck.** `pnpm vitest run src/main/window-manager.test.ts src/main/ipc-handlers.test.ts src/preload/index.test.ts && pnpm typecheck`.
- [ ] **Step 7: Commit.** `git add src/main src/preload src/shared/ipc.ts && git commit -m "feat: add secure electron lifecycle and preload bridge"`.

## Task 6: Build renderer launch, recovery, workspace, and Harness view

**Files:** renderer files listed above and tests.

**Interfaces:** `App` consumes `DesktopApi`; reducer actions `BOOTSTRAP`, `RUNTIME_STATUS`, `SELECT_WORKSPACE`, `RETRY`, `RESTART`, `QUIT`; `HarnessView` accepts `url` and `onLoadFailure`.

- [ ] **Step 1: Write reducer/component tests** for loading stages, ready state, recoverable errors, retry/restart actions, keyboard focus, and safe URL rendering.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Implement the reducer and accessible screens.** Keep copy actionable and distinguish runtime/network/provider errors. Use semantic buttons, visible focus, `aria-live` status, and keyboard-first workspace selection.
- [ ] **Step 4: Implement Harness view.** Render the verified loopback URL only after the main process reports ready; show a bounded load fallback and diagnostics controls.
- [ ] **Step 5: Add platform-aware styling.** Use a restrained dark/light system palette, native-feeling spacing, reduced-motion support, and responsive minimum sizes without gradients or unsafe HTML injection.
- [ ] **Step 6: Run renderer tests, build, and lint.** `pnpm vitest run src/renderer && pnpm build:renderer && pnpm lint`.
- [ ] **Step 7: Commit.** `git add src/renderer && git commit -m "feat: add desktop launch and recovery experience"`.

## Task 7: Add workspace, recent projects, diagnostics, and secure storage

**Files:** `workspace-service.ts`, `diagnostics-service.ts`, `secure-store.ts`, tests, and main wiring.

**Interfaces:** `WorkspaceService.select() -> Promise<WorkspaceSummary | null>`; `listRecent() -> Promise<WorkspaceSummary[]>`; `DiagnosticsService.collect() -> Promise<DiagnosticBundle>`; `SecureStore.get/set/delete(key) -> Promise<string | null | void>`.

- [ ] **Step 1: Write failing tests** for isolated persistence, duplicate recent paths, max five recent entries, inaccessible directories, redacted diagnostics, log-directory opening, keychain success, and restricted fallback-file permissions.
- [ ] **Step 2: Run focused tests** and confirm failures.
- [ ] **Step 3: Implement workspace service.** Use Electron dialog only in main, normalize paths, verify directories, store JSON atomically under app data, and never delete project contents.
- [ ] **Step 4: Implement diagnostics.** Collect app/runtime/upstream versions, platform, state transitions, and redacted recent errors; export a zip/JSON bundle to a user-selected path without credentials.
- [ ] **Step 5: Implement secure store boundary.** Prefer a maintained OS keychain package; if unavailable, use an app-owned file with restrictive permissions, clear warning metadata, and no project-directory fallback.
- [ ] **Step 6: Wire handlers and test end-to-end with fakes.** Expected PASS.
- [ ] **Step 7: Commit.** `git add src/main && git commit -m "feat: add workspace diagnostics and secret storage"`.

## Task 8: Integrate and pin the upstream Harness runtime

**Files:** `scripts/prepare-harness-runtime.mjs`, `scripts/fetch-node-runtime.mjs`, `scripts/generate-notices.mjs`, package metadata, `vendor/upstream/README.md`, generated resource manifest.

**Interfaces:** `pnpm prepare:harness -- --version <reviewed-version>` produces `resources/harness/manifest.json`; manifest fields are `upstreamVersion`, `upstreamCommit`, `nodeVersion`, `platform`, `entrypoint`, `sha256`.

- [ ] **Step 1: Add fixture tests** for manifest validation, checksum mismatch, unsupported platform, missing native binary, and license-notice generation.
- [ ] **Step 2: Run fixture tests** and confirm failures.
- [ ] **Step 3: Implement preparation script.** Download or build the pinned upstream CLI using its required pnpm/Corepack toolchain, record commit/version, copy production files, and fail closed if metadata/checksums are missing. Keep upstream Host/Client projects separate.
- [ ] **Step 4: Implement Node runtime fetcher.** Resolve official Node 22.x archives by OS/architecture, verify SHA-256 against the published checksum, unpack to `resources/node/<platform>-<arch>/`, and make the executable discoverable.
- [ ] **Step 5: Implement notice generation.** Combine upstream `LICENSE`, `THIRD_PARTY_NOTICES.md`, lockfile-derived dependency licenses, and desktop dependencies into a deterministic notice file.
- [ ] **Step 6: Run preparation for the development host and verify resource manifest.** Do not commit opaque binaries; commit only scripts, metadata, and documented checksums unless repository policy explicitly requires fixtures.
- [ ] **Step 7: Commit.** `git add scripts vendor resources/harness/manifest.json package.json && git commit -m "build: pin and prepare harness runtime"`.

## Task 9: Configure packaging and artifact inspection

**Files:** `electron-builder.yml`, `scripts/check-package.mjs`, `tests/packaging/inspect-artifact.mjs`, package scripts.

**Interfaces:** `pnpm package -- --linux AppImage`; `pnpm verify:package <artifact>` exits non-zero for missing executable, manifest, native resources, notices, or metadata.

- [ ] **Step 1: Write failing artifact-inspection tests** using a temporary fake package tree.
- [ ] **Step 2: Run tests** and confirm failures.
- [ ] **Step 3: Configure builder.** Include app ID, product name, icons, asar with `asarUnpack` for native modules/helpers, extra resources for Node/Harness, DMG/NSIS/AppImage/deb targets, and signing/notarization environment hooks.
- [ ] **Step 4: Implement inspection script.** Check manifest fields, executable mode on Unix, Windows executable presence, notices, and platform metadata; never execute untrusted artifact contents during inspection.
- [ ] **Step 5: Build a local unsigned artifact for the current OS.** Run `pnpm package` and `pnpm verify:package <generated-artifact>`; record expected unsigned warnings without treating them as test failures.
- [ ] **Step 6: Commit.** `git add electron-builder.yml scripts/check-package.mjs tests/packaging package.json && git commit -m "build: configure cross-platform desktop packaging"`.

## Task 10: Add CI, release automation, and repository templates

**Files:** `.github/workflows/*.yml`, `.github/dependabot.yml`, issue/PR templates, docs listed above.

- [ ] **Step 1: Add quality workflow.** Matrix Node 22.19/24 on Ubuntu; install Corepack/pnpm, run frozen install, typecheck, lint, format check, unit tests.
- [ ] **Step 2: Add package workflow.** Native `macos-14`, `windows-2025`, and `ubuntu-24.04` jobs; prepare pinned runtime; build unsigned artifacts on pull requests; upload artifacts for inspection.
- [ ] **Step 3: Add release workflow.** Trigger on protected `v*` tags, require permissions least privilege, build all targets, generate checksums/notices, and publish GitHub Release assets. Signing steps activate only when secrets exist and must fail clearly when a release policy requires signing.
- [ ] **Step 4: Add Dependabot, issue forms, PR template, and security/contribution docs.** Include responsible disclosure contact and explicit warning not to paste provider secrets into issues.
- [ ] **Step 5: Write README.** Document upstream relationship, developer preview status, prerequisites, local dev, runtime preparation, platform builds, unsigned-artifact warnings, data locations, troubleshooting, and licensing.
- [ ] **Step 6: Validate workflow YAML and links.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and a YAML parser check; fix all errors.
- [ ] **Step 7: Commit.** `git add .github README.md CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md CHANGELOG.md LICENSE THIRD_PARTY_NOTICES.md && git commit -m "chore: configure repository quality and releases"`.

## Task 11: End-to-end verification and release readiness

**Files:** `docs/release-checklist.md`, `docs/platform-support.md`, any fixes discovered by verification.

- [ ] **Step 1: Run the complete local suite.** `pnpm install --frozen-lockfile && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 2: Run current-platform package smoke test.** `pnpm prepare:harness && pnpm package && pnpm verify:package <artifact>`.
- [ ] **Step 3: Exercise a fixture end-to-end flow.** Start the desktop app in fixture-host mode, select a temp workspace, confirm ready UI, force host exit, confirm recovery UI, restart, then quit; save logs outside the project and verify secrets are absent.
- [ ] **Step 4: Review cross-platform gaps.** Check native dependency manifests, path separators, executable bits, signal handling, menu accelerators, and installer metadata against the three CI runners.
- [ ] **Step 5: Document release checklist and support matrix.** State verified OS/architecture combinations, sandbox limitations, signing status, data paths, and rollback procedure.
- [ ] **Step 6: Create a final verification commit.** `git add docs && git commit -m "docs: add release readiness checklist"`.

## Task 12: Push and configure the GitHub destination

**Files:** remote configuration only; no source changes unless remote validation finds a discrepancy.

- [ ] **Step 1: Validate authentication and destination.** Run `gh auth status` and `gh repo view NoWint/DeepSeekHarness-Desktop --json nameWithOwner,isEmpty,defaultBranchRef`; stop if authentication lacks push permission.
- [ ] **Step 2: Add the remote and verify it points exactly to `NoWint/DeepSeekHarness-Desktop`.** Use `git remote add origin https://github.com/NoWint/DeepSeekHarness-Desktop.git` and `git remote -v`.
- [ ] **Step 3: Push `main`.** Run `git push -u origin main`; do not force-push and do not overwrite unexpected remote commits.
- [ ] **Step 4: Configure repository metadata with `gh`.** Set description/topics if permission allows, enable vulnerability alerts/Dependabot where available, and verify Actions/workflows are present. Do not change visibility or delete content.
- [ ] **Step 5: Create an initial pre-release only after artifacts verify.** Use a version tag only when the release workflow succeeds; otherwise leave the source push and document the failed release step.
- [ ] **Step 6: Verify remote state.** Run `gh repo view`, `gh run list`, and `git status --short`; report exact URLs, commit, workflow status, and any unavailable signing/release prerequisites.

---

## Self-review checklist

- **Spec coverage:** lifecycle/security/path/credentials are Tasks 2–7; upstream/native packaging and notices are Task 8; artifact formats are Task 9; CI/release/repository setup are Tasks 10–12; testing is included in every task and summarized in Task 11.
- **Placeholder scan:** no `TBD`, `TODO`, or unspecified “appropriate” implementation steps remain; platform and command details are explicit.
- **Type consistency:** `DesktopApi`, `RuntimeStatus`, `PlatformPaths`, `ChildProcessSpec`, `HealthResult`, and service method names are defined in the file map/interfaces before consumers.
- **Scope:** all tasks contribute directly to a shippable desktop client and repository; no unrelated refactors are included.
