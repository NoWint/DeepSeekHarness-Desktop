# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a vulnerability

Please report security vulnerabilities responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security findings to the maintainers at the repository owner's contact
3. Include: affected version, platform, reproduction steps, and impact assessment
4. Allow reasonable time for a response before public disclosure

We aim to acknowledge reports within 48 hours and provide regular updates during investigation.

## Security measures in this project

- **Renderer isolation:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- **Loopback binding:** Harness HTTP service binds only to `127.0.0.1`
- **Launch tokens:** per-session random tokens verify health endpoint ownership
- **Secret redaction:** API keys, tokens, and credentials are redacted in logs and diagnostics
- **IPC allowlist:** only explicitly declared channels are accessible from the renderer
- **Navigation restrictions:** only verified local Harness URLs are allowed in the webview

## What to report

Report issues involving:
- Information disclosure (secrets in logs, clipboard, or crash reports)
- Privilege escalation via IPC
- Insecure communication (HTTP on non-loopback interfaces)
- Path traversal or arbitrary file access
- Supply chain compromises (malicious dependencies)

## What we don't cover

- Vulnerabilities in the upstream Harness runtime (report to [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness))
- Issues in third-party dependencies (report to the respective maintainers)
- Social engineering or phishing targeting users

## References

- [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html)
- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
