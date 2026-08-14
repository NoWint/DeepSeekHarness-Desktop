import { describe, expect, it } from "vitest";

import { redact, redactText } from "./redaction.js";

describe("redactText", () => {
  it("redacts API key assignments and Bearer authorization headers", () => {
    const text =
      "DEEPSEEK_API_KEY=sk-super-secret Authorization: Bearer bearer-secret";

    expect(redactText(text)).toBe(
      "DEEPSEEK_API_KEY=[REDACTED] Authorization: Bearer [REDACTED]",
    );
  });

  it("redacts credential file content without exposing its value", () => {
    const text =
      "loaded /Users/ada/.credentials.yaml:\napi_key: top-secret\naccess_token: token-secret";

    const redacted = redactText(text);

    expect(redacted).toContain("/Users/ada/.credentials.yaml:");
    expect(redacted).not.toContain("top-secret");
    expect(redacted).not.toContain("token-secret");
    expect(redacted).toContain("api_key: [REDACTED]");
    expect(redacted).toContain("access_token: [REDACTED]");
  });
});

describe("redact", () => {
  it("replaces credential fields recursively while preserving object and array shape", () => {
    const diagnostic = {
      cause: {
        authorization: "Bearer nested-secret",
        context: {
          apiKey: "api-secret",
          safe: "retain this value",
        },
      },
      kind: "runtime-error",
      recent: [{ password: "password-secret", sequence: 1 }],
    };

    expect(redact(diagnostic)).toEqual({
      cause: {
        authorization: "[REDACTED]",
        context: {
          apiKey: "[REDACTED]",
          safe: "retain this value",
        },
      },
      kind: "runtime-error",
      recent: [{ password: "[REDACTED]", sequence: 1 }],
    });
  });

  it("preserves nested Error diagnostics and redacts their secret-bearing fields", () => {
    const error = Object.assign(new Error("request failed"), {
      cause: {
        api_key: "nested-api-secret",
        detail: "Authorization: Bearer nested-bearer-secret",
      },
      response: {
        headers: {
          authorization: "Bearer response-secret",
        },
      },
    });

    const redacted = redact({ error });

    expect(redacted).toEqual({
      error: {
        cause: {
          api_key: "[REDACTED]",
          detail: "Authorization: Bearer [REDACTED]",
        },
        message: "request failed",
        name: "Error",
        response: {
          headers: {
            authorization: "[REDACTED]",
          },
        },
      },
    });
  });
});
