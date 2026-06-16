# Docker 部署指南

> 详细部署流程见 [docs/docker使用经验/部署流程.md](docs/docker使用经验/部署流程.md)

## 快速启动

```bash
# 生产环境
docker compose -f docker-compose.prod.yml -p sijuelishi-prod up -d

# 开发环境
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## 配置

| 环境 | 配置文件 | 文档 |
|------|---------|------|
| 开发 | `docker-compose.yml` + `docker-compose.dev.yml` | — |
| 生产 | `docker-compose.prod.yml`（独立完整配置） | [部署流程.md](docs/docker使用经验/部署流程.md) |

## 关键变更

- **Java 多阶段构建**：`Dockerfile.prod` 已改为多阶段构建，`mvn package` 在 Docker 镜像内自动执行，无需宿主机手动编译
- **Celery Worker**：新增 `celery-download` 服务处理异步下载任务
- **旧配置标记**：`docker-compose.base.yml` 仅用于构建 Python 基础镜像

## 验证

```bash
docker compose -f docker-compose.prod.yml ps
```
