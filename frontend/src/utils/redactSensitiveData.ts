const REDACTED = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return (
    normalized === "authorization" ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token")
  );
}

function redactEmbeddedAssignments(value: string): string {
  return value.replace(
    /((?:app[_-]?secret|password|secret|access[_-]?token|refresh[_-]?token|token|authorization)\s*(?:=|:)\s*)(?:(?:bearer|basic)\s+)?(?:"[^"]*"|'[^']*'|[^&,\s}]+)/gi,
    `$1${REDACTED}`,
  );
}

function redactString(value: string, seen: WeakSet<object>): unknown {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return redactValue(JSON.parse(trimmed), seen);
    } catch {
      // 非法 JSON 按普通字符串脱敏。
    }
  }
  return redactEmbeddedAssignments(value);
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value, seen);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";

  seen.add(value);
  if (Array.isArray(value)) {
    const redacted = value.map((item) => redactValue(item, seen));
    seen.delete(value);
    return redacted;
  }

  const redacted: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, item]) => {
    redacted[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, seen);
  });
  seen.delete(value);
  return redacted;
}

/** 复制并递归脱敏日志数据，不修改原始请求/错误对象。 */
export function redactSensitiveData(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}
