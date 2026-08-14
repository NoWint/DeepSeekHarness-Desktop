# Contributing to DeepSeek Harness Desktop

## How to Contribute

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make changes with tests
4. Run `pnpm test && pnpm lint && pnpm typecheck` — all must pass
5. Commit with [Conventional Commits](https://www.conventionalcommits.org/)
6. Push and open a Pull Request

## Development Setup

```bash
git clone https://github.com/NoWint/DeepSeekHarness-Desktop.git
cd DeepSeekHarness-Desktop
pnpm install
pnpm dev
```

## Commit Convention

- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `test:` — test changes
- `docs:` — documentation
- `chore:` — build/tooling

## Security

**Never** paste API keys, tokens, or credentials into issues or PRs. The diagnostic system redacts secrets automatically — if you see secrets in logs, report it.

## Testing

```bash
pnpm test      # Unit and integration tests
pnpm build     # Full build
pnpm package   # Package for current platform
```
