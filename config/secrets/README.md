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
| `SELLERSPRITE_SECRET_KEY` | 卖家精灵 API key | 卖家精灵后台 |
| `DEEPSEEK_API_KEY` | DeepSeek 上游 API key (仅 ai-center 持有) | DeepSeek 平台 |
| `AI_CENTER_INTERNAL_KEY` | AI 请求中心内部鉴权 key (调用方持有, 与上游密钥隔离) | 本地生成: `openssl rand -hex 32` |
| `NACOS_AUTH_TOKEN` | Nacos 鉴权 token (可选) | Nacos 控制台 |

---

## 紧急情况

如果密钥泄露：
1. 立即去对应平台**轮换/吊销**旧密钥
2. 更新 `config/secrets/prod.env`
3. 完整阅读 `docs/docker使用经验/部署流程.md`，按受影响组件运行 `scripts/deploy/deploy_prod.ps1`；不得用 `restart` 跳过 env 重载、预检和验证
