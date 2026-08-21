# Docker 文档地图

现在有两套生产，命令不能混用。权威流程：[部署流程.md](部署流程.md)。

| | 线下 | 线上 |
|---|---|---|
| 在哪 | 本机 Windows Docker，`http://localhost:5173` | `/root/woeau_web/ai-selection-deploy` |
| 更新 | `deploy_prod.ps1 -Component ...` | 推阿里云镜像 → 改 `.env` 镜像变量 → `docker compose up -d` |
| Web 容器 | `prod-frontend` | `prod-frontend`（服务名 `frontend`） |

---

## 按任务打开哪一份

| 你要做的事 | 打开 |
|---|---|
| 线下生产构建 / 更新 / 回滚 | **[部署流程.md](部署流程.md)** 线下节 + `scripts/deploy/deploy_prod.ps1` |
| 线上更新（对方服务器） | **[部署流程.md](部署流程.md)** 线上节：改 `/root/woeau_web/ai-selection-deploy/.env` 后 `docker compose up -d` |
| 开发环境怎么起、怎么热更新 | [开发流程.md](开发流程.md) + `docker-compose.dev.yml` |
| Docker 磁盘、VHDX、卷保护 | [Docker存储优化.md](Docker存储优化.md) |
| 生产库往开发库拷数据 | [MySQL跨环境数据复制.md](MySQL跨环境数据复制.md) |
| SSH / 阿里云镜像仓库 / 远程机 | [ssh服务器链接.md](../ssh服务器链接/ssh服务器链接.md) |
| 给对方的远程部署包 | [deploy-remote/README.md](../../deploy-remote/README.md) |
| Dev 和 Prod 差异对照 | [开发规范-Dev与Prod差异.md](../development/开发规范-Dev与Prod差异.md) |
| 宿主端口 | [端口.md](../架构/端口.md) |

本目录不再保留历史方案、旧 README、旧踩坑总结。过时命令以 git 历史为准，不要再抄。

---

## 现网事实（2026-08-20）

### 生产（`docker-compose.prod.yml`）

项目名必须是目录默认值 `si-jue-zhi-mao-up`。**禁止 `-p sijuelishi-prod`。**  
禁止 `docker compose down -v`。

| 容器 | 镜像 | 宿主端口 |
|---|---|---|
| prod-frontend | prod-frontend:current | **5173**（浏览器入口，内置 Nginx） |
| prod-gateway | prod-java:current | 9003 |
| prod-java-user | prod-java:current | 8014 |
| prod-java-product | prod-java:current | 127.0.0.1:8025 |
| prod-backend | prod-backend:current | 127.0.0.1:7093 |
| prod-celery-download | prod-backend:current | 无 |
| prod-ai-center | prod-ai-center:current | 无（容器内 8012） |
| prod-mysql | mysql:8.0 | 3310 |
| prod-redis | redis:7-alpine | 6383 |
| prod-nacos | nacos/nacos-server:v2.3.1 | 8852 / 9852 |

四个业务仓库各留 `current` + `previous`。Java 三个服务共用 `prod-java`；API 和 Celery 共用 `prod-backend`。

流量：浏览器 → 前端 Nginx → Java 走 Gateway，其余 `/api/*` 走 Python。

日常发布只允许：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component frontend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component backend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component ai-center
```

推阿里云不是一个 `suezon/selection:v1.0`。2026-08-20 已用 `pengdongwg@163.com` 推送成功：

```text
prod-frontend:current   → registry.cn-shanghai.aliyuncs.com/suezon/selection:frontend-v1.0
prod-java:current       → registry.cn-shanghai.aliyuncs.com/suezon/selection:java-v1.0
prod-backend:current    → registry.cn-shanghai.aliyuncs.com/suezon/selection:backend-v1.0
prod-ai-center:current  → registry.cn-shanghai.aliyuncs.com/suezon/selection:ai-center-v1.0
```

以后更新只推改过的组件，例如只改了 Java：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
docker tag prod-java:current registry.cn-shanghai.aliyuncs.com/suezon/selection:java-v1.1
docker push registry.cn-shanghai.aliyuncs.com/suezon/selection:java-v1.1
```

线上：改 `/root/woeau_web/ai-selection-deploy/.env` 对应 `*_IMAGE`，然后 `docker compose up -d`。不要四个镜像每次全推。

### 开发（`docker-compose.dev.yml`）

入口 `http://localhost:6175`。默认不启 Gateway / Nacos，Java 直连。  
不要把服务绑到 Windows 排除段 `7998-8197`（所以宿主用 6175 / 18090 / 18001 / 18002 / 13338）。

| 服务 | 宿主端口 |
|---|---|
| 前端 Vite | 6175 |
| Python | 18090 |
| Java user | 18001 |
| Java product | 18002 |
| MySQL | 13338 |
| Redis | 6379 |

---

## 铁律（短）

1. 生产命令只从 [部署流程.md](部署流程.md) 抄，不从日志、OpenSpec、旧方案抄。
2. 前端生产构建在 Windows 宿主机 `npm run build`，不要在 Docker 里跑 Vite。
3. 改 `config/*.env` 必须 `up -d --force-recreate`，`restart` 不会重读 env。
4. 重建 backend / gateway 后，必要时 `docker restart prod-frontend`，避免 Nginx 缓存旧 IP。
5. 新增 Java `/api/v1/...` 必须同时改 Gateway 路由和 `frontend/nginx.conf`。
6. 分析数据禁止循环 `docker exec`，一次连接查完，避免打爆 WSL2。
