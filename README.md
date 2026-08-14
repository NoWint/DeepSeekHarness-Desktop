# DeepSeek Harness Desktop

A cross-platform Electron desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

**Status:** Pre-release · **Platform:** macOS, Windows, Linux · **License:** MIT

---

## What this is

This project wraps the upstream [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (MIT) in a native desktop application. The desktop client provides:

- A native macOS/Windows/Linux window and menu bar
- Local Harness runtime management with health checks and crash recovery
- Workspace selection and recent-workspace history
- Secure IPC between the renderer and main process
- Platform-appropriate data directories and logging
- Structured diagnostic output

The Harness UI itself remains the upstream web application. This shell does not reimplement agent or UI logic from upstream.

---

## What this is not

- A fork of `deepseek-harness`
- A hosted account service or cloud backend
- An auto-updater (until signing/provenance is configured)
- A promise of identical sandbox behavior across OSes

---

## Quick start

### Prerequisites

- Node.js 22.19+ (managed automatically by Volta when installed)
- pnpm 10.x (managed by Volta)

### Install dependencies

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

This launches the Electron app in development mode, loading the local Harness web UI from `127.0.0.1:3080`.

### Build

```bash
pnpm build
```

### Package for distribution

```bash
pnpm package           # current platform
pnpm package:all       # macOS + Windows + Linux
```

---

## Project structure

```
src/
├── main/            Electron main process (runtime management, menus, IPC)
├── preload/         Typed IPC bridge exposed to the renderer
├── renderer/        React desktop shell (status, recovery, workspace UI)
└── shared/          IPC contracts, path resolution, redaction utilities
scripts/
├── prepare-harness-runtime.mjs   Bundle upstream CLI for packaging
└── check-package.mjs            Smoke test for packaged artifacts
.github/
├── workflows/ci.yml              CI: lint, test, build, package, release
└── workflows/dependabot.yml      Dependabot auto-merge
tests/                            Node test runner integration tests
docs/                             Design and implementation documentation
```

---

## Platform notes

| Platform | Supported | Notes |
|----------|-----------|-------|
| macOS (Apple Silicon) | ✅ | DMG installer; signing/notarization via secrets |
| macOS (Intel) | ✅ | Included in universal DMG |
| Windows (x64) | ✅ | NSIS installer; ARM64 reserved for later |
| Linux (x64) | ✅ | AppImage + deb packages |
| Linux (ARM64) | ⚠️ | Native module verification pending |

Sandbox capabilities differ by OS. Linux uses bubblewrap/Landlock where available; macOS uses Seatbelt; Windows has no documented upstream equivalent. The desktop layer does not add or remove upstream sandbox behavior.

---

## Configuration

The application respects the upstream Harness environment:

- `DSH_HOME` — set automatically to the app-owned Harness directory (`~/Library/Application Support/DeepSeek Harness/harness` on macOS, etc.)
- Workspace — selected via the native file dialog or the "Select Workspace" menu
- Provider credentials — stored according to upstream guidance inside `DSH_HOME`

---

## Updating the upstream harness

Pin the harness version in `scripts/prepare-harness-runtime.mjs`:

```js
const DSH_VERSION = "0.3.0"; // update this
```

Then run `pnpm prepare:harness` to refresh bundled resources before building.

---

## Security

See [SECURITY.md](./SECURITY.md).

Key practices enforced by the desktop layer:

- Renderer runs with `contextIsolation: true` and `sandbox: true`; no Node.js access
- Local Harness service binds only to `127.0.0.1` on a random port per launch
- Launch tokens verify the health endpoint belongs to the current process
- Credentials and secrets are never written to renderer state or CI logs
- Diagnostic bundles are redacted before copying to the clipboard

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Desktop integration code: **MIT** (see [LICENSE](./LICENSE)).

Upstream Harness: **MIT** (see upstream repository). Third-party notices are included in the packaged artifacts.

---

## Acknowledgments

Built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) by DeepSeek. Packaging and desktop integration are maintained by the [NoWint](https://github.com/NoWint) community.
