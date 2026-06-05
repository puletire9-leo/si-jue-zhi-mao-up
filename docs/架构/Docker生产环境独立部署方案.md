# Docker 生产环境独立部署方案

## 目标

所有代码构建后 bake 进 Docker 镜像，删除本地项目目录后 Docker 照常运行。

## 架构

```
宿主机构建 → Docker 镜像（代码 bake 进去） → 容器运行（不依赖宿主机文件）
```

| 服务 | Dockerfile | 代码如何进入镜像 | host mount |
|------|-----------|-----------------|------------|
| Java (user/product/gateway) | `java-backend/Dockerfile.prod` | `COPY *.jar` | 无 |
| Python (backend + celery) | `backend/Dockerfile` → `FROM sjzm-python-base` | `COPY . .` | 无 |
| 前端 (nginx) | `frontend/Dockerfile` | `COPY static/vue-dist` + `COPY nginx.prod.conf` | 无 |
| MySQL / Redis / Nacos | 官方镜像 | - | named volume（`prod-*-data`） |
| 领星数据 | - | - | `./领星:/app/领星`（业务数据，唯一 host mount） |

## 首次部署（完整流程）

### 步骤 1：构建 Python 基础镜像

```powershell
docker build -t sjzm-python-base -f backend/Dockerfile.base backend
```

> 包含所有 pip 依赖，只在首次或 `requirements.txt` 变更时需要重建。

### 步骤 2：构建 Java JAR

```powershell
cd java-backend
docker run --rm -v "$($pwd):/app" -v "$env:TEMP\m2:/root/.m2" -w /app `
    maven:3.9-eclipse-temurin-21 mvn package -DskipTests -T 4

Copy-Item sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar sjzm-product/target/app.jar -Force
Copy-Item sjzm-gateway/target/sjzm-gateway-1.0.0-SNAPSHOT.jar sjzm-gateway/target/app.jar -Force
Copy-Item sjzm-user/target/sjzm-user-1.0.0-SNAPSHOT.jar sjzm-user/target/app.jar -Force
```

> 禁止 `mvn clean`，会删除已有 app.jar 导致容器启动失败。

### 步骤 3：构建前端 dist

```powershell
cd ..\frontend
npm run build
```

> 必须在宿主机构建，Docker Desktop 内存不足会 OOM。输出到 `../static/vue-dist/`。

### 步骤 4：构建所有 Docker 镜像

```powershell
cd ..
docker compose -f docker-compose.prod-simple.yml build
```

### 步骤 5：启动所有容器

```powershell
docker compose -f docker-compose.prod-simple.yml up -d
```

### 步骤 6：验证

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String "prod-"
```

所有容器应显示 `(healthy)` 或 `Up`。访问 `http://localhost:5173` 确认前端加载正常。

---

## 日常更新（仅重建变更的服务）

### 只改了 Java 代码

```powershell
cd java-backend
docker run --rm -v "$($pwd):/app" -v "$env:TEMP\m2:/root/.m2" -w /app `
    maven:3.9-eclipse-temurin-21 mvn package -DskipTests -T 4
Copy-Item sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar sjzm-product/target/app.jar -Force
# （改到哪个模块就拷哪个）

cd ..
docker compose -f docker-compose.prod-simple.yml build --no-cache java-product
docker compose -f docker-compose.prod-simple.yml up -d java-product
```

### 只改了前端代码

```powershell
cd frontend
npm run build

cd ..
docker compose -f docker-compose.prod-simple.yml build --no-cache frontend
docker compose -f docker-compose.prod-simple.yml up -d frontend
```

### 只改了 Python 代码

```powershell
docker compose -f docker-compose.prod-simple.yml build --no-cache backend celery-download
docker compose -f docker-compose.prod-simple.yml up -d backend celery-download
```

> Python 基础镜像 (`sjzm-python-base`) 不需要重建，除非 `requirements.txt` 有变更。

### 多个服务同时改

叠加上述步骤，最后一次性 rebuild + up：

```powershell
docker compose -f docker-compose.prod-simple.yml build --no-cache java-product gateway frontend
docker compose -f docker-compose.prod-simple.yml up -d java-product gateway frontend
```

---

## 端口

| 服务 | 端口 |
|------|------|
| 前端 (nginx) | 5173 |
| Gateway | 9003 |
| Java User | 8014 |
| Java Product | 8025 |
| Python Backend | 7093 |
| MySQL | 3310 |
| Redis | 6383 |
| Nacos | 8852 (HTTP) / 9852 (gRPC) |

---

## 故障排查

### prod-celery-download 一直 unhealthy

健康检查的 `$HOSTNAME` 在 `CMD` 数组形式中不会被 shell 展开。已在 `docker-compose.prod-simple.yml` 中改为 `CMD-SHELL`：

```yaml
test: ["CMD-SHELL", "celery -A app.tasks.celery_app inspect ping -d celery@$$HOSTNAME"]
```

### 构建时找不到 sjzm-python-base

运行步骤 1：
```powershell
docker build -t sjzm-python-base -f backend/Dockerfile.base backend
```
