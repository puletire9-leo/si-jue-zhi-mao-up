# Docker 使用经验

本项目从零开始用 Docker 容器化部署，以下是踩过的坑和总结。

---

## 架构概览

```
docker-compose.dev.yml / docker-compose.prod.yml
    │
    ├── dev-mysql / prod-mysql     (MySQL 8.0)
    ├── dev-redis / prod-redis     (Redis)
    ├── java-product               (Spring Boot Java 后端)
    └── (dev-gateway)              (暂时停用，见 Gateway 章节)
```

开发环境前端（Vite）也在 Docker 里，源码通过 volume 挂载。浏览器访问 Vite，再由 Vite proxy 转发到 Java / Python 容器。

---

## Dev vs Prod 环境隔离

**两个独立的 compose 文件，不要混用：**

| 文件 | 用途 | 端口 |
|------|------|------|
| `docker-compose.dev.yml` | 本地开发 | Frontend:5175, Python:18090→8090, MySQL:3410→3306, Redis:6379, Java:18001/18002→8001/8002 |
| `docker-compose.prod.yml` | 生产部署 | MySQL:3306, Redis:6379, Java:8000 |

关键规则：
- 容器名加 `dev-` / `prod-` 前缀区分
- 网络分开：`dev-network` / `prod-network`
- 数据卷分开：`dev-mysql-data` / `prod-mysql-data`
- secret key 等敏感信息：dev 写死在 compose 里，prod 用 `${ENV_VAR}` 从环境变量读

```yaml
# dev: 直接写死方便调试
environment:
  SELLERSPRITE_SECRET_KEY: d03bb00611a44f9ca30bf58205ac0f00

# prod: 必须从环境变量读
environment:
  SELLERSPRITE_SECRET_KEY: ${SELLERSPRITE_SECRET_KEY:-}
```

---

## Java 多模块 Maven 项目容器化

### 关键：不在容器里编译

Maven 编译在宿主机完成（`compile.bat`），容器只跑编译好的 JAR。否则每个容器要带 Maven + 下载依赖，镜像体积爆炸。

### Dockerfile 结构

```dockerfile
# 基础镜像：只装 JRE，不装 JDK（减小体积）
FROM eclipse-temurin:17-jre

# 复制已编译的 JAR
COPY target/*.jar app.jar

# JVM 参数
ENTRYPOINT ["java", "-jar", \
    "-Xms256m", "-Xmx512m", \    # 内存限制
    "-Dfile.encoding=UTF-8", \    # 编码
    "/app/app.jar"]
```

### 踩坑：基础镜像选了 JDK 而非 JRE

第一次用了 `eclipse-temurin:17-jdk`，镜像多 200MB。后来拆出 `Dockerfile.base` 装 JRE，实际服务镜像从 base 继承。

### compile.bat 脚本

```batch
cd /d %~dp0
mvn clean compile package -DskipTests -T 4
```

注意点：
- `-T 4` 多线程编译，加速
- `-DskipTests` 跳过测试（测试在别处跑）
- 确保在 `java-backend/` 目录下执行

---

## MySQL 容器

### 初始化 SQL

MySQL 容器首次启动时自动执行 `/docker-entrypoint-initdb.d/` 下的 `.sql` 文件。

```yaml
volumes:
  - ./db/init:/docker-entrypoint-initdb.d  # 初始化脚本
  - dev-mysql-data:/var/lib/mysql          # 数据持久化
```

**注意：** 初始化脚本只在数据库**首次创建**时执行。如果数据卷已存在，脚本不会重新执行。

### 字符集

```yaml
command: --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

### 踩坑：`symbol` 列长度不够

API 返回 `symbol: "GBP"` 但表中 `symbol VARCHAR(2)` 只能存 2 个字符，导致数据截断报错。

解决：`ALTER TABLE competitor_products MODIFY symbol VARCHAR(10);`

教训：API 返回的字符串字段尽量用 `VARCHAR(50)` 以上，不要省。

### 查看数据库

```bash
# 进入 MySQL 容器
docker exec -it dev-mysql mysql -usijue -psijue123456 sijuelishi_dev

