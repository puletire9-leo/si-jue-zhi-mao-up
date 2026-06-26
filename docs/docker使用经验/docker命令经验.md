
# 思觉智贸 — 环境管理

## 生产环境

### 启动

```powershell
docker compose -f docker-compose.prod.yml -p sijuelishi-prod up -d
```

### 停止

```powershell
docker compose -f docker-compose.prod.yml -p sijuelishi-prod down
```

### 查看状态

```powershell
docker compose -f docker-compose.prod.yml -p sijuelishi-prod ps
docker stats --no-stream
```

### 更新 Java 后端

```powershell
cd java-backend
.\compile.bat
docker restart prod-java-product   # 也可重启 prod-java-user / prod-gateway
```

> **注意：** 如果改了 Gateway 路由配置（`application.yml` 中的 routes），需要同时重启 `prod-gateway`。

### 更新前端

```powershell
cd frontend
npm run build
# 构建输出到 ../static/vue-dist/，nginx 自动生效，无需重启
```

> **⚠️ 构建 OOM 解决方案：** 如果 `npm run build` 报内存不足（JavaScript heap out of memory），用 `--minify false` 跳过压缩（terser 是最耗内存的步骤）：
>
> ```powershell
> cd frontend
> $env:NODE_OPTIONS="--max-old-space-size=2048"
> npx vite build --mode production --minify false
> ```
>
> 产物体积会大一些（未压缩），但功能完全一致，nginx 的 gzip 传输不受影响。

> **⚠️ 页面空白 / MIME 类型错误：** 如果部署后页面空白，浏览器控制台报 `Failed to load module script: MIME type of "text/html"`，说明 **JS 文件 hash 冲突**。
>
> **原因：** Vite 构建的文件名包含内容 hash（如 `index-DExB0VdV.js`），旧文件没有被清理，新文件 hash 不同导致找不到，nginx 返回 HTML 而不是 JS。
>
> **解决：** 构建前清理旧文件：
>
> ```powershell
> # 清理旧构建产物
> cmd /c "rmdir /s /q E:\项目\si-jue-zhi-mao-up\static\vue-dist\js"
> cmd /c "rmdir /s /q E:\项目\si-jue-zhi-mao-up\static\vue-dist\css"
> cmd /c "del /q E:\项目\si-jue-zhi-mao-up\static\vue-dist\index.html"
>
> # 重新构建
> cd frontend
> $env:NODE_OPTIONS="--max-old-space-size=2048"
> npx vite build --mode production --minify false
>
> # 重启 nginx
> docker restart prod-frontend
> ```
>
> **预防：** 在 `package.json` 的 build 脚本中加入清理步骤：
>
> ```json
> {
>   "scripts": {
>     "build": "rm -rf ../static/vue-dist/* && vite build --mode production"
>   }
> }
> ```

### 更新 Python 后端

**小改动（单文件/几行代码）：** 直接复制进容器再重启，秒级生效，不需要重建镜像：

```powershell
# 复制修改后的文件进容器（路径保持一致）
docker cp backend/app/utils/jwt_utils.py prod-backend:/app/app/utils/jwt_utils.py

# 重启生效
docker restart prod-backend
```

**大改动（依赖变更/多文件）：** 需要重建镜像：

```powershell
docker compose -f docker-compose.prod.yml -p sijuelishi-prod up -d --build backend
```

> ⚠️ **禁止无脑 `--build`！** 单文件改动用 `docker cp` + `restart` 秒级完成，`--build` 会重新安装所有依赖，耗时数分钟。

### 数据库

```powershell
docker exec prod-mysql mysql -usijue -psijue123456 sijuelishi -e "SQL"
```

### 端口参照

| 服务 | 端口 |
|------|------|
| 前端 | 5173 |
| 网关 | 9003 |
| Python | 7093 |
| MySQL | 3310 |
| Nacos | 8852 |

---

## 开发环境

### 启动

