# Docker 生产环境完全独立于本地代码

## 目标

所有代码构建后 bake 进 Docker 镜像，删除本地项目目录后 Docker 照常运行。

## 当前问题：宿主机挂载依赖

| 服务 | 宿主机挂载 | 风险 |
|------|-----------|------|
| java-user | `./java-backend/sjzm-user/target/app.jar:/app/user.jar:ro` | 删除项目 → 容器失败 |
| java-product | `./java-backend/sjzm-product/target/app.jar:/app/product.jar:ro` | 同上 |
| gateway | `./java-backend/sjzm-gateway/target/app.jar:/app/gateway.jar:ro` | 同上 |
| backend (Python) | `./backend/app:/app/app:ro` | 同上 |
| backend (Python) | `./领星:/app/领星` | 数据文件，可保留 |
| frontend | `./frontend/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro` | 同上 |
| frontend | `./static/vue-dist:/usr/share/nginx/html:ro` | 同上 |

## 方案：删除 host mount，代码 bake 进镜像

### 1. Java 服务 — 删除 host mount

`Dockerfile.prod` 已有 `COPY` JAR：
```dockerfile
COPY java-backend/sjzm-gateway/target/app.jar ./gateway.jar
COPY java-backend/sjzm-user/target/app.jar ./user.jar
COPY java-backend/sjzm-product/target/app.jar ./product.jar
```

`docker-compose.prod-simple.yml` 删除 3 行 host mount 即可。build 镜像时 JAR 自动 bake 进去。

### 2. Python 后端 — 删除 host mount

`backend/Dockerfile` 已有 `COPY . .`，代码 bake 进镜像。

删除：
```yaml
- ./backend/app:/app/app:ro
```

`./领星:/app/领星` 保留（数据文件，非代码）。

### 3. 前端 — 修改 Dockerfile + build context

修改 `frontend/Dockerfile`，新增 COPY 静态文件：
```dockerfile
FROM nginx:alpine
COPY frontend/nginx.prod.conf /etc/nginx/conf.d/default.conf
COPY static/vue-dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
```

修改 `docker-compose.prod-simple.yml`，build context 改为项目根目录：
```yaml
frontend:
  build:
    context: .
    dockerfile: frontend/Dockerfile
```

删除 2 行 host mount：
```yaml
# 删除
- ./frontend/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
- ./static/vue-dist:/usr/share/nginx/html:ro
```

## 部署流程（改后）

```powershell
# 1. Java 构建（宿主机 Maven）
cd java-backend
docker run --rm -v "${PWD}:/app" -v "$env:TEMP\m2:/root/.m2" -w /app maven:3.9-eclipse-temurin-21 mvn package -DskipTests -T 4
Copy-Item sjzm-user/target/sjzm-user-1.0.0-SNAPSHOT.jar sjzm-user/target/app.jar -Force
Copy-Item sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar sjzm-product/target/app.jar -Force
Copy-Item sjzm-gateway/target/sjzm-gateway-1.0.0-SNAPSHOT.jar sjzm-gateway/target/app.jar -Force

# 2. 前端构建（宿主机 npm）
cd frontend
npm run build

# 3. Docker 构建（所有镜像，代码 bake 进去）
cd ..
docker compose -f docker-compose.prod-simple.yml build

# 4. 启动
docker compose -f docker-compose.prod-simple.yml up -d
```

构建完成后，删除本地项目目录，Docker 照常运行。

## 修改文件清单

| 文件 | 改动 |
|------|------|
| `docker-compose.prod-simple.yml` | 删除 7 行 host mount，frontend build context 改为 `.` |
| `frontend/Dockerfile` | 新增 `COPY static/vue-dist /usr/share/nginx/html` |

## 不需要改的

| 文件 | 原因 |
|------|------|
| `java-backend/Dockerfile.prod` | 已有 COPY JAR |
| `backend/Dockerfile` | 已有 `COPY . .` |
| mysql/redis/nacos | 已是 named volume，不依赖宿主机 |

## 验证

1. `docker compose -f docker-compose.prod-simple.yml build` — 所有镜像构建成功
2. `docker compose -f docker-compose.prod-simple.yml up -d` — 所有容器启动
3. 浏览器访问前端、调用 API 确认正常
4. 删除 `static/vue-dist/`、`java-backend/*/target/` — 容器不受影响