# 不进入容器直接执行 SQL
docker exec dev-mysql mysql -usijue -psijue123456 sijuelishi_dev -e "SELECT COUNT(*) FROM competitor_products;"
```

---

## 容器网络与通信

### 容器间通信用容器名

```yaml
# Java 连 MySQL：用容器名，不用 localhost
environment:
  DB_HOST: dev-mysql    # 容器名 = 主机名
  DB_PORT: 3306         # 容器内部端口，不是映射端口
```

**踩坑**：在 Java 代码里写 `localhost:3410` 连不上——容器内的 localhost 是容器自己，不是宿主机。容器间通信必须用容器名 + 内部端口。

### Vite 代理到容器

```js
// vite.config.js
proxy: {
  '/api/v1/competitor': {
    target: `http://${env.VITE_JAVA_HOST || 'localhost'}:${env.VITE_JAVA_PORT || '8002'}`,
    changeOrigin: true
  }
}
```

前端不在容器里，所以用 `localhost:映射端口`。

---

## 卷挂载与热重载

### ro 标签

```yaml
volumes:
  - ./sjzm-product/target:/app/target:ro  # ro = 只读，容器不能改宿主机文件
```

### 编译后重启

容器跑的是 JAR 包，无法热重载。流程：

```bash
cd java-backend
.\compile.bat         # 宿主机编译
docker restart java-product  # 重启容器
```

容器启动约 15-20 秒，期间 API 不可用。

---

## Gateway 依赖冲突

### 问题

Gateway 容器启动后收到请求即崩溃：

```
java.lang.NoSuchMethodError: 'java.util.Set org.springframework.http.HttpHeaders.headerSet()'
    at reactor.netty.http.server.HttpServer ...
```

### 根因

Spring Boot 3.2.5 的 `spring-web:6.1.6` 没有 `headerSet()` 方法（Spring 6.2+ 才有），但 `spring-cloud-starter-gateway:4.1.6` 自带的 `reactor-netty-http` 编译时引用了该方法。这是 Spring Cloud 2023.0.4 的已知 bug。

### 尝试过的修复（全部失败）

| 尝试 | 结果 |
|------|------|
| 删 Nacos 依赖 | 无效 |
| 删 LoadBalancer 依赖 | 无效 |
| 显式声明 spring-web 版本 | 无效 |
| 锁死 reactor-netty-http 到 1.1.17 | 无效 |
| 清 Maven 缓存重建 | 无效 |

### 最终方案

**暂时不用 Gateway**。Vite 代理直接连 java-product:8002。

### 正确的修复路径

升级 Spring Boot 到 3.3.x + Spring Cloud 2023.0.5+（Spring 官方已在 2023.0.5 修复此问题）。但需要全量重编译所有模块，约 1-2 小时。

### 教训

1. Spring Boot 和 Spring Cloud 版本必须对齐，差一个小版本就炸
2. 引入 Gateway 前先验证 `spring-boot-starter-webflux` + `spring-cloud-starter-gateway` 版本兼容
3. 一个 Java 服务不需要 Gateway。等服务拆分到 3-4 个再上

---

## 日常操作速查

```bash
# ========== 开发环境 ==========

# 启动所有服务
docker compose -f docker-compose.dev.yml up -d

# 停止
docker compose -f docker-compose.dev.yml down

# 查看日志
docker logs -f java-product --tail 100

# 编译 + 重启 Java
cd java-backend && .\compile.bat && docker restart java-product

# 重建镜像（改了 Dockerfile 时）
docker compose -f docker-compose.dev.yml build java-product
docker compose -f docker-compose.dev.yml up -d

# 完全重建（删数据卷）
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d

# ========== 数据库 ==========

# 进入 MySQL
docker exec -it dev-mysql mysql -usijue -psijue123456 sijuelishi_dev

# 执行 SQL 文件
docker exec -i dev-mysql mysql -usijue -psijue123456 sijuelishi_dev < script.sql

