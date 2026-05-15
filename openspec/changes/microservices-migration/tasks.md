## 1. 公共模块 sjzm-common

- [ ] 1.1 创建 `sjzm-common` Maven 模块（pom.xml, 目录结构）
- [ ] 1.2 迁移 `Result<T>`, `PageResult<T>`, `BusinessException`
- [ ] 1.3 迁移 `JwtUtil`, `SnowflakeIdGenerator`
- [ ] 1.4 迁移 `@RateLimit`, `@Idempotent`, `@TraceOperation` 注解+AOP
- [ ] 1.5 迁移 `RedisConfig`, `CaffeineConfig`
- [ ] 1.6 迁移 `GlobalExceptionHandler`
- [ ] 1.7 `mvn install` 打包并验证所有模块可依赖

## 2. Nacos + Gateway 基础设施

- [ ] 2.1 Docker Compose 添加 Nacos 服务
- [ ] 2.2 创建 `sjzm-gateway` 模块（spring-cloud-starter-gateway）
- [ ] 2.3 配置 Gateway 路由规则（auth→用户服务, products→产品服务, etc.）
- [ ] 2.4 实现 Gateway 全局 JWT 校验过滤器
- [ ] 2.5 配置 Nacos Config（迁移 application.yml 关键配置）
- [ ] 2.6 验证：Gateway 启动 → Nacos 注册 → 健康检查通过

## 3. 切用户服务 sjzm-user :8001

- [ ] 3.1 创建 `sjzm-user` Maven 模块，依赖 `sjzm-common`
- [ ] 3.2 迁移 `AuthController` (login/register/logout/refresh/me)
- [ ] 3.3 迁移 `UserController` (CRUD)
- [ ] 3.4 迁移 `AuthServiceImpl`, `UserServiceImpl`
- [ ] 3.5 实现真正的 `JwtAuthenticationFilter`（替换空壳）
- [ ] 3.6 实现真正的 `SecurityConfig`（替换 `.anyRequest().permitAll()`）
- [ ] 3.7 迁移 `UserMapper`, `RoleMapper`, `PermissionMapper`
- [ ] 3.8 端到端测试：登录→token→访问受保护接口→RBAC生效

## 4. 切产品服务 sjzm-product :8002

- [ ] 4.1 创建 `sjzm-product` Maven 模块
- [ ] 4.2 迁移 `ProductController`, `SelectionController`
- [ ] 4.3 迁移 `ProductSalesController` (数据看板 DuckDB 查询)
- [ ] 4.4 迁移 `CategoryController`, `ScoringController`
- [ ] 4.5 迁移 `ProductDataServiceImpl`, `SelectionServiceImpl`
- [ ] 4.6 迁移 `ProductMapper`, `SelectionMapper`, `CategoryMapper`
- [ ] 4.7 验证：产品CRUD + 选品查询 + 数据看板正常

## 5. 切定制服务 sjzm-customization :8003

- [ ] 5.1 创建 `sjzm-customization` Maven 模块
- [ ] 5.2 迁移 `FinalDraftController`, `MaterialLibraryController`
- [ ] 5.3 迁移 `CarrierLibraryController`, `TagController`
- [ ] 5.4 迁移 `FinalDraftServiceImpl`, `MaterialLibraryServiceImpl`
- [ ] 5.5 迁移 `CarrierLibraryServiceImpl`
- [ ] 5.6 添加 `@FeignClient` (ProductClient) 调用产品服务
- [ ] 5.7 验证：定稿CRUD + 素材库 + 载体库正常，跨服务调用成功

## 6. 切图片服务 sjzm-image :8004

- [ ] 6.1 创建 `sjzm-image` Maven 模块
- [ ] 6.2 迁移 `ImageController`, `ImageProxyController`
- [ ] 6.3 迁移 `ImageServiceImpl`, `CosStorageServiceImpl`
- [ ] 6.4 迁移 `VectorSearchServiceImpl`
- [ ] 6.5 迁移 `ImageMapper`, `ImageVectorMapper`
- [ ] 6.6 实现 `ImageProcessConsumer`（RocketMQ，之前是空壳）
- [ ] 6.7 验证：图片上传 + COS 存储 + 向量搜索 + MQ 通知正常

## 7. 服务间通信与事务

- [ ] 7.1 配置 Spring Cloud OpenFeign 全局超时和重试
- [ ] 7.2 完善 RocketMQ 3 个消费者的业务逻辑
- [ ] 7.3 引入 Seata AT，配置全局事务
- [ ] 7.4 验证：跨服务调用 + MQ + 分布式事务端到端

## 8. Docker + CI/CD

- [ ] 8.1 为每个服务创建独立 Dockerfile
- [ ] 8.2 更新 docker-compose.yml（5服务+Gateway+Nacos）
- [ ] 8.3 更新 GitHub Actions CI（多模块 Maven 构建）
- [ ] 8.4 全量回归测试
- [ ] 8.5 文档更新（架构设计文档 + README）
