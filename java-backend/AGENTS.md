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
| DeveloperSelectionLibraryItem | DeveloperSelectionLibraryMapper | 开发个人好品/差品人工选品库 |
| DeveloperSelectionBatch | DeveloperSelectionBatchMapper | 开发个人好品/差品独立人工批次 |

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
| DeveloperSelectionLibraryController | `/api/v1/modules/developer-selection-library` | sjzm-product |

人工选品库管理员未显式指定目标开发人时，后端按有效用户记录匹配“刘淼”作为默认真实 owner；普通开发仍只能写入自己的 `user_id`。

卖家精灵请求中心任务列表支持按 `yyyy-MM` 和 `created_at` 自然月边界筛选；月度请求次数汇总必须对整月全部 `sellersprite_request_run.api_calls` 求和，不得受分页影响。
卖家精灵请求中心只有 `STOPPED/SUCCESS/PARTIAL_SUCCESS/FAILED` 终态任务可硬删除；必须先确认本进程 worker 已退出，再在同一事务内先删子项后删任务。删除会同步移除该任务的月度请求次数记录并解除来源幂等占用。
写入 `competitor_products` 的卖家精灵任务必须在 `competitor_products_clean` 刷新成功后才能进入 `SUCCESS/PARTIAL_SUCCESS`；clean 收尾失败必须进入 `PAUSED_SYSTEM`、记录可见原因并定时幂等重试，禁止吞异常后显示请求成功。
普通新品与精品 ASIN 请求都必须按“请求 ASIN 是否真实返回并写入”计算 `fetched_count/written_count/failed_count`；部分返回必须标记 `PARTIAL_SUCCESS`，禁止用 API 返回条数内部自洽冒充请求 ASIN 全部成功。
Java `AiSelectionController/Service/Entity/Mapper` 当前仅为预留源码，默认由 `features.ai-selection.enabled=false` 禁用，实体故意不声明 `@TableName`。在 `ai_selection` 表结构、唯一键和迁移完善前禁止生产开启；正式启用时必须先恢复显式表映射并通过生产预检。

店铺名称去除首尾空格后若忽略大小写精确等于 `Amazon`，请求中心必须标记跳过，执行网关必须在 HTTP 发出前硬拦截；不得增加卖家精灵使用次数。
方法卡找店支持两条独立来源：`METHOD_CARD/M01` 只同步当前周批次中 `m01_active=1` 的通过店铺；`BATCH_ALL/ALL_PRODUCTS` 同步 `competitor_products_clean.effective_week_tag` 当前批次全部有效店铺，不得附加任何方法卡通过条件。两条来源必须在候选池中可区分，批次全量入口仍需排除名称精确为 `Amazon` 的店铺。
请求中心店铺抓取必须分两个强语义接口：普通候选使用 `/shop-tasks/once`，按标准化 `(marketplace, seller_name)` 跨 M1、批次全量和其他来源永久去重；精品店铺池使用 `/shop-tasks/repeatable`，允许历史任务完成后按月/周期复抓，但存在活跃任务时不得并发重复。通用 `/tasks` 禁止创建 `SHOP_FULL_LOOKUP/CANDIDATE_BATCH/PREMIUM_REFRESH`，避免绕过去重策略。
非标店铺上新使用第三条独立入口 `/api/v1/deng-zong-shop/sync/batch`：输入必须是 `deng_zong_shop_seller` 登记 ID，任务类型固定为 `DENG_ZONG_SHOP_SYNC`，结果固定写 `deng_zong_shop`。历史终态任务允许复抓，活跃同店任务必须跳过；禁止写入 `shop_candidate_pool`、`shop_products` 或普通店铺快照。
旧单店 `/api/v1/deng-zong-shop/sync` 仅作兼容代理，必须先核验店铺已登记并转入同一专用创建服务；禁止接受任意店名直接绕过非标名单。
非标商品查询只要显式传入 `batchDate`，列表、总数、卖家汇总和评分数据都必须严格限定该批次；禁止用 `OR batch_date IS NULL` 混入历史无批次数据。未传批次时才允许查询历史全集。批次选项的 `count` 必须与商品列表一致，按 `COALESCE(NULLIF(parent_asin,''), asin)` 去重。
所有卖家名称驱动的店铺分页抓取，单店最多发出 10 次卖家精灵请求；达到上限后当前店铺按部分完成收口并继续下一个店铺，不得阻塞整批任务。

