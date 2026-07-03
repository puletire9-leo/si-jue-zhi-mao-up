# Docker 部署踩坑总结

## 最终架构

```
前端 (8179) ── Vite Proxy ──┬── Python 后端 (8090) ── MySQL (3307) / Redis (6379)
                            └── Java Product (8002) ── MySQL (3307) / Redis (6379)
```

5 个容器：dev-mysql, dev-redis, dev-backend, dev-frontend, java-product

---

## 坑 1：Docker Desktop 和 VPN 的启动顺序

**现象**：`docker pull` / `docker compose up` 报 `dial tcp ... connectex: A connection attempt failed`

**原因**：先启动 Docker Desktop 再连 VPN，WSL2 虚拟机的网络栈拿不到 VPN 路由，无法访问 Docker Hub。

**解决**：**退出 Docker Desktop → 连 VPN → 再启动 Docker Desktop**。顺序不能反。

---

## 坑 2：registry-mirrors 镜像加速失效

**现象**：配置了国内镜像源（如 `docker.m.daocloud.io`）后，`docker pull` 报 `403 Forbidden` 或 `429 Too Many Requests`，反而连不上。

**原因**：国内镜像源不稳定，很多已停止服务或限流。

**解决**：有了 VPN 就不要配镜像源。`daemon.json` 保持干净：

```json
{
  "builder": {
    "gc": { "defaultKeepStorage": "20GB", "enabled": true }
  },
  "experimental": false
}
```

> 修改后需**重启 Docker Desktop** 才生效。

---

## 坑 3：pip install 下载 numpy 超时

**现象**：`docker build` 构建 Python 基础镜像时，`pip install numpy` 超时：

```
TimeoutError: The read operation timed out
ReadTimeoutError: HTTPSConnectionPool(host='files.pythonhosted.org', port=443): Read timed out.
```

**原因**：Docker 的 registry-mirrors **只对拉取 Docker 镜像有效**。Dockerfile 里的 `pip install` 走的是 PyPI（`files.pythonhosted.org`），不受 registry-mirrors 影响。NumPy 等科学计算库体积大，从国内直连海外 PyPI 下载极慢。

**解决**：在 Dockerfile 里为 pip 也配置国内源：

```dockerfile
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com
```

apt-get 同理，也换阿里云源：

```dockerfile
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y ...
```

---

## 坑 4：Python 依赖缺失（sqlalchemy, duckdb, requests）

**现象**：容器启动后 Python 后端报 `ModuleNotFoundError`：

```
ModuleNotFoundError: No module named 'sqlalchemy'
ModuleNotFoundError: No module named 'duckdb'
```

**原因**：`requirements.txt` 不完整，代码里 import 了但没写进依赖。

**解决**：搜出代码中所有第三方 import，补齐 `requirements.txt`。最终新增：

```
sqlalchemy
duckdb
requests
```

> 一个技巧：用 `grep -r "^from \|^import " backend/app/` 搜出所有 import，交叉比对 `requirements.txt`，一次性补齐。

---

## 坑 5：Maven `-q` 静默模式吞掉所有错误

**现象**：java-product 容器不断重启（exit code 0），`docker logs` 完全为空，无法排查。

**原因**：docker-compose 里用了 `mvn install -DskipTests -q`，`-q` 把所有输出都吞了，包括错误。

**解决**：去掉 `-q`（开发阶段不要用），确保日志可见。

---

## 坑 6：`mvn spring-boot:run -pl` reactor 解析失败

**现象**：`mvn install` BUILD SUCCESS，但 `mvn spring-boot:run -pl sjzm-product` 没有任何 Spring Boot 日志输出就退出（exit code 0），容器不断重启。

**原因**：compose 命令 `mvn install && mvn spring-boot:run -pl sjzm-product` 是两个**独立的 Maven 进程**。第二个进程 `mvn spring-boot:run -pl sjzm-product` 需要重新解析 reactor（多模块结构），但独立运行时无法正确发现模块，静默退出。

**解决**：改用 `java -jar` 直接启动已构建好的 fat jar，不需要 Maven 参与运行时：

```yaml
command: sh -c "mvn install -DskipTests -q && java -Xmx256m -jar sjzm-product/target/sjzm-product-1.0.0-SNAPSHOT.jar"
```

这也是生产环境的推荐做法。开发时 `mvn install` 重新编译，`java -jar` 启动，两个步骤分离，各自可见。

---

## 坑 7：Spring Security 自动启用 Basic Auth 拦截 API

**现象**：API 返回 `401 Unauthorized`，日志里有：

```
Using generated security password: xxxxxxxx
```

**原因**：sjzm-common 依赖了 `spring-boot-starter-security`，但 sjzm-product 没有自定义 SecurityConfig，Spring Boot 自动启用 Basic Auth 要求所有请求认证。