# 备份数据库
docker exec dev-mysql mysqldump -usijue -psijue123456 sijuelishi_dev > backup.sql

# 恢复数据库
docker exec -i dev-mysql mysql -usijue -psijue123456 sijuelishi_dev < backup.sql

# ========== 调试 ==========

# 查看所有容器状态
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 进入容器
docker exec -it java-product /bin/bash

# 查看容器资源占用
docker stats --no-stream
```

---

## 前端容器化（2026-05 更新）

### 现状：前端也在 Docker 里了

之前文档说"前端不在 Docker 里"，现在 dev 和 prod 都在容器中：

| 环境 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| dev | `node:20-alpine` | 5175 | Vite dev server，源码 volume 挂载 |
| prod | `nginx:alpine` | 5173→80 | Nginx 服务静态文件 + API 代理 |

### 生产构建禁止在 Docker 内执行

**这是最重要的新规则。** Docker Desktop 默认给 Linux VM 分配约 2GB 内存，但 Vite 构建（Element Plus + ECharts + 27 页面）内存峰值远超此值，导致 Node 进程被 OOM Kill（exit code 137），严重时 Docker 守护进程直接崩溃。

**正确做法：在宿主机构建：**

```powershell
cd E:\项目\si-jue-zhi-mao-up\frontend
npm run build
```

输出到 `static/vue-dist/`，prod-frontend 容器通过 volume 直接挂载：

```yaml
volumes:
  - ./static/vue-dist:/usr/share/nginx/html:ro
```

docker-compose.dev.yml 已添加 `NODE_OPTIONS: --max-old-space-size=2048` 防止 dev server 也 OOM。

Windows 上不要把开发服务映射到 8001/8002/8090/8179/8180 这类宿主端口。它们可能落入系统 excluded port range，Docker 会报 `ports are not available`。

---

## Docker 磁盘管理

### 构建缓存会无限膨胀

每次 `docker build` 留下层缓存，旧层不自动清理。项目运行一段时间后达到 **35.91 GB**。

### 清理命令

```bash
# 清理未使用的构建缓存（保留正在用的层）
docker builder prune -f

# 查看磁盘占用
docker system df
```

清理后从 35.91GB 降到 15.19GB（释放 20.72GB）。

### 其他大项

| 项目 | 大小 | 建议 |
|------|------|------|
| 旧项目镜像（未在使用） | ~6 GB | `docker image prune -a` |
| 孤立 volume | ~830 MB | `docker volume prune` |
| 停止的容器 | ~10 MB | `docker container prune` |

---

## 微服务注册中心：Nacos

### 为什么需要

sjzm-product、sjzm-user、sjzm-gateway 三个 Java 微服务通过 Nacos 互相发现。

```yaml
nacos:
  image: nacos/nacos-server:v2.3.1
  environment:
    - MODE=standalone
    - PREFER_HOST_MODE=hostname
