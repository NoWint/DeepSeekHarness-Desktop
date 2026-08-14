name: Pull Request
description: Submit a pull request
body:
  - type: markdown
    attributes:
      value: |
        ## Pull Request Checklist
        Thanks for contributing! Please ensure your PR meets these requirements.

  - type: checkboxes
    id: checklist
    attributes:
      label: Pre-flight checklist
      options:
        - label: "Code follows the project's style (run `pnpm lint` and `pnpm format:check`)"
        - label: "Type checking passes (`pnpm typecheck`)"
        - label: "All tests pass (`pnpm test`)"
        - label: "I have tested the changes locally"
        - label: "I have updated documentation if needed"
        - label: "Changes are limited to the desktop integration layer (no upstream Harness modifications)"

  - type: input
    id: related
    attributes:
      label: Related issue
      description: "Link any related issues (e.g., #123)"
      placeholder: "#123"
    validations:
      required: false

  - type: textarea
    id: description
    attributes:
      label: Description
      description: "Briefly describe what this PR changes and why"
      placeholder: "This PR adds proper error handling for harness startup failures..."
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: Testing
      description: "How did you verify these changes work?"
      placeholder: "Ran on macOS with and without harness installed..."
    validations:
      required: true

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots (if UI changes)
      description: "Before/after screenshots for visual changes"
    validations:
      required: false
