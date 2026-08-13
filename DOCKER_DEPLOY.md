# Docker 部署入口

> **唯一权威流程**：[docs/docker使用经验/部署流程.md](docs/docker使用经验/部署流程.md)。本文件只做索引，任何冲突均以该文件为准。生产部署不得跳过预检，不得从 README、日志、问题记录或旧架构文档复制命令。
> Docker 容量巡检、缓存清理和 VHDX 压缩见：[Docker存储优化.md](docs/docker使用经验/Docker存储优化.md)。

## 快速启动

```bash
# 生产发布：按实际变更范围只选一个组件；不要连续执行四条命令
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component frontend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component backend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component ai-center

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
- **生产镜像双版本**：应用镜像使用 `current` + `previous`，构建时短暂出现第三版，验证后只保留当前版和上一版；完整步骤见生产部署流程
- **Java 编译缓存双版本**：BuildKit 中本项目 `mvn clean package` 记录常态只保留最新 2 条；发布验证后必须运行 `scripts/deploy/prune_java_build_cache.ps1`

## 验证

```bash
docker compose -f docker-compose.prod.yml ps
```

统一脚本强制执行：生产预检、删除最老回退版、`current -> previous`、单次缓存构建、`--no-build` 重建、运行状态检查、Java 编译缓存保留两条及 24 小时冷缓存清理。禁止直接使用 `up -d --build` 或 `--no-cache` 绕过。

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

生产单机 MySQL 的 binlog 默认只保留 7 天（`MYSQL_BINLOG_EXPIRE_SECONDS=604800`），生产预检
强制要求保留期在 3-7 天、无复制通道且 binlog 总量不超过 5 GB。禁止直接删除数据卷内的
`binlog.*` 文件；详细操作见生产部署流程和数据库设计文档。

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
