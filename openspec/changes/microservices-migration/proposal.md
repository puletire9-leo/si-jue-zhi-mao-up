## Why

当前 Java 后端是一个包含 28 个 Controller、40 个 Service、22K 行代码的单体 Spring Boot 应用。随着功能增长，单体架构的缺陷日益明显：安全配置全放行无法独立加固、数据看板查询与业务接口争抢连接池、AI 图片处理阻塞主业务流程。将单体按业务边界拆分为独立微服务，实现独立部署、独立扩容、独立加固。

## What Changes

- 抽取公共模块 `sjzm-common`（Result、JWT、AOP 注解、缓存配置），所有服务共享
- 部署 Nacos 服务注册与配置中心，替代本地 yml 配置
- 创建 Spring Cloud Gateway 统一入口，替代 Nginx `/api/*` 代理
- 拆分用户服务 `sjzm-user`：Auth + User + RBAC，真正启用 Spring Security 鉴权
- 拆分产品服务 `sjzm-product`：Product + Selection + Scoring + 数据看板
- 拆分定制服务 `sjzm-customization`：FinalDraft + Material + Carrier + Category + Tag
- 拆分图片服务 `sjzm-image`：Image + COS + Vector Search + AI 分析
- 服务间同步通信用 Feign，异步通信完善现有 RocketMQ 消费者
- 引入 Seata AT 模式处理分布式事务
- Docker Compose 更新为多服务编排，CI/CD 更新多模块构建流水线

## Capabilities

### New Capabilities

- `service-discovery`: Nacos 服务注册与发现，Gateway 动态路由
- `distributed-auth`: 用户服务独立鉴权，JWT 网关层校验 + 服务层 RBAC
- `service-to-service`: Feign 声明式调用 + RocketMQ 异步消息
- `distributed-transactions`: Seata AT 模式保证跨服务数据一致性
- `independent-deployment`: 每个服务独立 Docker 镜像 + 独立端口 + 独立扩容

### Modified Capabilities

- `auth`: 鉴权从"全放行"改为网关 JWT 校验 + 用户服务 RBAC 强制实施 **BREAKING**
- `deployment`: Docker Compose 从单 JAR 改为 5 服务 + Gateway + Nacos 编排

## Impact

- **Java 后端**: 单体 JAR 拆为 5 个独立服务 + 1 个公共模块 + 1 个 Gateway
- **配置管理**: application.yml → Nacos Config，支持动态刷新
- **数据库**: 暂不拆分 schema（先拆应用层），后续按需独立
- **Python 后端**: 保持不变，FastAPI 图片服务继续独立运行
- **CI/CD**: GitHub Actions 需支持多模块 Maven 构建
- **Docker**: 从单一 Dockerfile 变为每服务独立构建
