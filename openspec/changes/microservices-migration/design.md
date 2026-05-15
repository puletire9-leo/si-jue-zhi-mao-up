## Context

当前系统是一个 Spring Boot 3.2.5 单体应用，28 个 Controller、40 个 Service、22K 行 Java 代码。分层清晰但耦合在一个 JAR 中。安全配置全放行，RocketMQ 消费者未实现业务逻辑。前端通过 Nginx 代理到后端。

## Goals / Non-Goals

**Goals:**
- 按业务边界拆分为 5 个独立可部署的微服务
- 统一鉴权：Gateway 层 JWT 校验 + 用户服务 RBAC
- 服务间同步通信用 Feign + Nacos，异步通信用 RocketMQ
- 分布式事务用 Seata AT 保证写操作一致性
- 每个服务独立 Docker 镜像和 CI/CD 流水线

**Non-Goals:**
- 数据库不拆分（先拆应用层，schema 后续独立）
- Python FastAPI 后端不做架构变更
- 不上 K8s（先用 Docker Compose）
- 不迁移前端架构

## Decisions

### 1. Nacos over Eureka/Consul
选择 Nacos 因为：国内生态首选、同时提供服务发现和配置中心、与 Spring Cloud 无缝集成、已有阿里云基础设施支持。

### 2. Gateway over 保留 Nginx
用 Spring Cloud Gateway 替代 Nginx `/api/*` 代理。Gateway 可以直接从 Nacos 拉取服务列表做负载均衡，支持编程式路由和过滤器，JWT 校验可以在网关层统一处理而不是每个服务各自实现。

### 3. 先拆应用、不拆数据库
拆库会增加分布式事务的复杂度。先拆应用层，各服务仍连同一 MySQL 实例但逻辑上隔离 schema。等业务稳定后再评估拆库的必要性。

### 4. Seata AT over TCC/Saga
AT 模式对业务代码侵入最小，与现有 Spring 事务注解兼容。TCC 需要重构所有写操作，Saga 适合长事务场景但本项目主要是短事务。

### 5. 公共模块策略
`sjzm-common` 包含 Result、JWT、AOP 注解、缓存配置等所有服务共享的代码。版本化发布（1.0.0-SNAPSHOT），各服务声明依赖。避免代码重复，保证跨服务一致性。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| Gateway 成为单点故障 | 后续可多实例 + Nacos 负载均衡 |
| 跨服务调用增加延迟 | Feign 连接池复用 + 本地缓存热点数据 |
| 分布式事务性能开销 | 仅关键写操作使用 Seata，读操作和异步通知用最终一致性 |
| 开发环境复杂度增加 | 提供 docker-compose 一键启动所有基础设施 |
| Java 后端尚未运行 | 第一步先确保单体能编译启动，再拆分 |

## Migration Plan

1. 确保 Java 单体在本地编译通过并启动成功
2. 创建 `sjzm-common` 并发布
3. 部署 Nacos + Gateway，验证基础通信
4. 逐个切出服务：用户 → 产品 → 定制 → 图片
5. 每切一个服务，Docker Compose + CI/CD 同步更新
6. 全部切完后运行全量回归测试

## Open Questions

- 是否需要独立 Redis 实例还是共享同一个？（倾向共享，减少运维成本）
- CI/CD 的多模块构建时间是否可接受？（需实测，必要时拆分 pipeline）
