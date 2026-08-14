name: Bug report
description: Report a bug or unexpected behavior
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: |
        ## Bug Report
        Please fill out the information below. The more detail you provide, the faster we can help.

  - type: input
    id: version
    attributes:
      label: Desktop App Version
      description: "What version of DeepSeek Harness Desktop are you running? (Check Help → About)"
      placeholder: "e.g., 0.1.0"
    validations:
      required: true

  - type: dropdown
    id: platform
    attributes:
      label: Platform
      options:
        - macOS (Apple Silicon)
        - macOS (Intel)
        - Windows
        - Linux (AppImage)
        - Linux (deb)
        - Other / Not sure
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: What happened?
      description: "Describe the bug clearly. What did you expect to happen?"
      placeholder: "I expected the app to start the Harness runtime, but it showed an error..."
    validations:
      required: true

  - type: textarea
    id: reproduction
    attributes:
      label: Steps to reproduce
      description: "Numbered steps to reproduce the behavior"
      placeholder: |
        1. Open the application
        2. Select a workspace
        3. Click Start Harness
        4. See error...
    validations:
      required: true

  - type: textarea
    id: logs
    attributes:
      label: Relevant logs and diagnostics
      description: |
        Paste any error messages, or run "Copy Diagnostics" from the app menu and paste here.
        (Sensitive information like API keys will be redacted automatically.)
      render: text
    validations:
      required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional context
      description: "Any other context about the problem (screenshots, workarounds, etc.)"
    validations:
      required: false
