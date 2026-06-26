import type { QualifyRule } from "./competitor";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  filterRules?: QualifyRule[];
}

export interface AgentChatResponse {
  model?: Record<string, any>;
  filterRules?: QualifyRule[];
}

const BASE = "/api/v1/product-line";

export async function chatStream(
  params: {
    nodeId: number;
    marketplace: string;
    messages: { role: string; content: string }[];
  },
  onDelta: (text: string) => void,
  onResult: (data: AgentChatResponse) => void,
  onError: (err: string) => void,
): Promise<void> {
  try {
    const token = localStorage.getItem("token") || "";
    const resp = await fetch(BASE + "/agent-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });

    if (!resp.ok) {
      onError(`请求失败: ${resp.status} ${resp.statusText}`);
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) {
      onError("响应流不可读");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const jsonStr = trimmed.slice(6);
        try {
          const data = JSON.parse(jsonStr);
          if (data.type === "delta") {
            onDelta(data.content || "");
          } else if (data.type === "result") {
            onResult({
              model: data.model,
              filterRules: data.filter_rules,
            });
          }
        } catch {
          // skip malformed SSE frames
        }
      }
    }
  } catch (err: any) {
    onError(err?.message || "未知错误");
  }
}