```

### 注意点

- Gateway 依赖 Nacos 就绪后才能启动，但 Nacos 启动慢（~30s），compose 用 `depends_on: service_started` 而非 `service_healthy`
- Nacos 日志和数据用独立 volume，不要丢
- Dev 和 Prod 的 Nacos 端口不同：`8848` / `8852`

---

## 双后端架构：Python + Java

项目同时运行 Python（FastAPI + Celery）和 Java（Spring Boot）两个后端：

| 服务 | 技术 | 端口 |
|------|------|------|
| backend | Python FastAPI | 18090→8090(dev) / 7093→8090(prod) |
| celery-download | Python Celery | 仅 prod，独立队列 |
| java-user | Spring Boot | 18001→8001(dev) / 8014→8001(prod) |
| java-product | Spring Boot | 18002→8002(dev) / 8025→8002(prod) |
| gateway | Spring Cloud Gateway | 9000(dev) / 9003(prod) |

### Celery worker 独立部署

下载任务用独立 Celery worker（`-Q download_tasks`），不与 AI 任务混用队列。配置：

```yaml
celery-download:
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2 --max-tasks-per-child=10 -Q download_tasks
```

- `--concurrency=2`：同时 2 个下载任务
- `--max-tasks-per-child=10`：每 10 个任务重启子进程，防止内存泄漏

---

## 数据库密码

### Dev 和 Prod root 密码不同

| 环境 | root 密码 | 数据库 |
|------|-----------|--------|
| dev | `root` | `sijuelishi_dev` |
| prod | `root123456` | `sijuelishi` |

普通用户 `sijue` 密码都是 `sijue123456`。

### 中文 SQL 执行

PowerShell 管道传中文 SQL 到 `docker exec mysql` 会导致编码损坏（`???`）。正确做法：

```bash
# 先 cp 进容器，再在容器内执行
docker cp script.sql dev-mysql:/tmp/
docker exec dev-mysql sh -c "mysql -uroot -proot --default-character-set=utf8mb4 sijuelishi_dev < /tmp/script.sql"
```

---

## 容器重启 vs 重建

### `docker restart` ≠ `docker compose up -d`

关键区别：

| 命令 | 行为 |
|------|------|
| `docker restart` | 停止+启动进程，**不重跑** entrypoint/command |
| `docker compose up -d` | 检测配置变化，有变化才重建 |
| `docker compose up -d --force-recreate` | 强制重建，**重跑** command |

**对于 dev 模式的 Java 容器**（command 里含 `mvn install && java -jar`），只有 `--force-recreate` 才会重新编译。

### 改端口/环境变量后

只改端口映射或环境变量，用 `docker compose up -d` 即可。改了代码，dev 模式需要 `--force-recreate`，prod 模式需要先构建 JAR 再 restart。

---

## 跨服务 JWT 一致性

### Python 和 Java 必须用相同密钥

如果 Python 后端签发 JWT token，但 Java 后端验证时密钥不同，所有请求返回 403。

**修复：** 在 docker-compose.dev.yml 的 backend（Python）环境中加上：

```yaml
environment:
  - JWT_SECRET=sjzm-dev-jwt-secret-change-in-production
```

与 java-user 保持一致。修复后需要重新登录获取新 token。

---

## Docker 镜像迁移

### 整站搬到另一台电脑

```bash
# 导出所有镜像（压缩）
docker save $(docker images -q) | gzip > all-images.tar.gz

# 导出数据库
docker exec dev-mysql mysqldump -uroot -proot sijuelishi_dev > dev-db.sql

# 导出 volumes（用临时 alpine 容器）
docker run --rm -v volume_name:/data -v $(pwd):/backup alpine tar czf /backup/vol.tar.gz -C /data .

# 新机器恢复
docker load -i all-images.tar.gz
docker exec -i dev-mysql mysql -uroot -proot < dev-db.sql
docker run --rm -v volume_name:/data -v $(pwd):/backup alpine tar xzf /backup/vol.tar.gz -C /data
```

### 哪些值得迁移

| 数据 | 大小 | 优先级 |
|------|------|--------|
| 镜像 | ~5 GB（压缩后） | 必须 |
| MySQL dump | ~300 MB（压缩后 48 MB） | 必须 |
| Nacos 配置 | ~1 MB | 推荐 |
| Maven 缓存 | ~700 MB | 可选（省首次构建时间） |

---

## 经验总结

1. **不要在 Docker 里跑前端生产构建** — 内存不够，宿主机跑
2. **dev 和 prod 完全隔离** — 独立的 compose 文件、网络、卷、端口
3. **容器间通信用容器名 + 内部端口**
4. **定期清理构建缓存** — `docker builder prune -f`
5. **改配置用 `docker compose up -d`，改代码用 `--force-recreate`**
6. **跨服务 JWT 密钥必须一致**
7. **中文 SQL 不要用管道传，用 docker cp + sh -c**
8. **SQL 表字段宁大勿小** — API 返回的字符串用 VARCHAR(50) 起步
9. **Spring Boot + Spring Cloud 版本精确对齐**
10. **Maven 编译在容器内（dev）或宿主机（prod），不要混用**
