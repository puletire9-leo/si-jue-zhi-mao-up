# 密钥目录 (config/secrets/)

> ⛔ **此目录下的 `*.env` 文件绝对不进 git**。只有 `*.example` 进 git。

---

## 部署流程

### 开发环境

```bash
cp config/secrets/dev.env.example config/secrets/dev.env
# 编辑 dev.env, 填入开发用的密钥/test 密钥
```

### 生产环境

```bash
cp config/secrets/prod.env.example config/secrets/prod.env
# 编辑 prod.env, 填入生产真实密钥
```

---

## 密钥定义来源

| 密钥 | 用途 | 怎么拿 |
|------|------|--------|
| `JWT_SECRET` | JWT 签名 (HMAC-SHA256, ≥32 字符) | `openssl rand -base64 32` |
| `SECRET_KEY` | FastAPI session 加密 | `openssl rand -base64 32` |
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | 自己定义 |
| `MYSQL_PASSWORD` | sijue 用户密码 | 自己定义 |
| `COS_SECRET_ID` | 腾讯云 COS 密钥 ID | 腾讯云控制台 |
| `COS_SECRET_KEY` | 腾讯云 COS 密钥 KEY | 腾讯云控制台 |
| `RDS_PASSWORD` | RDS 领星/财务库密码（对应 public 的 RDS_HOST 等） | 阿里云 RDS |
| `USER_MYSQL_PASSWORD` | 登录库密码，写在 `user-prod.env` | 阿里云 RDS |
| `SELLERSPRITE_SECRET_KEY` | 卖家精灵 API key | 卖家精灵后台 |
| `LINGXING_APP_ID` / `LINGXING_APP_SECRET` | 领星开放平台 | 领星后台「设置 > 全局 > 开放接口」 |
| `LINGXING_MCP_URL` / `LINGXING_MCP_KEY` | 领星 MCP | 领星 ERP「AI助手 > 管理MCP」 |
| `BAZHUAYU_USERNAME` / `BAZHUAYU_PASSWORD` | 八爪鱼开放平台 | 八爪鱼控制台 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` | 飞书自建应用（Java 换 token） | 飞书开放平台 |
| `OPERATIONS_LOGISTICS_FEISHU_APP_TOKEN` | 运营物流多维表格 App Token | 飞书多维表格 URL |
| `FINANCE_DAILY_REPORT_FEISHU_APP_TOKEN` | 财务日报多维表格 App Token | 飞书多维表格 URL |
| `FEISHU_RDS_READONLY_PASSWORD` | 飞书连 RDS 只读账号密码 | 仅 `feishu_ro`，不要给飞书 `RDS_PASSWORD` |
| `DEEPSEEK_API_KEY` | DeepSeek 上游 API key (仅 ai-center 持有) | DeepSeek 平台 |
| `AI_CENTER_INTERNAL_KEY` | AI 请求中心内部鉴权 key (调用方持有, 与上游密钥隔离) | 本地生成: `openssl rand -hex 32` |
| `NACOS_AUTH_TOKEN` | Nacos 鉴权 token (可选) | Nacos 控制台 |

---

## 紧急情况

如果密钥泄露：
1. 立即去对应平台**轮换/吊销**旧密钥
2. 更新 `config/secrets/prod.env`
3. 完整阅读 `docs/docker使用经验/部署流程.md`，按受影响组件运行 `scripts/deploy/deploy_prod.ps1`；不得用 `restart` 跳过 env 重载、预检和验证
