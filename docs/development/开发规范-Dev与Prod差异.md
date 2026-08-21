# 开发模式与生产模式差异

> 生产命令仅作历史对照。当前生产构建、更新、回滚和清理一律以 `docs/docker使用经验/部署流程.md` 为准，并使用 `scripts/deploy/deploy_prod.ps1`；本文件中的旧项目名、`--no-cache` 或直接 `up` 示例不得执行。

> 开发环境和生产环境使用完全独立的 Docker Compose 编排，网络路由、端口、鉴权策略均不同。以下为逐项对照。

---

## 一、总览

| 维度 | 开发 (dev) | 生产 (prod) |
|------|-----------|------------|
| Compose 文件 | `docker-compose.dev.yml` | `docker-compose.prod.yml` |
| 项目名 | 目录默认名 | 必须是 `si-jue-zhi-mao-up`，**禁止 `-p sijuelishi-prod`** |
| 数据库 | `sijuelishi_dev` | `sijuelishi` |
| 容器名前缀 | `dev-` / `java-` | `prod-` |
| 容器数量 | 默认 8（无 gateway/nacos） | 10（含 celery-download、ai-center） |
| JWT 鉴权 | 开发直连 Java，不走 Gateway | **开启**（`GATEWAY_AUTH_ENABLED=true`） |
| 代码加载 | volume 挂载 → 热重载 | `COPY` bake 进镜像 |
| 调试模式 | `DEBUG=true` | `DEBUG=false` |

---

## 二、端口对照

| 服务 | Dev 宿主端口 | Prod 宿主端口 |
|------|-------------|--------------|
| 前端 | 6175（Vite） | 5173（Nginx） |
| Python Backend | 18090 | 127.0.0.1:7093 |
| Java User | 18001 | 8014 |
| Java Product | 18002 | 127.0.0.1:8025 |
| Gateway | 开发默认不启 | 9003 |
| MySQL | 13338 | 3310 |
| Redis | 6379 | 6383 |
| Nacos | 开发默认不启 | 8852 / 9852 |
| AI Center | 无对外 | 无对外 |

> 严禁在开发代码中硬编码端口。前端通过环境变量 `VITE_*` 注入，Java 通过 Spring 占位符 `${ENV:default}` 读取。

---

## 三、前端路由（核心差异）

### 开发模式

Vite 开发服务器内置代理，路由逻辑在 `vite.config.js`：

```
/api/v1/users      → java-product:8002  (直连)
/api/*             → backend:8090        (Python 兜底)
/dashboards/*      → backend:8090
```

- Java 路径**直连**微服务容器，不经过 Gateway
- Python 走 `VITE_BACKEND_HOST:VITE_BACKEND_PORT`

### 生产模式

Vite 只做构建，运行时由 Nginx (`frontend/nginx.conf`) 接管所有路由：

```
/api/v1/(auth|users)/                 → gateway:9000 → java-user:8001
/api/v1/(competitor|product-performance|category-baseline|category-dislocation|element-discovery|seller|filter-config|asin-import|scoring|filter-presets|sellersprite-config|click-logs|deng-zong-shop|blue-ocean|clean-layer|subcategory-alias|modules)/
                                        → gateway:9000 → java-product:8002
/api/v1/product-line/(aggregated-data|analysis-results|guidance|tree)
                                        → gateway:9000 → java-product:8002
/api/*                                  → backend:8090 (Python 兜底)
```

**关键规则：新增 Java API 路径必须同步更新两处——Gateway `application.yml` 的路由 + Nginx `frontend/nginx.conf` 的 Java 正则。**

---

## 四、Java 微服务

| 维度 | Dev | Prod |
|------|-----|------|
| 运行方式 | `mvn spring-boot:run` | `java -jar app.jar` |
| 代码来源 | volume 挂载 `./java-backend:/app` | `Dockerfile.prod` COPY |
| 热重载 | Maven devtools 检测变更 | 无 |
| 鉴权 | `GATEWAY_AUTH_ENABLED=false` | `true` |
| Nacos | 8848 | 8848（容器内 DNS） |

### Dev 环境须知

- 修改 Java 代码后，Maven 自动重编译（devtools），但**新增 Mapper 方法后需要重启对应服务**
- Dev 环境不启动 `java-user` 全功能，只用 `java-product`（前端直连 8002）
- Nacos 服务发现依赖容器名：`java-product:8002`、`java-user:8001`

---

## 五、Python 后端

| 维度 | Dev | Prod |
|------|-----|------|
| Dockerfile | `Dockerfile.dev` | `Dockerfile` |
| 基础镜像 | `sjzm-python-base` | `sjzm-python-base` |
| 端口 | 8090 | 7090 |
| 热重载 | `--reload --reload-dir app` | 无 |
| 源码 | `./backend/app:/app/app` 挂载 | `COPY . .` bake |
| Celery Worker | 无 | `celery-download` 容器 |

### Dev 环境须知

- 修改 Python 代码后 Uvicorn 自动重载（`--reload`）
- **新增 pip 依赖后必须重建基础镜像**：
  ```powershell
  docker build -t sjzm-python-base -f backend/Dockerfile.base backend
  ```
- 某些 Python 功能（下载任务、COS 图片处理）在 Dev 模式下不会触发 Celery，而是**同步执行**

