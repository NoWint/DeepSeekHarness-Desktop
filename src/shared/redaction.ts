const REDACTED = "[REDACTED]";
const credentialKeyPattern =
  /(?:api[-_]?key|authorization|credential|password|secret|token)/i;

// P1: Bearer tokens — preserve "Bearer " prefix, redact value
const p1 = /(\bBearer\s+)\S+/g;

// P2a: Compound identifiers with prefix (e.g. DEEPSEEK_API_KEY=xxx)
// g1 = full key, g2 = separator+whitespace (: or =), g3 = value
const p2a = /\b([A-Za-z][A-Za-z0-9_-]*(?:api[-_]?key|token|secret|password|credential)[A-Za-z0-9_-]*)([=:]\s*)(\S+)/gi;

// P2b: Standalone credential keywords (e.g. api_key: xxx, access_token: yyy)
// g1 = keyword, g2 = separator+whitespace, g3 = value
const p2b = /\b(api[-_]?key|access_token|credential|password|secret|token)([=:]\s*)(\S+)/gi;

export function redactText(text: string): string {
  let r = text;
  // P2b first: standalone keywords — preserve key+sep, redact value
  r = r.replace(p2b, (_m: string, g1: string, g2: string) => g1 + g2 + REDACTED);
  // P2a next: compound identifiers — skip if value is already redacted
  r = r.replace(p2a, (m: string, g1: string, g2: string, g3: string) =>
    g3 === REDACTED ? m : g1 + g2 + REDACTED,
  );
  // P1 last: Bearer tokens — preserve prefix, redact value
  r = r.replace(p1, (_m: string, g1: string) => g1 + REDACTED);
  return r;
}

export function redact(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);

  if (value instanceof Error) {
    return redactObject(
      {
        ...value,
        message: value.message,
        name: value.name,
      } as Record<string, unknown>,
      seen,
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (typeof value !== "object") return value;
  return redactObject(value as Record<string, unknown>, seen);
}

function redactObject(
  value: Record<string, unknown>,
  seen: WeakSet<object>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      credentialKeyPattern.test(key) ? REDACTED : redactValue(item, seen),
    ]),
  );
}
