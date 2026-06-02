# Java 后端 - Agent 开发索引

> Spring Boot 4.0.4 + MyBatis-Plus 3.5.15 + Spring Cloud Gateway
> 微服务架构：gateway / user / product / common

## 模块概览

| 模块 | 端口 | 说明 |
|------|------|------|
| sjzm-gateway | 9000 | 网关（路由转发 + JWT 鉴权 + RBAC 权限） |
| sjzm-user | 8001 | 用户服务（认证 + 用户管理） |
| sjzm-product | 8002 | 产品服务（竞品分析 + 评分 + ASIN 导入 + 筛选预设） |
| sjzm-common | - | 公共组件（Result/异常/安全/工具/注解/AOP/MQ） |

## 包结构

### sjzm-user
```
com.sjzm.user/
├── UserApplication.java           # 启动类
├── controller/
│   ├── AuthController.java        # 登录/注册/刷新/登出
│   └── UserController.java        # 用户列表/详情/改密
├── service/
│   ├── AuthService.java           # 认证接口
│   └── impl/AuthServiceImpl.java  # 认证实现（完整）
├── dto/                           # LoginRequest/LoginResponse/RegisterRequest
├── entity/User.java               # 用户实体
└── mapper/UserMapper.java         # 继承 BaseMapper<User>
```

### sjzm-product
```
com.sjzm.product/
├── ProductApplication.java        # 启动类
├── controller/
│   ├── CompetitorController.java  # 竞品查询/导出
│   ├── ScoringController.java     # 评分配置/一键评分/重算
│   ├── AsinImportController.java  # ASIN Excel 导入
│   ├── FilterConfigController.java # 筛选配置
│   └── UserFilterPresetController.java # 用户筛选预设
├── service/
│   ├── CompetitorService.java     # 竞品数据查询（含分页/缓存）
│   ├── CompetitorFilterService.java # 竞品数据过滤
│   ├── SellerspriteApiService.java  # 卖家精灵 API 对接
│   ├── ScoringService.java        # 评分引擎（多维加权 + 等级判定）
│   ├── AsinImportService.java     # ASIN 批量导入（Excel 解析）
│   ├── FilterConfigService.java   # 筛选配置管理
│   ├── UserFilterPresetService.java # 用户筛选预设 CRUD
│   └── ApiRateLimitService.java   # API 调用频率限制
├── entity/                        # 12 个实体（见下方）
├── mapper/                        # 12 个 Mapper
└── dto/                           # 请求/响应 DTO
```

### sjzm-common
```
com.sjzm/
├── common/
│   ├── Result.java                # 统一响应 {code, message, data}
│   ├── PageResult.java            # 分页响应
│   ├── BusinessException.java     # 业务异常
│   └── GlobalExceptionHandler.java # 全局异常处理
├── config/
│   ├── RedisConfig.java           # Redis + CacheManager (JSON 序列化)
│   ├── RedissonConfig.java        # 分布式锁
│   ├── CaffeineConfig.java        # 三级本地缓存
│   ├── AsyncConfig.java           # 异步线程池
│   ├── RateLimitConfig.java       # 三级限流配置
│   └── CircuitBreakerConfig.java  # 熔断器配置
├── security/
│   ├── JwtUtil.java               # JWT 生成/验证
│   └── JwtAuthenticationFilter.java # JWT 过滤器
├── annotation/
│   ├── RateLimit.java             # 限流注解
│   ├── CacheWithMultiLevel.java   # 多级缓存注解
│   ├── CacheEvictWithMultiLevel.java # 缓存清除注解
│   └── TraceOperation.java        # 链路追踪注解
├── aspect/
│   ├── RateLimitAspect.java       # 限流切面
│   └── TraceAspect.java           # 追踪切面
├── interceptor/
│   ├── TraceInterceptor.java      # 追踪拦截器
│   └── TracingInterceptor.java    # 链路拦截器
├── mq/
│   ├── MessageProducer.java       # 消息生产者接口
│   ├── MessageConsumer.java       # 消息消费者接口
│   └── rocketmq/                  # RocketMQ 实现
│       ├── RocketMQProducer.java
│       ├── ImageProcessConsumer.java
│       ├── NotificationConsumer.java
│       └── OrderConsumer.java
├── util/
│   ├── SnowflakeIdGenerator.java  # 雪花 ID
│   ├── SignatureUtil.java         # MD5 签名
│   └── BloomFilterUtil.java       # 布隆过滤器
└── exception/
    └── RateLimitExceededException.java
```