```powershell
docker compose -f docker-compose.dev.yml up -d
```

### 停止

```powershell
docker compose -f docker-compose.dev.yml down
```

### 端口

| 服务 | 端口 |
|------|------|
| 前端 | 8179 |
| Python | 8090 |
| Java Product | 8002 |
| Java User | 8001 |
| Gateway | 9000 |
| MySQL | 3307 |
| Redis | 6379 |
| Nacos | 8848 |

### 重启单个服务

改了配置文件（如 `vite.config.js`、`application.yml`）后，重启对应服务即可，不用全部重建：

```powershell
# 用服务名（不是容器名）
docker compose -f docker-compose.dev.yml restart frontend
docker compose -f docker-compose.dev.yml restart java-product
docker compose -f docker-compose.dev.yml restart java-user
```

> **注意：** `restart` 用的是服务名（如 `frontend`），不是容器名（如 `dev-frontend`）。
> 服务名定义在 `docker-compose.dev.yml` 的 `services:` 下。

### 更新 Python 代码（开发环境）

开发环境的 Python 容器用 volume 挂载（`./backend/app:/app/app`），代码改动会自动热重载（`--reload`）。
如果热重载没生效，手动重启：

```powershell
docker compose -f docker-compose.dev.yml restart backend
```

### 更新 Java 代码（开发环境）

开发环境的 Java 容器用 `maven:3.9-eclipse-temurin-21` 镜像，代码通过 volume 挂载。
**改了 Java 代码后，光 `restart` 不够**（restart 只是重启进程，不会重新编译）。

有两种方式：

**方式一：容器内编译 + 重启（推荐，快）**

```powershell
# 容器内 mvn install（跳过测试）
docker exec java-product mvn install -pl sjzm-product -am -DskipTests -q

# ⚠️ mvn install 只更新 SNAPSHOT.jar，不会更新 app.jar！需要手动复制：
docker exec java-product cp /app/sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar /app/sjzm-product/target/app.jar

# 重启生效
docker restart java-product
```

> `java-product` 是开发环境的容器名。`-pl sjzm-product -am` 只编译 product 模块及其依赖。

> **⚠️ 禁止使用 `mvn clean`！** `clean` 会删除 `target/` 目录，导致 `app.jar` 丢失。Maven 只生成 `sjzm-product-1.0.0-SNAPSHOT.jar`，不会自动创建 `app.jar`。如果误执行了 `mvn clean`，需要手动恢复：`Copy-Item target/sjzm-product-1.0.0-SNAPSHOT.jar target/app.jar`

**方式二：强制重建容器**

```powershell
docker compose -f docker-compose.dev.yml up -d --force-recreate java-product
```

> `--force-recreate` 会销毁旧容器重新创建，自动执行 `mvn install`。比方式一慢，但更彻底。

### 容器名 vs 服务名

| 服务名（compose） | 容器名（docker） |
|---|---|
| `java-product` | `java-product` |
| `java-user` | `java-user` |
| `frontend` | `dev-frontend` |
| `gateway` | `dev-gateway` |
| `backend` | `dev-backend` |
| `mysql` | `dev-mysql` |
| `redis` | `dev-redis` |
| `nacos` | `dev-nacos` |

> Java 服务的容器名没有 `dev-` 前缀，其他服务有。`docker restart java-product` 可以直接用。

### 查看日志

```powershell
# 查看某个服务的最近日志
docker compose -f docker-compose.dev.yml logs --tail 50 frontend
docker compose -f docker-compose.dev.yml logs --tail 50 java-product

# 实时跟踪日志（Ctrl+C 退出）
docker compose -f docker-compose.dev.yml logs -f frontend
```

### 查看容器状态

```powershell
# 简洁表格（名称、状态、端口）
docker compose -f docker-compose.dev.yml ps --format "table {{.Name}}`t{{.Status}}`t{{.Ports}}"

# 所有容器资源占用
docker stats --no-stream
```

