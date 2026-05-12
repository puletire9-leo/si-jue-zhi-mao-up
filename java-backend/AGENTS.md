# Java 后端 - Agent 开发索引

> Spring Boot 3.2.5 + Java 17 + MyBatis-Plus 3.5.6
> 核心业务后端，处理高并发 CRUD 操作

## 包结构

```
com.sjzm/
├── SjzmBackendApplication.java    # 启动类 (@MapperScan + @EnableCaching + @EnableAsync)
├── common/                         # 通用组件（Result/PageResult/BusinessException/GlobalExceptionHandler）
├── config/                         # 配置类（10个，见下方）
├── controller/                     # 控制器（11个，见下方）
├── entity/                         # 实体类（8个，对应数据库表）
├── mapper/                         # MyBatis Mapper（8个，继承 BaseMapper<T>）
├── security/                       # JWT 认证（JwtUtil + JwtAuthenticationFilter）
├── service/                        # 服务接口（10个）
│   └── impl/                       # 服务实现（10个，TODO标记待实现）
└── util/                           # 工具类（SnowflakeIdGenerator + SignatureUtil）
```

## 配置类清单

| 类 | 用途 | 关键参数 |
|----|------|---------|
| MyBatisPlusConfig | 分页插件 + 自动填充 | createdAt/updatedAt 自动填充 |
| RedisConfig | Redis + CacheManager | TTL 10min, JSON 序列化 |
| RedissonConfig | 分布式锁 | 连接池50, 超时3s |
| CaffeineConfig | 本地缓存 | 三级：默认5min/长期30min/短期1min |
| AsyncConfig | 线程池 | 业务(10-50)/图片(5-20)/导入导出(20-100) |
| RateLimitConfig | 三级限流 | 全局100/s → API 10/s → IP 5/s |
| CircuitBreakerConfig | 熔断器 | 滑动窗口100, 失败率50%, 慢调用2s |
| SecurityConfig | Spring Security 6.x | JWT 无状态认证 |
| UndertowConfig | 容器优化 | IO=4, Worker=200, MaxConn=10000 |
| CorsConfig | 跨域 | 开发 * / 生产限制 |

## Controller → Service → Mapper 映射

| Controller | 路由前缀 | Service | Mapper | Entity |
|-----------|---------|---------|--------|--------|
| AuthController | `/api/auth` | AuthService | UserMapper | User |
| ProductController | `/api/products` | ProductService | ProductMapper | Product |
| SelectionController | `/api/selections` | SelectionService | SelectionMapper | Selection |
| FinalDraftController | `/api/final-drafts` | FinalDraftService | FinalDraftMapper | FinalDraft |
| MaterialLibraryController | `/api/materials` | MaterialLibraryService | MaterialLibraryMapper | MaterialLibrary |
| CarrierLibraryController | `/api/carriers` | CarrierLibraryService | CarrierLibraryMapper | CarrierLibrary |
| CategoryController | `/api/categories` | CategoryService | CategoryMapper | Category |
| TagController | `/api/tags` | TagService | TagMapper | Tag |
| UserController | `/api/users` | UserService | UserMapper | User |
| ImageProxyController | `/api/image-proxy` | ImageProxyService | - | - |
| HealthController | `/health` | - | - | - |

## 当前状态

**骨架完成，业务逻辑待实现。** Service 实现类中所有方法用 `TODO` 标记。

实现优先级：
1. `AuthService` → 认证是所有接口的前提
2. `ProductService` → 核心业务
3. `SelectionService` → 核心业务
4. 其余模块按需实现

## Agent 修改规则

1. 新增 Entity 必须加 `@TableName` + `@TableId(type=IdType.ASSIGN_ID)` + `@TableLogic`
2. 新增 Controller 必须用 `@RestController` + `@RequestMapping` + `@Tag`（Swagger）
3. 新增 Service 必须先写接口再写 Impl，Impl 加 `@Service`
4. 新增 Mapper 必须继承 `BaseMapper<T>`
5. 响应统一用 `Result.success(data)` 或 `Result.error(message)`
6. 禁止在 Controller 写业务逻辑，禁止在 Mapper 写业务判断
7. 配置文件在 `src/main/resources/`，环境变量占位 `${ENV_VAR:default}`