**解决**：在 sjzm-product 里加一个 `SecurityConfig`，允许所有请求：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }
}
```

> 生产环境如果有 Gateway 统一鉴权，各个微服务可以这样放开。

---

## 坑 8：数据库表未建导致 500 错误

**现象**：API 返回 500，日志里：

```
Table 'sijuelishi_dev.asin_import_tables' doesn't exist
```

**原因**：新 MySQL 实例没有 `asin_import_tasks` 和 `asin_import_results` 这两张业务表。

**解决**：在 compose 启动后执行建表 SQL：

```sql
CREATE TABLE IF NOT EXISTS asin_import_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    marketplace VARCHAR(10),
    task_status VARCHAR(20) DEFAULT 'UPLOADED',
    total_count INT DEFAULT 0,
    pass_count INT DEFAULT 0,
    price_fail_count INT DEFAULT 0,
    review_fail_count INT DEFAULT 0,
    duplicate_count INT DEFAULT 0,
    skip_count INT DEFAULT 0,
    batch_total INT DEFAULT 0,
    batch_current INT DEFAULT 0,
    api_success INT DEFAULT 0,
    api_fail INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asin_import_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    task_id BIGINT,
    asin VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PASS',
    detail TEXT,
    FOREIGN KEY (task_id) REFERENCES asin_import_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

如果已有表且出现长标题写入失败，再补一条迁移：

```sql
ALTER TABLE asin_import_results
    MODIFY COLUMN title VARCHAR(1000) DEFAULT NULL COMMENT '产品标题';
```

---

## 坑 9：Docker 内 localhost 指容器自己

**现象**：前端 Vite 代理配置 `target: http://localhost:8002`，访问时报 `ECONNREFUSED`。

**原因**：Docker 容器内 `localhost` 指向容器自己，不是宿主机。前端容器想连 Java 容器，不能用 localhost。

**解决**：Docker 网络内用**服务名**作为 hostname：

```yaml
# docker-compose.dev.yml
frontend:
  environment:
    VITE_BACKEND_HOST: backend      # Python 容器名
    VITE_BACKEND_PORT: "8090"
    VITE_JAVA_HOST: java-product    # Java 容器名
    VITE_JAVA_PORT: "8002"
```

```js
// vite.config.js
proxy: {
  '/api/v1/competitor': {
    target: `http://${env.VITE_JAVA_HOST || 'localhost'}:${env.VITE_JAVA_PORT || '8002'}`,
    changeOrigin: true
  },
  '^/api': {
    target: `http://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || '8090'}`,
    changeOrigin: true
  }
}
```

宿主机本地开发用 localhost，Docker 里用容器名，靠环境变量切换。

---

## 坑 10：`docker restart` 不更新环境变量

**现象**：改了 docker-compose.yml 里的环境变量后 `docker restart`，变量没生效。

**原因**：`docker restart` 只重启进程，不重建容器。环境变量在容器创建时固化。

**解决**：改 compose 配置后必须重建容器：

```bash
docker compose up -d --force-recreate <service>
# 或
docker compose down && docker compose up -d
```

---

## 坑 11：`docker compose build` 缓存不更新 FROM 层

**现象**：改了基础镜像（sjzm-python-base），重建 dev-backend 却还用旧缓存。

**原因**：`docker compose build backend` 只会重建 `Dockerfile.dev` 的层，但 `FROM sjzm-python-base` 这一层如果之前拉取过，不会自动检测基础镜像更新。

**解决**：

```bash
# 先重建基础镜像
docker build -f backend/Dockerfile.base -t sjzm-python-base backend

# 再强制无缓存重建上层
docker compose -f docker-compose.yml -f docker-compose.dev.yml build --no-cache backend
```

---

## 快速重建清单

从零开始构建开发环境的正确流程：

```bash
# 1. 先连 VPN，再开 Docker Desktop

# 2. 构建 Python 基础镜像
docker build -f backend/Dockerfile.base -t sjzm-python-base backend

# 3. 启动全部服务
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# 4. 建数据库表（仅首次）
docker exec dev-mysql mysql -usijue -psijue123456 sijuelishi_dev -e "CREATE TABLE ..."

# 5. 验证
curl http://localhost:8090/health
curl -X POST http://localhost:8002/api/v1/competitor/lookup \
  -H "Content-Type: application/json" \
  -d '{"marketplace":"UK","asins":["B0TEST1234"]}'
```

---

## 关键文件清单

| 文件 | 作用 |
|------|------|
| `docker-compose.yml` | 基础设施模板（MySQL, Redis），无端口 |
| `docker-compose.dev.yml` | 开发环境覆盖（端口、卷挂载、热重载） |
| `docker-compose.prod.yml` | 生产环境覆盖（不同端口、资源限制） |
| `backend/Dockerfile.base` | Python 基础镜像（含所有 pip 依赖） |
| `backend/Dockerfile.dev` | 开发用后端镜像（继承 base） |
| `backend/Dockerfile` | 生产用后端镜像（继承 base + 源码） |
| `java-backend/Dockerfile` | Java 多阶段构建（Maven 编译 → JRE 运行） |
| `frontend/vite.config.js` | Vite 代理配置（Java/API 路由分发） |
| `java-backend/sjzm-product/.../SecurityConfig.java` | 允许无需认证访问 |
