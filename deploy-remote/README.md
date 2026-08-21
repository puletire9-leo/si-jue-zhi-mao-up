# 思觉智贸远程部署（一份说明）

线上目录：`/root/woeau_web/ai-selection-deploy`（本仓库 `deploy-remote/` 整份拷过去）。不要从 git 拉：`config/secrets/*.env` 不进仓库。

Nginx 用对方已准备好的配置，不必用本目录 `nginx.host.conf`。

正式入口：`https://selection.suezon.com/ai-selection`。域名解析、外层 Nginx 和 SSL 证书均已配置完成；日常镜像更新不需要重复处理 SSL。

镜像：`registry.cn-shanghai.aliyuncs.com/suezon/selection`（`frontend-v1.0` / `java-v1.0` / `backend-v1.0` / `ai-center-v1.0`）。

---

## 目录

```text
deploy-remote/
  README.md                   本说明（只看这一份）
  docker-compose.yml          只拉镜像，不构建
  .env                        四个业务镜像 tag
  nginx.host.conf             备用，对方已有 Nginx 可忽略
  sql/init_ai_selection_slim.sql   瘦身库（结构全 + 产品样本，约 4MB）
  sql/import_host_mysql.sh         灌进宿主机 MySQL，不碰 RDS
  config/public/prod.env      MYSQL_* / REDIS_* / RDS_*
  config/public/user-prod.env USER_MYSQL_*（登录 RDS）+ 同组 MYSQL/REDIS
  config/secrets/prod.env     MYSQL_PASSWORD / RDS_PASSWORD / JWT / COS ...
  config/secrets/user-prod.env USER_MYSQL_PASSWORD / MYSQL_PASSWORD
```

---

## 三套库，不要混

| 用途 | 连哪 | 配置 |
|------|------|------|
| 业务选品（要灌 SQL 的） | 宿主机 MySQL `ai-selection` | `MYSQL_*`：`host.docker.internal:3306`，用户 `root` |
| 缓存 | 宿主机 Redis **2 号库** | `REDIS_HOST=host.docker.internal`，`REDIS_DB=2` |
| 登录用户 | 阿里云 RDS `ai_platform` | `USER_MYSQL_*` |
| 领星/财务/运营 | 同一台 RDS 的 `sijuelishi` | `RDS_*`（公网 IP `101.37.51.239`） |

主机名 `rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com` 和 `101.37.51.239` 是同一台 RDS。  
`application.yml` 只读环境变量，不要改。不要把 SQL 灌进 RDS。

---

## 按顺序做

### 1. 拷目录

整份放到 `/root/woeau_web/ai-selection-deploy`。必须带上 `config/secrets/*.env` 和 `sql/`。

### 2. 灌业务库（先于启动）

宿主机 MySQL 已有、库名将建成 `ai-selection`。Redis 已有，用 2 号库。

```bash
cd /root/woeau_web/ai-selection-deploy
chmod +x sql/import_host_mysql.sh
bash sql/import_host_mysql.sh
```

脚本读 `config/public/prod.env` + `config/secrets/prod.env`，连 `127.0.0.1:3306`，`CREATE DATABASE IF NOT EXISTS` 后导入 `sql/init_ai_selection_slim.sql`。  
内容：117 张表结构 + 配置小表 + 产品相关表每个站点最多 100 行。大表只建表不灌数。

手动等价：

```bash
mysql -h 127.0.0.1 -P 3306 -uroot -p'psw4mysql_optimiser' --default-character-set=utf8mb4 -e "CREATE DATABASE IF NOT EXISTS \`ai-selection\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -h 127.0.0.1 -P 3306 -uroot -p'psw4mysql_optimiser' --default-character-set=utf8mb4 ai-selection < sql/init_ai_selection_slim.sql
```

### 3. 拉镜像并启动

```bash
cd /root/woeau_web/ai-selection-deploy
mkdir -p data/nacos-logs data/nacos-data data/logs data/models data/download-cache
docker login --username=pengdongwg@163.com registry.cn-shanghai.aliyuncs.com
docker compose pull
docker compose up -d
docker compose ps
```

仓库密码见交付时口头/另发，不要写进公开 git。  
容器通过 `host.docker.internal` 访问宿主机 MySQL/Redis。改 env 必须 `up -d --force-recreate`，`restart` 不会重读。

### 4. 验证

```bash
docker exec prod-java-product printenv | grep -E 'MYSQL_HOST|MYSQL_DATABASE|REDIS_HOST|REDIS_DB|RDS_HOST'
docker exec prod-java-user printenv | grep USER_MYSQL
docker logs prod-java-product --tail 50 | grep SchemaGuard
```

页面走对方 Nginx 反代到 `127.0.0.1:5173`。登录 `admin` / `123456`（RDS 用户表）。

---

## 以后更新（线下推镜像，线上改 .env）

Web 容器就是 `frontend` / `prod-frontend`。容器名不用改。改 `/root/woeau_web/ai-selection-deploy/.env` 里的镜像变量：

```text
FRONTEND_IMAGE=.../selection:frontend-v1.1
JAVA_IMAGE=.../selection:java-v1.1
BACKEND_IMAGE=.../selection:backend-v1.1
AI_CENTER_IMAGE=.../selection:ai-center-v1.1
```

本机先 `deploy_prod.ps1 -Component ...`，再 `docker tag` + `docker push` 新 tag。服务器上：

```bash
cd /root/woeau_web/ai-selection-deploy
# 编辑 .env，只改推过的那一行
docker compose up -d
```

`up -d` 会拉新镜像并重启对应容器。`.env` 修改的是对应 `*_IMAGE` 的镜像地址/tag，不修改固定的 `prod-*` 容器名。不要四个每次全推。完整对照见 `docs/docker使用经验/部署流程.md` 的线下 / 线上两节。

---

## 不要做的事

- 不要把 SQL 灌进 RDS
- 不要 `docker compose down -v`
- 不要把 3310 / 6383 / 8014 / 9003 映射到 `0.0.0.0`
- 不要把 API 直接反代到 Java 或 Python
- 不要改 `application.yml` 里的数据库地址