### sjzm-gateway
```
com.sjzm.gateway/
├── GatewayApplication.java        # 启动类（Reactive）
├── JwtAuthGatewayFilter.java      # 全局 JWT 鉴权过滤器
├── CorsGlobalFilter.java          # 跨域过滤器
└── PermissionService.java         # RBAC 权限检查
```

## Entity → Mapper 映射

### sjzm-user
| Entity | Mapper | 表名 |
|--------|--------|------|
| User | UserMapper | users |

### sjzm-product
| Entity | Mapper | 说明 |
|--------|--------|------|
| CompetitorProduct | CompetitorProductMapper | 竞品产品数据 |
| CompetitorSubcategory | CompetitorSubcategoryMapper | 竞品子类目 |
| CompetitorLookupLog | CompetitorLookupLogMapper | 竞品查询日志 |
| AsinImportTask | AsinImportTaskMapper | ASIN 导入任务 |
| AsinImportResult | AsinImportResultMapper | ASIN 导入结果 |
| SkipAsin | SkipAsinMapper | 跳过 ASIN |
| Shop | ShopMapper | 店铺信息 |
| Product30DayNew | Product30DayNewMapper | 30 天新品 |
| ScoringConfig | ScoringConfigMapper | 评分配置 |
| GradeThreshold | GradeThresholdMapper | 评分等级阈值 |
| ApiConfig | ApiConfigMapper | 卖家精灵 API 配置 |
| UserFilterPreset | UserFilterPresetMapper | 用户筛选预设 |

## Controller → API 路由

| Controller | 路由前缀 | 模块 |
|-----------|---------|------|
| AuthController | `/api/v1/auth` | sjzm-user |
| UserController | `/api/v1/users` | sjzm-user |
| CompetitorController | `/api/v1/competitor` | sjzm-product |
| ScoringController | `/api/v1/scoring` | sjzm-product |
| AsinImportController | `/api/v1/asin-import` | sjzm-product |
| FilterConfigController | `/api/v1/filter-config` | sjzm-product |
| UserFilterPresetController | `/api/v1/filter-presets` | sjzm-product |

## 网关路由映射

网关 (sjzm-gateway:9000) 将外部请求转发到内部微服务：

| 路由前缀 | 目标服务 | 说明 |
|---------|---------|------|
| `/api/v1/auth/**`, `/api/v1/users/**` | sjzm-user:8001 | 用户认证 |
| `/api/v1/products/**`, `/api/v1/selections/**`, `/api/v1/competitor/**`, `/api/v1/product-sales/**`, `/api/v1/filter-config/**`, `/api/v1/asin-import/**`, `/api/v1/scoring/**`, `/api/v1/filter-presets/**` | sjzm-product:8002 | 产品业务 |
| `/api/v1/final-drafts/**`, `/api/v1/materials/**`, `/api/v1/carriers/**` | sjzm-product:8002 | 暂由 product 承载 |
| `/api/v1/images/**`, `/api/v1/image-proxy/**` | sjzm-product:8002 | 图片相关 |

## 当前状态

**服务层已全部实现，无 TODO 骨架。** 功能覆盖：

| 模块 | 状态 | 说明 |
|------|------|------|
| 认证 | ✅ 完成 | 登录/注册/刷新/登出 + 内存黑名单 |
| 用户管理 | ✅ 完成 | 列表/详情/改密 |
| 竞品分析 | ✅ 完成 | 卖家精灵 API + 多维度过滤 + 分页查询 |
| 评分引擎 | ✅ 完成 | 多维加权评分 + S/A/B/C/D 等级 + 周标记 |
| ASIN 导入 | ✅ 完成 | Excel 解析 + 批量导入 + 任务管理 |
| 筛选预设 | ✅ 完成 | 用户级 5 槽位预设管理 |
| 网关鉴权 | ✅ 完成 | JWT + RBAC + 公开路径白名单 |

**仍在 Python 后端的功能：** 产品/选品/定稿/素材/运营商的 CRUD、图片管理、导入导出、报表、领星对接。

## Agent 修改规则

1. 新增 Entity 必须加 `@TableName` + `@TableId(type=IdType.ASSIGN_ID)` + `@TableLogic`
2. 新增 Controller 必须用 `@RestController` + `@RequestMapping` + `@Tag`（Swagger）
3. 新增 Service 必须先写接口再写 Impl，Impl 加 `@Service`
4. 新增 Mapper 必须继承 `BaseMapper<T>`
5. 响应统一用 `Result.success(data)` / `Result.error(message)`
6. 禁止在 Controller 写业务逻辑，禁止在 Mapper 写业务判断，禁止 Controller 直接注入 Mapper
7. 配置文件在 `src/main/resources/`，环境变量占位 `${ENV_VAR:default}`
