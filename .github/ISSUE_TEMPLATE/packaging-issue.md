name: Packaging / Platform issue
description: Report build or packaging problems on a specific platform
labels: ["packaging", "platform"]
body:
  - type: markdown
    attributes:
      value: |
        ## Packaging / Platform Issue
        Use this template for issues with building, packaging, or running on a specific OS.

  - type: dropdown
    id: platform
    attributes:
      label: Platform
      options:
        - macOS (Apple Silicon)
        - macOS (Intel)
        - Windows
        - Linux
    validations:
      required: true

  - type: dropdown
    id: issue-type
    attributes:
      label: Issue type
      options:
        - Build fails locally
        - CI build fails
        - Packaged app won't launch
        - Crash on startup
        - Native module missing
        - Other
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: "What happens? What did you expect?"
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Build / error logs
      description: "Paste the relevant error output or build logs"
      render: text
    validations:
      required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional context
      description: "OS version, Node version, Electron version, etc."
    validations:
      required: false