八爪鱼榜单配置允许同站点多条平级命名任务，不存在主/附加任务。每条任务保存 `task_category` 和 `initial_filter`。“导入DB”必须同步创建可见 `QUEUED` 任务并返回 taskId，后台按 `QUEUED → RUNNING → READY/ERROR` 收口；禁止自动调用卖家精灵。只有用户点击请求后才按任务元数据分流：精铺 `ASIN_BATCH_LOOKUP → competitor_products`，精品 `PREMIUM_ASIN_LOOKUP → premium_products`。精品链路禁止写新品榜表、`skip_asins` 或刷新 clean 层。
初筛判定顺序（2026-08，**价格/评论筛选已取消**）：ASIN 格式 → 文件内去重 → 已采过黑名单（非新品重取候选）→ 「新品重取放行判断」→ 主表已有（SKIP_MAIN）→ PASS。初筛不再按价格区间/评论上限淘汰（`PRICE_FAIL`/`REVIEW_FAIL` 桶保留但恒为 0），全部留给卖家精灵后精筛。**新品重取规则（取代旧的「API已请求<90天+导入超1月」时间闸）**：凡命中 `skip_asins`（不区分 `filter_reasons`）的 ASIN，若主表 `competitor_products` 当前 `listing_days < 30`（`NEW_PRODUCT_REFETCH_MAX_LISTING_DAYS`，`selectYoungAsinsInList` 判定，**不看销量**），则放行进 PASS 允许重新调用卖家精灵获取最新数据（重复 ASIN 可通过、重新获取）；否则该 skip 命中 ASIN 归 SKIP_BLACKLIST。强调"上架要新"（尤其八爪鱼采集页），只放行 30 天内新品。上架天数一律取主表实时值（每次采集刷新，非 `skip_asins` 快照），满 30 天后自动移出候选、天然收敛不无限重取；无时间闸，每次八爪鱼重爬都会重新判定放行。SKIP_MAIN 语义不变。
精品统一选品接口位于 `/api/v1/competitor/premium-*`，列表固定查询 `premium_products` 且强制 `deleted=0`。它复用竞品筛选字段，但始终是原始表，不查询 `competitor_subcategories`，变体统计也必须从 `premium_products` 计算。`methodId` 仅接受用户手动选择的 M01/M03，禁止 M02；CSV 白名单数据源为 `premium_products`，必须导出该表完整字段。
精品页面、批次、类目、卖家、变体和页面 CSV 只允许读取 `sellersprite_raw_json` 非空的已补全记录；八爪鱼原始空壳仅作为请求中心暂存，禁止出现在用户选品页面。
统一选品前端的“上架时间”排序参数为 `listingDate`，Java 查询必须映射到 `available_date`，空值固定置后并用 ASIN 作为稳定次排序；不得落入默认销量排序。
M01 一级分类统计与 M01 商品分页必须复用 `MethodCardMapper.M01Where`，共同受 marketplace、有效周批次、BSR/node 和 M01 阈值约束。分类值固定为 `TRIM(SUBSTRING_INDEX(node_label_path, ':', 1))`，排除空值/文本 null；分类筛选使用 JSON 字符串数组的 POST 接口，禁止 CSV 拆分。
店铺选品分类聚合与商品分页必须共用 `ShopCollectionService.buildSelectionProductFilter`；分类统计忽略当前 categories 自身，但保留 marketplace、methodId、batchDates、价格/销量/上架/BSR/重量/变体/配送等条件。店铺分类按完整 `node_label_path` 聚合并精确 IN 筛选，榜单 count 必须等于选择该分类后的分页 total。
统一选品的新品榜周批次统计必须按页面 `useCleanTable` 选择 `competitor_products_clean` 或 `competitor_products`；店铺选品的 `shop_products.batch_date` 必须按 ISO 周聚合并允许商品分页按 `yyyy-Www` 周值过滤。
选品详情响应必须返回决策面板所需的完整规格和追踪字段：`dimensionsType/pkgDimensions/pkgDimensionType/pkgWeight/lqs/updatedAt`；精品数据还要返回 `bazhuayuMappingId/bazhuayuTaskId/bazhuayuTaskName/sourceRunId`。`PremiumProductMapper.selectListForSelection` 必须映射为 `PremiumProduct`，否则子类任务元数据会在转 DTO 前丢失。
精品请求必须按 `(marketplace, asin)` 跳过 `sellersprite_raw_json` 已存在的商品，禁止跨站点去重。卖家精灵只返回部分请求 ASIN 时，子项和任务必须标记 `PARTIAL_SUCCESS`，`failed_count` 记录未返回数量；不得用返回数量冒充请求数量并显示全成功。
八爪鱼任务配置页必须通过 `/cloudextraction/statuses/v2` 自动展示最新云采集批次：批次号由 `startExecuteTime` 格式化为 `yyyyMMdd-HHmmss`，同时展示开始/结束时间、本批次数量和状态。“导入DB”请求必须携带页面显示的批次元数据，后端二次校验当前最新批次完全一致且状态为 Finished 后才能异步导入，禁止点击后静默切换到更新批次。系统自身启动云采集时使用 `/data/lotno/all` + start 返回的真实 `lotNo` 精确读取；八爪鱼网页手动或定时启动但开放接口不返回 `lotNo` 时，使用 `statuses/v2.currentTotalExtractCount` 锁定最新批次 N，只读取 `/data/all` 最前 N 行并立即停止，严禁按 `/data/all.total` 的历史累计量导入；接口总量少于 N 时拒绝按不完整批次收口。`/data/notexported` 只保留给无人值守的精铺增量 drain，不能用于精品人工导入。
Amazon 以图识图任务构造 StyleSnap/Shop the Look URL 前必须移除 Amazon CDN 的 `US200/SX` 等缩略图修饰符、清理 Markdown 反斜杠转义并编码原图 URL，避免低分辨率图片被静默退回默认上传页。

生产数据库保护：product Hikari 默认 min 3/max 15，user 默认 min 2/max 5，连接等待 5 秒；MySQL 硬上限 60。统一店铺聚合等大型查询必须通过 `DatabaseWorkloadGate`（并发 2），全量 CSV 并发 1，八爪鱼导入DB、文件导入、评分重算和 clean 层批量写入并发 1。普通分页/详情/小型 CRUD 不进入门禁；卖家精灵请求中心保持现有单线程。

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
8. 新增/修改 `@TableName` Entity 必须同步 `java-backend/sql/*.sql` 迁移；`prod-java-product` 启动时 `SchemaGuard` 会校验表/列，缺失会启动失败
9. 新增 Java `/api/v1/{resource}` Controller 必须同步 `frontend/nginx.conf` Java 路由，并在部署前运行 `scripts/deploy/prod_preflight_check.ps1`
