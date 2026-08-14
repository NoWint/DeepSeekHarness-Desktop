# Contributing to DeepSeek Harness Desktop

Thank you for considering contributing to this project!

## Getting started

1. **Fork** the repository and clone it locally.
2. **Install dependencies:** `pnpm install`
3. **Create a branch:** `git checkout -b feature/your-feature-name`
4. **Make changes** and ensure tests pass: `pnpm test`
5. **Commit** using conventional commits: `feat: add workspace persistence`
6. **Push** and open a pull request

## Development workflow

```bash
# Run the app in development mode
pnpm dev

# Type check and lint before committing
pnpm typecheck
pnpm lint
pnpm format:check

# Run tests
pnpm test
```

## Pull request guidelines

- Keep PRs focused on a single concern
- Include tests for new functionality
- Update documentation if behavior changes
- Follow the [conventional commits](https://www.conventionalcommits.org/) specification
- The PR template includes a checklist — complete all applicable items

## Code style

This project uses:
- **TypeScript** with strict compiler options
- **ESLint** with TypeScript ESLint recommended config
- **Prettier** for formatting
- **Vitest** for unit tests
- **Node test runner** for integration tests

## Architecture

The project follows a clean separation:

- **`src/main/`** — Electron main process: runtime management, menus, IPC handlers
- **`src/preload/`** — Typed IPC bridge: exposes only allowlisted APIs to renderer
- **`src/renderer/`** — React UI: desktop shell with status display and recovery
- **`src/shared/`** — Platform paths, IPC contracts, log redaction

The desktop layer intentionally does not modify upstream Harness code.

## Reporting issues

Use the appropriate issue template:
- **Bug report** — for unexpected behavior
- **Feature request** — for improvements or new features
- **Packaging/platform issue** — for build or OS-specific problems

## Security

See [SECURITY.md](./SECURITY.md) for responsible disclosure guidelines.

## License

By contributing, you agree that your contributions are licensed under the MIT License.
