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

**仍在 Python 后端：** 产品/选品/定稿/素材/运营商的 CRUD。

## 功能模块（modules/）

| 模块 | 说明 | 详情 |
|------|------|------|
| bazhuayu | 八爪鱼云采集 + 以图识图 | `modules/bazhuayu/` |
| lingxing | 领星开放平台对接（token/签名 + 4 数据域 + 写回） | [README](sjzm-product/src/main/java/com/sjzm/product/modules/lingxing/README.md) |
| roster | 人员花名册 | `modules/roster/` |

## 包结构约定

```
com.sjzm.product/
├── controller/   # @RestController，只做参数校验和路由
├── service/      # 接口 + impl/，业务逻辑全部在此
├── mapper/       # 继承 BaseMapper<T>（含模块的 Mapper）
├── entity/       # @TableName + @TableId(ASSIGN_ID) + @TableLogic
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
        └── entity/       # 模块 Entity
```

## 模块化规则（新功能必须遵守）

新功能**必须**放 `com.sjzm.product.modules.xxx` 包下，自动被 `scanBasePackages` 扫描。

**关键约束：**
- 模块 Mapper 放 `com.sjzm.product.mapper` 包下（`@MapperScan` 只扫这个包）
- 模块 Controller/Service/Entity 放 `modules/xxx/` 下
- 模块 API 前缀：`/api/v1/modules/{module-id}/`
- 分层单向：模块 Controller → 模块 Service → 公共/模块 Mapper

## 铁律

1. **新增 Entity**: 必须 `@TableName` + `@TableId(type=IdType.ASSIGN_ID)` + `@TableLogic`
2. **新增 Controller**: `@RestController` + `@RequestMapping` + `@Tag`（Swagger）
3. **新增 Service**: 先写接口再写 Impl，Impl 加 `@Service`
4. **新增 Mapper**: 继承 `BaseMapper<T>`
5. **响应统一**: `Result.success(data)` / `Result.error(message)`
6. **配置**: `${ENV_VAR:default}` 占位，禁止硬编码
7. **禁止**: Controller 写业务 / Mapper 写判断 / Controller 直接注入 Mapper / 反向调用
8. **郑总批次唯一真相源**: 郑总盘子(`deng_zong_shop`)的批次解析全系统只走 `DengZongShopService.getMaxBatchDate(marketplace)` 一个口子，未传批次时用 `resolveBatchDate` 回退到最新批次。郑总相关聚合只按 `marketplace + batch_date` 过滤，**禁止再 AND `month`**（`batch_date` 已唯一标识数据快照，叠加独立的 `MAX(month)` 会误杀跨月行）。竞品表 `competitor_products` 才按业务选定的 `month` 过滤——两条线各自单一真相源，互不污染。

## 版本兼容

已验证的 Spring Boot 4.0.4 生态：
- MyBatis-Plus: 3.5.15（`spring-boot4-starter`，非 `boot-starter`）
- Spring Cloud: 2025.1.1（Oakwood）
- Spring Cloud Alibaba: 2025.1.0.0
- Redisson: 4.0.0