---

## 六、前端构建

| 维度 | Dev | Prod |
|------|-----|------|
| 服务器 | Vite Dev Server | Nginx |
| 构建 | 无需构建（热模块替换） | `vite build --mode production` |
| 内存 | 2GB Node 限制 | 宿主机构建（Docker 内会 OOM） |

### Dev 环境须知

- Vite 通过 `--host 0.0.0.0 --port 8179` 暴露，**不是** `localhost:8179`
- 默认 `VITE_USE_GATEWAY=false`，前端直连 Java / Python / selection-agent，日常开发更快
- `VITE_USE_GATEWAY=true` 时前端走 Gateway 代理，用于联调网关或验证更接近生产的路由链路
- 环境变量在 `frontend/.env` 设置，`VITE_*` 前缀才会注入客户端代码

### Prod 构建须知

- **构建必须在宿主机执行**，Docker Desktop 内存不够 Vite 会 OOM
- 内存不足时使用 `--minify false` 跳过压缩
  ```powershell
  npx vite build --mode production --minify false
  ```
- 输出到 `static/vue-dist/`，由 Dockerfile `COPY` 进镜像

---

## 七、鉴权差异

| 维度 | Dev | Prod |
|------|-----|------|
| Gateway 鉴权 | `GATEWAY_AUTH_ENABLED=false` | `true` |
| JWT 校验 | **不校验** | 校验签名 + 过期 + 黑名单 |
| RBAC 权限 | 不拦截 | 按角色+路由权限检查 |
| 公开路径 | 全部放行 | 白名单：`/api/v1/auth/login`、`/api/v1/auth/register` 等 |

### 关键影响

- Dev 环境下 API 可以**不带 Token 直接调用**，生产不行
- 前端开发时如果 `VITE_USE_GATEWAY=false`（直连 Java），**完全不走 Gateway 鉴权**
- 切换 `VITE_USE_GATEWAY=true` 后可以验证 Gateway 路由，但开发环境默认仍是 `GATEWAY_AUTH_ENABLED=false`

---

## 八、数据库

| 维度 | Dev | Prod |
|------|-----|------|
| 库名 | `sijuelishi_dev` | `sijuelishi` |
| Root 密码 | `root` | `root123456` |
| 数据持久化 | named volume | named volume |

### 迁移须知

- 新 SQL 迁移文件放 `backend/migrations/`
- **Dev 和 Prod 的 SQL 迁移必须分别执行**，不会自动同步
- Prod 的表结构和 Dev 可能不同（如 `selection_products` 已在代码中改名但 Prod 尚未执行迁移）

---

## 九、环境变量

| 变量 | Dev 值 | Prod 值 |
|------|--------|---------|
| `ENVIRONMENT` | `development` | `production` |
| `DEBUG` | `true` | `false` |
| `MYSQL_DATABASE` | `sijuelishi_dev` | `sijuelishi` |
| `GATEWAY_AUTH_ENABLED` | `false` | `true` |
| `COS_BUCKET` | 无 | `sijuelishi-1328246743`（无 `-dev` 后缀） |
| `SPRING_PROFILES_ACTIVE` | `dev` | `prod` |
| `NACOS_SERVER_ADDR` | `nacos:8848` | `nacos:8848` |

> **COS_BUCKET 铁律**：生产 bucket 是 `sijuelishi-1328246743`，不能用宿主机的 `.env` 值（带 `-dev` 后缀）。

---

## 十、新增 API 检查清单

新增一个后端接口时，按以下列表逐项确认：

- [ ] **Java 侧**：`application.yml` Gateway routes 中注册了路径
- [ ] **Nginx**：如果走 Java → `frontend/nginx.conf` 正则中添加路径前缀
- [ ] **Nginx**：如果走 Python → 确认路径不在 Java 正则中（否则会被误路由到 Gateway）
- [ ] **Dev 测试**：默认先验证 `localhost:8179` 直连链路；涉及 Gateway / 生产链路时，再用 `VITE_USE_GATEWAY=true` 验证
- [ ] **前端**：API 路径不硬编码 Base URL，使用相对路径 `/api/v1/...`
- [ ] **鉴权**：公开接口需要在 Gateway `SecurityConfig` 中添加白名单
- [ ] **Prod 验证**：部署后浏览器 F12 网络面板确认请求路由到正确后端

---

## 十一、常见坑

1. **Dev 能跑、Prod 报 401** → 忘记在 Gateway 白名单加公开路径，或前端没带 Token
2. **Dev 能跑、Prod 报 404** → `frontend/nginx.conf` 没添加新路径前缀，请求被路由到错误的后端
3. **修改 Python 依赖后 Dev 不生效** → 忘记重建 `sjzm-python-base` 基础镜像
4. **Java 接口直连能通、走 Gateway 不通** → Gateway routes 没配或 `NACOS_ENABLED=true` 但 Service 没注册
5. **前端页面加载但 API 全挂** → Vite 构建时 `VITE_API_BASE_URL` 被错误设为了 localhost，Prod 应留空（用相对路径走 Nginx）
6. **图片上传成功但显示 403** → COS bucket 名用了 dev 后缀（`-dev`），应该用 `sijuelishi-1328246743`
