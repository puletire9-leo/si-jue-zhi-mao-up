# 思觉智贸 - 跨境电商产品数据管理系统

**GitHub**: https://github.com/puletire9-leo/si-jue-zhi-mao-up

---

## 🚀 快速部署

### 方式一：生产环境（推荐）

```bash
git clone https://github.com/puletire9-leo/si-jue-zhi-mao-up.git
cd si-jue-zhi-mao-up
cp .env.example .env
# 编辑 .env 修改 SECRET_KEY（必须）
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

访问：**http://localhost**

### 方式二：开发环境

```bash
git clone https://github.com/puletire9-leo/si-jue-zhi-mao-up.git
cd si-jue-zhi-mao-up
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

访问：
- 前端：http://localhost:5173
- 后端：http://localhost:8001
- API 文档：http://localhost:8001/docs

---

## 📁 部署架构

```
前端 (Nginx) :80 ──┐
                   ├── docker network
后端 (FastAPI) :8000 ──┤
                       ├── MySQL :3306
                       ├── Redis :6379
                       └── Qdrant :6333
```

## 📂 配置文件

| 文件 | 用途 |
|------|------|
| `docker-compose.yml` | 基础配置（所有环境共享） |
| `docker-compose.dev.yml` | 开发环境覆盖 |
| `docker-compose.prod.yml` | 生产环境覆盖 |
| `.env` | 环境变量（敏感信息，不提交 Git） |
| `.env.example` | 环境变量模板 |

## 🔧 环境变量说明

```ini
# 数据库
MYSQL_PASSWORD=sijue123456    # MySQL 密码
MYSQL_DATABASE=sijuelishi     # 数据库名

# 安全（生产必须修改！）
SECRET_KEY=your-secret-key   # JWT 签名密钥

# COS（可选）
COS_ENABLED=false             # 是否启用腾讯云 COS
COS_SECRET_ID=xxx             # 腾讯云 SecretId
COS_SECRET_KEY=xxx            # 腾讯云 SecretKey
COS_BUCKET=xxx                # COS 存储桶
```

## 🛠️ 常用命令

```bash
# 启动
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 停止
docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# 重建
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 查看日志
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# 完全清理（⚠️ 数据丢失）
docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v
```

## 🔒 安全建议

1. 修改 `SECRET_KEY` 为随机字符串
2. 生产环境修改数据库密码
3. 启用 COS 时填写真实密钥
4. 配置防火墙，只开放 80/443 端口

---

## 技术栈

- **后端**：FastAPI + MySQL + Redis + Qdrant
- **前端**：Vue3 + TypeScript + Vite
- **存储**：腾讯云 COS
- **任务队列**：Celery

---

MIT License