### 在容器内执行命令

```powershell
# Java 容器内编译
docker exec java-product mvn install -pl sjzm-product -am -DskipTests -q

# Java 容器内查看 jar
docker exec java-product ls -la /app/target/

# MySQL 执行 SQL（开发环境）
docker exec dev-mysql mysql -usijue -psijue123456 sijuelishi -e "SELECT COUNT(*) FROM competitor_products"

# MySQL 执行 SQL（生产环境）
docker exec prod-mysql mysql -usijue -psijue123456 sijuelishi -e "SELECT COUNT(*) FROM competitor_products"

# 进入容器 shell
docker exec -it java-product bash
```

### 直接测试后端接口

绕过前端和 Gateway，直接验证 Java 后端是否正常：

```powershell
# 测试 java-product 接口（开发环境 8002，生产环境 8025）
Invoke-RestMethod -Uri "http://localhost:8002/api/v1/competitor/products?page=1&size=1" -Method Get | ConvertTo-Json -Depth 3

# 测试 gateway 路由（开发 9000，生产 9003）
Invoke-RestMethod -Uri "http://localhost:9000/api/v1/competitor/products?page=1&size=1" -Method Get | ConvertTo-Json -Depth 3

# 带筛选参数测试
Invoke-RestMethod -Uri "http://localhost:8002/api/v1/competitor/products?page=1&size=5&marketplace=UK&grade=S" -Method Get | ConvertTo-Json -Depth 3
```

### 排查 404 的思路

1. **先直接测 Java 后端**（`localhost:8002`）→ 确认接口存在
2. **再测 Gateway**（`localhost:9000`）→ 确认路由正确
3. **最后看前端请求** → 检查 Vite 代理是否把请求打到了正确的后端

开发模式下前端走 Vite 代理，生产模式走 Gateway。如果开发模式 404 但生产正常，多半是 `vite.config.js` 缺少对应的代理规则。

### 常见操作速查

| 场景 | 命令 |
|------|------|
| 改了 vite.config.js | `restart frontend` |
| 改了 Java 代码（dev） | `docker exec java-product mvn install -pl sjzm-product -am -DskipTests -q` → `docker restart java-product` |
| 改了 Java 代码（prod） | `.\compile.bat` → `docker restart prod-java-product` |
| 改了 application.yml | `restart java-product` |
| 改了 Gateway 路由 | dev: `restart gateway`；prod: `docker restart prod-gateway` |
| 改了 Python 代码（dev） | 自动热重载，或 `restart backend` |
| 改了 Python 代码（prod） | `docker cp backend/app/. prod-backend:/app/app/` → `docker restart prod-backend` |
| 改了 docker-compose 配置 | 需要 `down` + `up -d`（不能用 restart） |
| 改了 Dockerfile | 需要 `up -d --build <服务名>` |

---

## Dockerfile 国内镜像源配置

Docker 构建时必须配置国内镜像源，否则 `apt-get` 和 `pip` 下载极慢或超时。

### apt 源（Debian/Ubuntu）

```dockerfile
# 在 apt-get update 之前添加
RUN sed -i 's|http://deb.debian.org/debian|http://mirrors.tuna.tsinghua.edu.cn/debian|g' /etc/apt/sources.list.d/debian.sources \
    && sed -i 's|http://security.debian.org/debian-security|http://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/debian.sources
```

### pip 源

```dockerfile
RUN pip install --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple <包名>
```

### uv 源

```dockerfile
RUN uv pip install --system --no-cache-dir -i https://pypi.tuna.tsinghua.edu.cn/simple .
```

### 推荐镜像源

| 镜像 | 地址 |
|------|------|
| 清华大学 | `mirrors.tuna.tsinghua.edu.cn` |
| 中科大 | `mirrors.ustc.edu.cn` |
| 阿里云 | `mirrors.aliyun.com` |

> 清华源最稳定，推荐使用。
