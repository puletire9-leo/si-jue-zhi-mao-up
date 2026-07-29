# Docker 部署指南

> 详细部署流程见 [docs/docker使用经验/部署流程.md](docs/docker使用经验/部署流程.md)

## 快速启动

```bash
# 生产环境
docker compose -f docker-compose.prod.yml up -d

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

## 生产 MySQL 资源保护

`docker-compose.prod.yml` 默认将 InnoDB Buffer Pool 设置为 `1G`，并把 MySQL
容器内存上限设置为 `2g`。需要按宿主机资源调整时使用环境变量覆盖：

```powershell
$env:MYSQL_INNODB_BUFFER_POOL_SIZE = "1G"
$env:MYSQL_MEMORY_LIMIT = "2g"
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate mysql
```

MySQL 健康检查执行真实的 `SELECT 1`，连接超时 1 秒、健康检查总超时 2 秒。
不要改回 `mysqladmin ping`：该命令在 InnoDB 查询线程阻塞时仍可能返回存活。

生产连接与重负载默认预算：

| 项目 | 默认值 |
|------|--------|
| MySQL `max_connections` | 60 |
| Java product Hikari | min 3 / max 15 |
| Java user Hikari | min 2 / max 5 |
| Python API aiomysql | min 3 / 基础 10 / overflow 5 |
| Celery 单任务 aiomysql | min 1 / max 2 |
| 数据库连接获取超时 | 5 秒 |
| 大型聚合查询 | 最多 2 个 |
| 全量 CSV 导出 | 最多 1 个，且占用大型查询槽 |
| 导入/评分/clean 批量写入 | 最多 1 个，公平排队 |

普通分页、详情、登录和小型 CRUD 不进入重负载门禁。八爪鱼云端等待仍可并行，
但进入“导入DB”阶段后必须通过单写入队列；卖家精灵请求中心继续使用现有单线程执行器。
