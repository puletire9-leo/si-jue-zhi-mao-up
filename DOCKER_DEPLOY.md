# 思觉智贸 - Docker 部署指南

## 概述

思觉智贸采用 **单一架构 + 环境覆盖** 的 Docker 部署模式。

```
旧方案（已废弃）:
  development/  ← 另一套代码
  production/   ← 另一套代码
  ❌ 同步困难、容易出错

新方案（当前）:
  docker-compose.yml      ← 共享基础配置
  docker-compose.dev.yml  ← 开发覆盖
  docker-compose.prod.yml ← 生产覆盖
  ✅ 一套代码，配置驱动
```

## 环境差异

| 维度 | 开发环境 | 生产环境 |
|------|---------|---------|
| 端口 | 8001 (后端) / 5173 (前端) | 8000 (后端) / 80 (前端) |
| 数据库 | sijuelishi_dev | sijuelishi |
| Redis DB | 0/3/4 | 0/1/2 |
| Qdrant 集合 | designs_dev | designs |
| 热重载 | ✅ 开启 | ❌ 关闭 |
| 速率限制 | ❌ 关闭 | ✅ 开启 |
| 源码挂载 | ✅ ./backend:/app | ❌ 只读镜像 |
| 日志级别 | DEBUG | INFO |

## 部署步骤

### 1. 拉取代码

```bash
git clone https://github.com/puletire9-leo/si-jue-zhi-mao-up.git
cd si-jue-zhi-mao-up
```

### 2. 配置环境变量

```bash
cp .env.example .env
nano .env   # 修改 SECRET_KEY 和密码
```

### 3. 启动服务

**开发环境：**
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

**生产环境：**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 4. 验证

```bash
# 查看服务状态
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# 健康检查
curl http://localhost:8000/health
```

## 数据持久化

所有数据使用 Docker Volumes 持久化：

- `mysql_data` / `mysql_dev_data` — MySQL 数据
- `redis_data` / `redis_dev_data` — Redis 数据
- `qdrant_data` / `qdrant_dev_data` — Qdrant 向量数据
- `backend_logs` — 后端日志
- `backend_models` — AI 模型缓存

## 故障排查

```bash
# 进入后端容器
docker exec -it sijue-backend bash

# 进入 MySQL
docker exec -it sijue-mysql mysql -u sijue -p

# 查看后端日志
docker compose logs backend

# 重启服务
docker compose restart backend
```

## 更新部署

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
