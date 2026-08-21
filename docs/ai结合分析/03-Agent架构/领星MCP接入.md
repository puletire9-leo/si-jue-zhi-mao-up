# 领星 MCP 接入

## 定位

Python AI 后端作为领星官方 MCP 的客户端，通过 Streamable HTTP 做实时查询。
Java 领星中心继续负责批量同步、落库、加工和定时任务，两条链路互不替代。

## 配置

在领星 ERP 的「AI助手 > 管理MCP」获取 Server URL 和鉴权密钥，然后写入未纳入 Git 的环境文件：

```env
LINGXING_MCP_URL=https://...
LINGXING_MCP_KEY=...
```

开发环境使用 `config/secrets/dev.env`，生产环境使用 `config/secrets/prod.env`。禁止把真实 URL 或密钥写入源码、前端或 Git。

## API

所有接口都要求系统 JWT 登录态。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/lingxing-mcp/status` | 仅返回是否已配置，不暴露密钥 |
| GET | `/api/v1/lingxing-mcp/tools` | 实时读取官方工具及 inputSchema |
| POST | `/api/v1/lingxing-mcp/products/detail` | 调用 `erp_listing` 查询产品详情 |
| POST | `/api/v1/lingxing-mcp/tools/{tool}/call` | 调用系统只读白名单内的官方工具 |

产品详情请求示例：

```json
{
  "asin": "B0XXXXXXXX",
  "sid": 123456,
  "marketplace": "US",
  "arguments": {}
}
```

服务会先调用 `tools/list` 获取领星当前参数定义，再自动映射 ASIN、SKU、SID、站点和分页字段。若官方 schema 还有其他必填参数，接口返回 HTTP 422，并在 `detail.inputSchema` 中给出真实 schema；调用方随后通过 `arguments` 补充，避免依赖硬编码的第三方参数。

2026-08-17 实际联调确认：当前账号开放 44 个工具；`erp_listing` 使用 `search_field` + `search_value` 数组搜索产品，店铺参数为逗号分隔的 `sids`，`pvi_ids` 虽被 schema 标为必填但可传空字符串表示不筛选。该工具搜索时会返回目标记录及其他 Listing，服务层会对 MCP 结果二次解析并按 ASIN/SKU 精确过滤，`records` 只交付目标产品，同时在 `mcpResult` 保留原始结果供排障。

## 安全边界

- MCP URL 和 `X-Mcp-Key` 只存在后端环境变量中。
- 产品查询和通用工具调用都经过系统 JWT 鉴权。
- 通用调用只开放查询工具白名单；创建关键词、创建监控、增加或修改指标等写工具默认拒绝。
- 返回结果保留 MCP 原始 `content`，后续确认真实报文后再增加稳定的产品详情 DTO。
- 领星限制 QPS=1，当前接口不做并发批量查询。
