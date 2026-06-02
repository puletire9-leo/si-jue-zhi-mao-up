# Gateway 微服务网关

## 当前状态

**未部署。** 代码和 JAR 已就绪，Docker 容器可启动，但收到请求即崩溃。

## 架构

```
浏览器 → Vite(8179) → Gateway(9000) → java-product(8002)
                              ↓
                         JWT 鉴权 / RBAC
                         路由分发 / 限流
```

## 已完成

- `sjzm-gateway` 模块代码完整
- 路由配置覆盖所有 API：`asin-import`, `competitor`, `scoring`, `filter-config`, `products`, `selections`, `product-sales`
- JWT 鉴权过滤器 `JwtAuthGatewayFilter`（开发环境可关闭 `gateway.auth.enabled: false`）
- RBAC 权限映射
- Docker Compose 集成（容器名 `dev-gateway`，端口 9000）
- JAR 可正常构建

## 遇到的问题

### NoSuchMethodError: HttpHeaders.headerSet()

```
java.lang.NoSuchMethodError: 'java.util.Set org.springframework.http.HttpHeaders.headerSet()'
    at reactor.netty.http.server.HttpServer ...
```

**根因**：依赖版本冲突。

- Spring Boot 3.2.5 → `spring-web:6.1.6`（没有 `headerSet()` 方法）
- `reactor-netty-http` 的某个版本编译时引用了 `HttpHeaders.headerSet()`（Spring 6.2+ 才有的方法）
- 依赖树解析到 `reactor-netty-http:1.1.18`，但该版本不兼容 Spring 6.1.x

### 尝试过的修复

| 尝试 | 结果 |
|------|------|
| 删 Nacos 依赖 | 无效 |
| 删 LoadBalancer 依赖 | 无效 |
| 显式声明 spring-web 版本 | 无效 |
| 锁死 reactor-netty-http 到 1.1.17 | 无效 |
| 清 Maven 缓存重建 | 无效 |

### 根本原因

`spring-cloud-starter-gateway:4.1.6`（Spring Cloud 2023.0.4）自带的 `reactor-netty-http` 与 Spring Boot 3.2.5 的 `spring-web` 存在编译时版本不一致。这是 Spring 官方已在 2023.0.5+ 修复的已知问题。

## 解决方案

二选一：

1. **升级 Spring Boot 到 3.3.x + Spring Cloud 2023.0.5+**（需要全量重编译所有模块，约 1-2 小时）
2. **保持直连**：Vite 代理直接转发到 `java-product:8002`，Gateway 暂时不用

## 当前工作方式

```
浏览器 → Vite(8179) → java-product:8002  直接代理，绕过 Gateway
```

无鉴权，无统一入口。对于一个 Java 服务来说足够，Gateway 等服务拆分后再上。

## 相关文件

| 文件 | 说明 |
|------|------|
| `java-backend/sjzm-gateway/pom.xml` | 依赖（已注释 Nacos/LoadBalancer） |
| `java-backend/sjzm-gateway/src/main/resources/application.yml` | 路由配置 + JWT |
| `java-backend/sjzm-gateway/src/main/java/com/sjzm/gateway/JwtAuthGatewayFilter.java` | JWT 过滤器 |
| `docker-compose.dev.yml` | Gateway 服务定义 |
| `frontend/vite.config.js` | 代理配置（当前直连 java-product） |
