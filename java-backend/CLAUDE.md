# Java 后端 - Claude 自动加载上下文

> Spring Boot 4.0.4 + MyBatis-Plus 3.5.15 + Spring Cloud Gateway。详情见 [AGENTS.md](AGENTS.md)。

## 微服务模块

| 模块 | 端口 | 职责 |
|------|------|------|
| sjzm-gateway | 9000 | 网关（路由 + JWT 鉴权 + RBAC） |
| sjzm-user | 8001 | 用户认证 + 用户管理 |
| sjzm-product | 8002 | 竞品分析 + 评分引擎 + ASIN 导入 + 筛选预设 |
| sjzm-common | - | 公共组件（Result/JWT/注解/AOP/MQ/限流/缓存） |

## 当前状态

服务层全部实现，无 TODO 骨架。实际功能范围：

- ✅ 认证（登录/注册/刷新/登出 + JWT 黑名单）
- ✅ 竞品分析（卖家精灵 API + 多维过滤 + 分页）
- ✅ 评分引擎（多维加权 + S/A/B/C/D 等级 + 周标记）
- ✅ ASIN 导入（Excel 解析 + 批量导入 + 任务管理）
- ✅ 筛选预设（用户 5 槽位 CRUD）
- ✅ 网关（JWT + RBAC + 公开路径白名单）
- ✅ 领星对接（店铺/本地产品/产品表现/利润 4 数据域落库 + 本地产品写回）
- ✅ 财务日报 / 运营物流自动化（UK+DE 统一 GBP、RDS 批写、三中心前端；最新 Listing 增量待生产发布，见 `docs/架构/财务与运营自动化任务完整实施记录.md`）
- ✅ analysis-baseline 层骨架（店铺画像实时聚合 + 物化快照、店铺基线 CRUD + 定位、商品族证据 CRUD、method_product_hit 命中缓存表预留）；自动聚类 / M06 消费待补

**仍在 Python 后端：** 产品/选品/定稿/素材/运营商的 CRUD（已核实 Java 端无对应 Controller）。

## 功能模块（modules/）

路径：`java-backend/sjzm-product/src/main/java/com/sjzm/product/modules/`

| 模块 | 说明 | 详情 |
|------|------|------|
| analysisbaseline | analysis-baseline 数据加工层：店铺画像 / 店铺基线 / 商品族证据 / 方法卡命中缓存 | `modules/analysisbaseline/` |
| shoprating | 店铺品级 + 店铺方法卡排名（消费 m01_active 命中标） | `modules/shoprating/` |
| bazhuayu | 八爪鱼云采集 + 以图识图 | `modules/bazhuayu/` |
| lingxing | 领星开放平台对接（token/签名 + 4 数据域 + 写回） | [README](sjzm-product/src/main/java/com/sjzm/product/modules/lingxing/README.md) |
| categorytree | 类目树 | `modules/categorytree/` |
| roster | 人员花名册（含生效/失效日期） | `modules/roster/` |
| automation | 自动化中心：财务日报 / 运营物流排期、互斥、运行审计 | `modules/automation/` |
| dataprocessing | 数据处理中心：运营物流 FIFO 与三状态物化 | `modules/dataprocessing/` |
| feishu | 飞书对接：凭证、token、多维表格幂等投递 | `modules/feishu/` |

财务日报与运营物流自动化的当前口径、RDS 批写、前端三中心和生产发布状态，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

## 包结构约定

```
com.sjzm.product/
├── controller/   # @RestController，只做参数校验和路由
├── service/      # 接口 + impl/，业务逻辑全部在此
├── mapper/       # 继承 BaseMapper<T>（含模块的 Mapper）
├── entity/       # @TableName + @TableId + 视情况 @TableLogic
├── config/       # 配置类
├── security/     # JWT 认证
├── annotation/   # 自定义注解（限流/缓存/追踪）
├── aspect/       # AOP 切面
├── mq/           # RocketMQ 生产者/消费者
└── modules/      # 功能模块（即插即用）
    └── xxx/
        ├── controller/   # 模块 Controller
        ├── service/      # 模块 Service
        │   └── impl/
        ├── entity/       # 模块 Entity
        └── mapper/       # 由 @MapperScan 显式加入 mapper 包（见 ProductApplication）
```

