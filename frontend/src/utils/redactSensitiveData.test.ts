import { describe, expect, it } from "vitest";
import { redactSensitiveData } from "./redactSensitiveData";

describe("redactSensitiveData", () => {
  it("recursively redacts credentials from a failed request log", () => {
    const redacted = redactSensitiveData({
      requestConfig: {
        headers: {
          Authorization: "Bearer access-token-value",
          "X-Trace-Id": "trace-123",
        },
        params: { refresh_token: "refresh-token-value", page: 1 },
        data: JSON.stringify({
          appId: "safe-app-id",
          appSecret: "secret-value",
          nested: [{ password: "password-value" }],
        }),
      },
      error: {
        stack: "Authorization: Bearer stack-token-value",
        response: { data: { token: "response-token", code: 500 } },
      },
    });

    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("secret-value");
    expect(serialized).not.toContain("password-value");
    expect(serialized).not.toContain("access-token-value");
    expect(serialized).not.toContain("refresh-token-value");
    expect(serialized).not.toContain("response-token");
    expect(serialized).not.toContain("stack-token-value");
    expect(serialized).toContain("safe-app-id");
    expect(serialized).toContain("trace-123");
    expect(serialized).toContain("[REDACTED]");
  });

  it("does not mutate the original value", () => {
    const source = { credentials: { secret: "keep-original" } };

    redactSensitiveData(source);

    expect(source.credentials.secret).toBe("keep-original");
  });
});
