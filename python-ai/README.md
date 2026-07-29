# python-ai — AI 能力层

## 服务索引

| 目录 | 状态 | 说明 |
|------|------|------|
| [`ai-center/`](./ai-center/) | ✅ 生产 | 集中式 LLM 请求中心（OpenAI 兼容网关） |
| `litellm-official/` | 📚 本地研究 | LiteLLM 上游源码副本，不纳入版本控制 |
| `litellma请求中心/` | 📚 本地研究 | 早期研究目录，不纳入版本控制 |

---

## ai-center — 集中式 LLM 请求中心

**职责**：持有上游 LLM 密钥，提供统一的 OpenAI 兼容接口供内部服务调用。

```
调用方（任意内部 Agent）
        │  Bearer AI_CENTER_INTERNAL_KEY
        ▼
  ai-center:8012
  /v1/chat/completions
        │  Bearer DEEPSEEK_API_KEY
        ▼
  DeepSeek API
```

### 快速接入

调用方只需：

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["AI_CENTER_INTERNAL_KEY"],
    base_url="http://ai-center:8012/v1",
    max_retries=0,   # 由 Agent 自己控制重试
)
resp = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[{"role": "user", "content": "..."}],
)
```

### 环境变量

| 变量 | 持有方 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | ai-center 独有 | 上游 DeepSeek 密钥（`config/secrets/*.env`） |
| `DEEPSEEK_BASE_URL` | ai-center | 默认 `https://api.deepseek.com` |
| `AI_CENTER_INTERNAL_KEY` | ai-center + 调用方 | 内部鉴权凭据（`config/secrets/*.env`） |
| `AI_CENTER_BASE_URL` | 调用方 | `http://ai-center:8012`（`config/public/*.env`） |
| `AI_CENTER_ALLOWED_MODELS` | ai-center | 模型白名单，逗号分隔 |

### 本地调试

```bash
# 本地端口临时开放（不提交 compose 修改）
# docker-compose.dev.yml 中取消注释 ports: ["127.0.0.1:18012:8012"]

curl http://localhost:18012/health
curl http://localhost:18012/v1/chat/completions \
  -H "Authorization: Bearer dev-ai-center-internal-key-change-me" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek-v4-flash","messages":[{"role":"user","content":"hi"}]}'
```

### 接入 docker-compose

```yaml
your-new-agent:
  env_file:
    - ./config/public/dev.env     # 含 AI_CENTER_BASE_URL
    - ./config/secrets/dev.env    # 含 AI_CENTER_INTERNAL_KEY
  depends_on:
    ai-center:
      condition: service_healthy
```

### 测试

```bash
# 在 Docker 环境（Python 3.11）中运行测试
docker build -t ai-center:test ./python-ai/ai-center
docker run --rm --user root -w //app \
  -v "$(pwd)/python-ai/ai-center/tests:/app/tests:ro" \
  ai-center:test \
  sh -c "pip install --quiet 'pytest>=8.3' 'pytest-asyncio>=0.23' 'httpx>=0.27' 'asgi-lifespan>=2.1' && python -m pytest tests/ -v"
```

### 支持的参数

- 标准 OpenAI Chat Completions 字段（`messages`、`model`、`stream`、`tools`、`response_format` 等）
- DeepSeek 特有字段通过 `extra_body` 透传：`thinking`、`reasoning_effort`、`user_id` 等
- 流式：标准 SSE `data: {chunk}\n\n` + `data: [DONE]\n\n`，自动携带 `stream_options.include_usage`
