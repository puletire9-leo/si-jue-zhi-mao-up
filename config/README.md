# 配置中心 (config/)

> 所有环境变量、密钥的**唯一入口**。代码通过 `env_file` 读取这些文件，**不要在源码里硬编码任何配置或密钥**。

---

## 文件结构

```
config/
├── README.md                   # 本文件
│
├── public/                     # 非敏感配置 (进 git)
│   ├── dev.env                 # 开发环境
│   └── prod.env                # 生产环境
│
└── secrets/                    # 真实密钥 (不进 git, 仅在部署机存在)
    ├── README.md
    ├── dev.env.example         # 开发密钥模板
    ├── dev.env                 # ⛔ 不进 git
    ├── prod.env.example        # 生产密钥模板
    └── prod.env                # ⛔ 不进 git
```

---

## 使用规则

### 1. 添加新配置

| 类型 | 加在哪 |
|------|--------|
| 服务端口、超时、白名单 | `config/public/{dev,prod}.env` |
| API key、密码、JWT secret、飞书 App Token | `config/secrets/{dev,prod}.env` |
| 飞书多维表格 **表 ID**（非 Token） | `config/public/{dev,prod}.env` |

生产数据库连接与门禁配置统一放在 `config/public/prod.env`：
`MYSQL_*_POOL_*` 控制各服务连接池，`DB_HEAVY_QUERY_MAX_CONCURRENCY`、
`DB_EXPORT_MAX_CONCURRENCY`、`DB_HEAVY_WRITE_MAX_CONCURRENCY` 控制重负载并发。

### 2. docker-compose 引用

```yaml
services:
  backend:
    env_file:
      - ./config/public/prod.env       # 非敏感先加载
      - ./config/secrets/prod.env      # 密钥后加载,覆盖示例值
```

### 3. 代码读取

不要在代码里 `os.getenv("XXX", "硬编码默认值")` —— 默认值放配置文件里。

```python
# ✗ 不要这样
api_key = os.getenv("DEEPSEEK_API_KEY", "sk-xxx")  # 默认值绝对禁止

# ✓ 这样
api_key = os.environ["DEEPSEEK_API_KEY"]  # 找不到就报错,促使你检查配置
```

### 4. 部署机首次配置

```bash
# 1. 复制密钥模板
cp config/secrets/prod.env.example config/secrets/prod.env

# 2. 填入真实值
vim config/secrets/prod.env

# 3. 按唯一生产流程发布，不得直接启动绕过预检
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component backend
```

---

## .gitignore 策略

整个 `config/secrets/*.env` 全部被 git 忽略 (但保留 `.example`)。

```
# .gitignore
config/secrets/*.env
!config/secrets/*.env.example
```

---

## 迁移自旧配置

| 旧位置 | 新位置 |
|--------|--------|
| `.env` (根目录) | `config/public/dev.env` + `config/secrets/dev.env` |
| `.env.local` | `config/public/dev.env` + `config/secrets/dev.env` |
| `.env.prod` | `config/public/prod.env` |
| `.env.prod.secrets` | `config/secrets/prod.env` |
| `backend/.env` | 已合入 `config/secrets/dev.env` |
| `backend/.env.production` | 已合入 `config/{public,secrets}/prod.env` |

---

## 相关文档

- [部署流程](../docs/docker使用经验/部署流程.md)
- [开发规范-Dev与Prod差异](../docs/development/开发规范-Dev与Prod差异.md)
