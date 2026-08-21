# 飞书请求中心（sjzm-product/modules/feishu）

> 2026-08-13 建。系统主动调飞书开放平台 API 的统一封装，仿 `modules/lingxing` 模式。
> 与卖家精灵 `modules/requestcenter` 是同类"请求中心"的不同实例。
> 财务/运营飞书投递、幂等绑定和前端对接中心，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

## 一、结构

| 层 | 类 | 职责 |
|----|-----|------|
| config | `config/FeishuConfig` | `@ConfigurationProperties(prefix="feishu")`：appId/appSecret/baseUrl/超时，env 注入 |
| service | `service/FeishuConfigService` | 凭证读取：**env 为主，api_config 表可覆盖**（仿 LingxingConfigService，复用 ApiConfigMapper）|
| service | `service/FeishuClient` | 核心：tenant_access_token 缓存/刷新 + 通用 get/post + 多维表格 CRUD |
| controller | `controller/FeishuController` | `/api/v1/modules/feishu`：token 自检 + 多维表格接口 |

> 本模块**无 mapper**（不落库），故无需改 `ProductApplication.@MapperScan`。若后续要落请求记录，新增 mapper 必须在启动类显式注册（铁律）。

## 二、凭证

- env：`config/secrets/prod.env` 的 `FEISHU_APP_ID` / `FEISHU_APP_SECRET`（Spring 松绑定到 feishu.appId/appSecret）
- 运行时可被 `api_config` 表覆盖（key: `feishu_app_id` / `feishu_app_secret`）
- 凭证总账另存 RDS `system_config` 表（category=feishu）
- 当前 App：`cli_a94659ed3b79dbd4`（机器人"ai机器人"，品牌 feishu 国内，2026-08-17 生产切换并验证通过）


## 三、tenant_access_token

- 端点：`POST /open-apis/auth/v3/tenant_access_token/internal`，body 传 app_id+app_secret，**无签名**（比领星简单）
- 2026-08-13 实测返回 `code:0` + token + expire(7200s)
- 缓存：过期前 5 分钟自动刷新；业务调用遇 token 失效码（99991663/99991661/99991664）强制刷新重发（最多 1 次）
- token 不落明文日志

## 四、已封装的多维表格（Bitable）方法

- `listTables(appToken)` — 列数据表
- `listRecords(appToken, tableId, pageSize, pageToken)` — 查记录（分页）
- `createRecord(appToken, tableId, fields)` — 新增一条
- `batchCreateRecords(appToken, tableId, records)` — 批量新增

通用 `get(path, query)` / `post(path, body)` 可调飞书任意开放接口，自动带 Bearer token。

## 五、接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/modules/feishu/token/self-check` | 换 token 验证凭证与网络 |
| GET | `/api/v1/modules/feishu/config/status` | 凭证配置状态（仅掩码，不回显密钥） |
| PUT | `/api/v1/modules/feishu/credentials` | 更新 App ID / Secret（空字段保持原值） |
| GET | `/api/v1/modules/feishu/resources` | 财务、运营业务资源配置状态 |
| GET | `/api/v1/modules/feishu/resources/{code}/self-check` | 使用后端 App Token 检查资源连通性 |
| GET | `/api/v1/modules/feishu/bitable/{appToken}/tables` | 列数据表 |
| GET | `/api/v1/modules/feishu/bitable/{appToken}/tables/{tableId}/records` | 查记录 |
| POST | `/api/v1/modules/feishu/bitable/{appToken}/tables/{tableId}/records` | 新增记录（body=fields） |

> appToken 只存在后端环境配置。状态接口只返回掩码，前端不保存或回显明文。

## 六、网络

飞书 API 需出网。生产服务器出网由部署环境保证（代码不写代理）。本机调试走代理 `127.0.0.1:7890`。
