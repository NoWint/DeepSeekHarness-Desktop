# DeepSeek Harness Desktop

Electron desktop shell for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

> **Note:** This is a desktop wrapper around `deepseek-harness`, which is currently in developer preview. Features may change without notice.

## What This Is

A cross-platform desktop client that:
- Launches the Harness server (`dsh web`) as a local background process
- Loads the Harness UI in a native Electron window
- Provides workspace selection, recent-project history, and diagnostics

The Harness runtime itself is the upstream `@deepseek-ai/dsh` package. This project adds the desktop shell around it.

## Prerequisites

- **Node.js 22.20.0+** (check `.node-version`)
- **pnpm 10.x** (via Corepack or manual install)
- **`dsh`** available on your PATH (install via `npm i -g @deepseek-ai/dsh`)

## Development

```bash
# Install dependencies
pnpm install

# Type check
pnpm typecheck

# Lint
pnpm lint

# Test
pnpm test

# Build
pnpm build

# Run in development mode
pnpm dev
```

## Building for Distribution

```bash
# Package for current OS
pnpm package

# Package for all platforms (requires platform-native runners)
pnpm package:all
```

Packaged artifacts are output to `out/`.

## Data Locations

| Item | macOS | Linux | Windows |
|------|-------|-------|---------|
| App data | `~/Library/Application Support/DeepSeek Harness/` | `~/.config/deepseek-harness/` | `%APPDATA%\DeepSeek Harness\` |
| Harness home (`DSH_HOME`) | app data + `/harness` | app data + `/harness` | app data + `\harness\` |
| Logs | app data + `/logs` | app data + `/logs` | app data + `\logs\` |

## Platform Support

| Platform | Architecture | Status |
|----------|-------------|--------|
| macOS | Apple Silicon, x64 | ✅ Supported |
| Windows | x64 | ✅ Supported |
| Linux | x64 | ✅ Supported |

**Note:** Sandboxing behavior differs by OS. Linux uses bubblewrap/Landlock where available. macOS uses `sandbox-exec`. Windows has no documented sandbox equivalent.

## Upstream Attribution

This project wraps [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) under MIT license. The desktop shell code is also MIT-licensed. See `THIRD_PARTY_NOTICES.md` for full dependency license attribution.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to contribute.

## License

MIT — see [LICENSE](./LICENSE)
