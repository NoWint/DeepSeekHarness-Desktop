name: Feature request
description: Suggest an improvement or new feature
labels: ["enhancement"]
body:
  - type: markdown
    attributes:
      value: |
        ## Feature Request
        Thanks for taking the time to suggest an improvement!

  - type: textarea
    id: problem
    attributes:
      label: Problem statement
      description: "What problem would this feature solve?"
      placeholder: "Currently, I can't easily switch between workspaces..."
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed solution
      description: "How would you like this to work?"
      placeholder: "Add a workspace switcher in the dock/menu bar..."
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: "Any alternative approaches you've thought about?"
    validations:
      required: false

  - type: textarea
    id: context
    attributes:
      label: Additional context
      description: "Screenshots, mockups, or other context"
    validations:
      required: false