> 注：`@MapperScan` 现已显式列出 `modules.analysisbaseline.{shopprofile,productfamily,methodevidence}.mapper`。新增模块若把 Mapper 放在 `modules/xxx/mapper` 下，**必须在 `ProductApplication.@MapperScan` 注册**——否则编译过但运行时注入失败。

## 模块化规则（新功能必须遵守）

新功能**必须**放 `com.sjzm.product.modules.xxx` 包下，自动被 `scanBasePackages` 扫描。

**关键约束：**
- 模块 Mapper 默认放 `com.sjzm.product.mapper`（老约定）；若放在 `modules/xxx/mapper/`，必须在 `ProductApplication.@MapperScan` 显式注册
- 模块 Controller/Service/Entity 放 `modules/xxx/` 下
- 模块 API 前缀：老模块用 `/api/v1/modules/{module-id}/`；analysisbaseline 因面向前端消费，用领域路径 `/api/v1/shop-profile`、`/api/v1/analysis-baseline/product-families`。新模块两种均可，但同模块内保持一致
- 分层单向：模块 Controller → 模块 Service → 公共/模块 Mapper

## 铁律

1. **新增 Entity**: 必须 `@TableName` + `@TableId`（类型与 DDL 主键一致）。`@TableLogic` 仅当表有 `deleted` 字段时才加——仓库现状多数表用 `status='ACTIVE/INACTIVE'` 软删而非 `@TableLogic`，属正常，不强求。主键类型选择：业务实体（用户/竞品/导入任务等）用 `IdType.ASSIGN_ID`；batch 物化表（`AUTO_INCREMENT` + `ON DUPLICATE KEY UPDATE`）用 `IdType.AUTO`，由 DDL 决定，不要硬套 ASSIGN_ID
2. **新增 Controller**: `@RestController` + `@RequestMapping` + `@Tag`（Swagger）
3. **新增 Service**: 先写接口再写 Impl，Impl 加 `@Service`
4. **新增 Mapper**: 继承 `BaseMapper<T>`；若放在 `modules/xxx/mapper/` 必须在 `ProductApplication.@MapperScan` 注册
5. **响应统一**: `Result.success(data)` / `Result.error(message)`
6. **配置**: `${ENV_VAR:default}` 占位，禁止硬编码
7. **禁止**: Controller 写业务 / Mapper 写判断 / Controller 直接注入 Mapper / 反向调用
8. **郑总批次唯一真相源**: 郑总盘子(`deng_zong_shop`)的批次解析全系统只走 `DengZongShopService.getMaxBatchDate(marketplace)` 一个口子，未传批次时用 `resolveBatchDate` 回退到最新批次。**禁止在郑总相关聚合里另写 `SELECT MAX(batch_date) FROM deng_zong_shop` 兄弟方法**——两套口径一旦分叉，店铺画像/方法卡/列表会算到不同批次。郑总相关聚合只按 `marketplace + batch_date` 过滤，**禁止再 AND `month`**（`batch_date` 已唯一标识数据快照，叠加独立的 `MAX(month)` 会误杀跨月行）。竞品表 `competitor_products` 才按业务选定的 `month` 过滤——两条线各自单一真相源，互不污染。
9. **市场编码**: `marketplace` 对齐卖家精灵市场编码，当前只支持 `UK / DE / US`。它必须是具体国家站点，禁止把 `ALL` 当 marketplace；需要跨市场汇总时另做显式汇总接口或前端组合。

## 版本兼容

已验证的 Spring Boot 4.0.4 生态：
- MyBatis-Plus: 3.5.15（`spring-boot4-starter`，非 `boot-starter`）
- Spring Cloud: 2025.1.1（Oakwood）
- Spring Cloud Alibaba: 2025.1.0.0
- Redisson: 4.0.0
