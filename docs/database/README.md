# 数据库设计

## 概述

- 数据库：MySQL 8.0
- 字符集：utf8mb4_unicode_ci
- ORM：Java 侧 MyBatis-Plus，Python 侧 SQLAlchemy/AIOMySQL
- ID 策略：Java 业务明细表多用雪花 ID（ASSIGN_ID），统计/汇总表可用自增，Python 侧自增/UUID

财务日报、运营物流、自动化中心、领星请求队列和人员维度相关表/SQL，统一见 [财务与运营自动化任务完整实施记录](../架构/财务与运营自动化任务完整实施记录.md)。

## 核心表

| 表名 | 说明 | Java Entity | Python Model |
|------|------|-------------|-------------|
| products | 产品主表 | Product.java | product.py |
| selections | 选品表 | Selection.java | selection.py |
| developer_selection_library | 开发个人好品/差品人工选品库 | DeveloperSelectionLibraryItem.java | - |
| developer_selection_batch | 开发个人好品/差品独立人工批次 | DeveloperSelectionBatch.java | - |
| final_drafts | 定稿表 | FinalDraft.java | final_draft.py |
| product_performance_actual | ③线真实战绩表 | ProductPerformanceActual.java | - |
| category_bsr_baseline | ①线大类 BSR 分桶基线 | CategoryBsrBaseline.java | - |
| subcategory_baseline | ①线赢家小类基线 | SubcategoryBaseline.java | - |
| subcategory_alias_map | 小类别名对齐层 | SubcategoryAliasMap.java | - |
| material_library | 素材库 | MaterialLibrary.java | material_library.py |
| carrier_library | 运营商库 | CarrierLibrary.java | carrier_library.py |
| categories | 分类 | Category.java | - |
| tags | 标签 | Tag.java | - |
| users | 用户 | User.java | - |
| scoring_config | 评分配置 | - | scoring.py |
| scoring_records | 评分记录 | - | scoring.py |
| download_tasks | 下载任务 | - | download_task.py |
| file_links | 文件链接 | - | file_link.py |
| system_logs | 系统日志 | - | system_log.py |
| backup_records | 备份记录 | - | - |
| bazhuayu_task_mapping | 八爪鱼平级命名任务，同功能同站点允许多个任务，并保存分类/初筛开关 | BazhuayuTaskMapping.java | - |
| premium_products | 精品榜独立商品数据；复制卖家精灵商品字段，不进入新品榜初筛与 clean 层 | PremiumProduct.java | - |
| person_roster | 统一人员维度配置；按职能、生效日期和失效日期维护 | PersonRoster.java | - |

## 通用字段

所有表包含以下审计字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键（雪花 ID 或自增） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| deleted | TINYINT(1) | 逻辑删除（0=正常, 1=删除） |

## 迁移文件

当前项目的数据库 DDL 以 `java-backend/sql/` 为准，按功能拆分维护。

### 迁移门禁

Java product 已启用启动期 `SchemaGuard`：

- 扫描 `com.sjzm.product` 下所有 `@TableName` 实体。
- 到当前数据库 `information_schema` 核对表和实体字段对应列。
- 生产默认 `fail-fast=true`，缺表/缺列会让 `prod-java-product` 启动失败。

因此新增或修改 Entity 时必须同步完成：

1. 新增/更新 `java-backend/sql/*.sql` 迁移文件。
2. SQL 尽量使用 `CREATE TABLE IF NOT EXISTS` 或 `information_schema` 守卫，保证可重跑。
3. 生产部署前执行 `scripts/deploy/prod_preflight_check.ps1`。
4. 生产库执行迁移后再构建/重启 Java 镜像。

这条链路的目标是让“缺表/缺列”在部署阶段暴露，不再拖到页面运行时报 500。

### 生产 MySQL binlog 保留策略

生产当前是单机 MySQL，没有主从复制。binlog 只用于短期误操作恢复，固定保留 7 天；允许的安全范围
是 3-7 天，禁止恢复成 MySQL 默认 30 天或无限保留。`docker-compose.prod.yml` 通过
`MYSQL_BINLOG_EXPIRE_SECONDS` 注入，默认值和生产公共配置均为 `604800` 秒。

生产预检会强制检查：

- `binlog_expire_logs_seconds` 必须在 `259200-604800` 秒之间。
- 复制通道必须为 0；若未来启用主从复制，必须先重新设计保留期，不能继续套用单机策略。
- binlog 总量不得超过 5 GB；超过时停止部署，先调查异常写入量并安全清理。

只能通过 MySQL 清理过期日志，禁止在数据卷中执行 `rm binlog.*`：

```sql
SET PERSIST binlog_expire_logs_seconds = 604800;
PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 7 DAY);
```

执行 purge 前必须确认 `performance_schema.replication_connection_configuration` 没有复制通道，并先完成
可恢复的数据库备份。`si-jue-zhi-mao-up_prod-mysql-data` 是受保护生产卷，禁止手工修改其文件。

### 核心建表脚本

| 文件 | 说明 |
|------|------|
| `init_database.sql` | 初始化数据库（生产） |
| `init_database_dev.sql` | 初始化数据库（开发） |
| `create_final_drafts_table.sql` | 定稿表 |
| `create_product_performance_actual.sql` | ③线真实战绩表 |
| `create_line_one_baselines.sql` | ①线大类/小类基线表 |
| `create_subcategory_alias_layer.sql` | 小类别名对齐层 + 小类基线 canonical 升级 |
| `create_bazhuayu_weekly_raw.sql` | 八爪鱼每周原始采集表 |
| `create_bazhuayu_task_mapping.sql` | 八爪鱼多任务映射表 |
| `create_premium_products.sql` | 精品榜独立卖家精灵商品表 |
| `create_bazhuayu_image_search_result.sql` | 八爪鱼以图识图缓存结果表 |
| `create_product_line_guidance.sql` | 品线指导记录表 |
| `create_analysis_baseline_tables.sql` | analysis-baseline 画像/方法证据/商品家族表 |
| `create_shop_collection_tables.sql` | 店铺全集商品与观察池表 |
| `create_shop_candidate_tables.sql` | 店铺候选池与抓取运行记录表 |
| `create_sellersprite_request_center_tables.sql` | 卖家精灵请求中心与精品店铺池表 |
| `create_lingxing_request_center_tables.sql` | 领星请求中心统一任务表 |
| `create_data_processing_automation_center.sql` | 数据处理中心与自动化中心基础设施（任务配置/运行审计/绑定表） |
| `create_lingxing_automation_request_registry.sql` | 领星自动化请求注册、周期排期与错峰槽位 |
| `seed_lingxing_automation_request_registry.sql` | 运营物流默认注册项（默认停用，验证后启用） |
| `seed_finance_daily_report_automation.sql` | 财务日报自动化任务与领星请求注册项（默认停用，待飞书权限验证） |
| `create_person_roster.sql` | 统一开发/运营/产品负责人/采购人员名单 |
| `seed_person_roster_finance_dimensions.sql` | 财务日报运营名单及 2026-08 开发人员生效区间 |
| `create_operations_logistics_purchase_progress.sql` | 运营物流采购进度业务标准表 |
| `expand_lingxing_shipment_tables_full_fields.sql` | 补齐艾为完整实际 SP / 发货计划字段 |
| `create_material_carrier_tables.sql` | 素材库 + 运营商库 |
| `create_developer_selection_library.sql` | 开发个人好品/差品人工选品库 |
| `create_scoring_tables.sql` | 评分系统 |
| `system_log_tables.sql` | 系统日志 |
| `add_download_tasks_table.sql` | 下载任务 |

### 字段变更脚本

以 `add_` / `fix_` / `update_` / `remove_` 开头，记录每次表结构变更。

近期必须保留的补丁脚本：

| 文件 | 说明 |
|------|------|
| `add_ai_selection_asin_index.sql` | AI 选品为 `shop_products` / `competitor_products_clean` 增加 `(asin, marketplace)` 查询索引 |
| `improve_guapai_recall_20260728.sql` | 非标载体增加条件排除词和成品保护词，并补齐亚克力/玻璃挂牌召回词 |
| `add_batch_code_to_shop_products.sql` | 店铺全集增加 ISO 周批次 |
| `add_competitor_lookup_log_pages_total.sql` | 竞品查询日志补齐 `pages` / `total` |
| `add_bazhuayu_task_initial_filter.sql` | 八爪鱼命名任务增加是否初筛开关；历史精品任务默认关闭 |
| `add_bazhuayu_task_category_and_import_metadata.sql` | 八爪鱼任务增加分类；导入任务记录来源、初筛和目标表 |
| `add_asin_import_completed_at.sql` | 导入任务增加真实终态完成时间；必须在发布新 Java 实体前执行 |
| `alter_person_roster_effective_dates.sql` | 人员名单增加 `effective_from/effective_to` 报表日期区间 |

### 八爪鱼榜单任务分流

- 所有八爪鱼命名任务平级，不存在主任务/附加任务；`task_category` 由用户维护，例如精铺、精品。
- `initial_filter=1`：保持精铺现有流程，八爪鱼原始数据进入 `bazhuayu_weekly_raw`，生成初筛任务。
- `initial_filter=0`：不做价格、评论、主表或黑名单筛选，全部合法唯一 ASIN 作为 PASS 生成可见导入任务。
- “导入DB”同步生成 `QUEUED` 任务并立即返回 taskId，后台按 `QUEUED → RUNNING → READY/ERROR` 执行；绝不自动调用卖家精灵。用户在任务列表点击“请求卖家精灵”后，才创建请求中心任务。
- `updated_at` 表示最近更新时间；`completed_at` 只在 `READY/DONE/ERROR/REJECTED/CANCELLED` 等终态写入，前端不得用 `updated_at` 冒充完成时间。
- 手动请求时按任务的 `target_table` 分流：精铺使用 `ASIN_BATCH_LOOKUP → competitor_products`，精品使用 `PREMIUM_ASIN_LOOKUP → premium_products`。
- 精品链路不写 `competitor_products`、不写 `skip_asins`、不刷新 `competitor_products_clean`，因此不会污染新品榜或影响后续精铺去重。

## 选品关键表补充

### `developer_selection_library`

- 数据按 `user_id` 隔离，普通开发只能查看、转换和移出自己的商品。
- 管理员可以查看全部开发，并按开发人员筛选。
- `developer_name` 用于卡片姓名标签，`bucket` 只取 `GOOD` / `BAD`。
- 同一开发、站点、ASIN 唯一；重复加入会更新快照，加入另一库会直接转换。
- `snapshot_json` 保存加入时的完整商品数据，核心卡片字段同时拆列便于查询。
- 周周期按 `created_at`（加入人工选品库时间）实时计算 ISO 周，支持单周或多周组合筛选；CSV 导出沿用相同权限与筛选条件。
- `batch_id` 可空；为空表示“未加入分类”，有值时只能指向同一开发、同一 `bucket` 的人工批次。好品/差品转换会清空该字段。
- 列表与 CSV 返回 `batchId` 和 `batchName`，支持按具体批次或未分类筛选。

### `developer_selection_batch`

- 批次按 `user_id + bucket` 隔离，好品和差品可建立同名批次，互不共享。
- `batch_name` 是开发手工维护的分类标签，前端新建时默认使用当天 `M.d`，`batch_date` 保存创建日期。
- 普通开发只可查看和操作自己的批次；管理员需先选开发人员再创建批次。
- 管理员默认开发人为有效用户“刘淼”；管理员加入商品或未更改默认选项新建批次时，`user_id` 必须写入刘淼账号，而不是系统管理员账号。
- 一个商品最多加入一个批次；批量归类会校验商品与批次的开发人员、好/差品库一致性。

### `product_performance_actual`

- ③线真实赢家导入表
- 当前 Step 1 使用 `docs/选品方法库/产品表现ASIN_转换版2.md`
- 开发库已完成 591 条导入验证

### `category_bsr_baseline`

- ①线大类 BSR 分桶基线表
- 口径：`marketplace × bsr_id × bsr_bucket × baseline_month`
- 当前已通过真实接口和真实库验证

### `subcategory_alias_map`

- ①线小类别名对齐层
- 同时承载：
  - `WINNER`：③线赢家小类种子
  - `COMPETITOR`：竞品末级类目种子
- 关键字段：
  - `canonical_key`：统一小类 key
  - `canonical_name`：统一展示名
  - `match_method`：`WINNER_RAW / WINNER_EXACT / CATEGORY_RULE / MANUAL / MANUAL_BATCH`
  - `status`：`APPROVED / PENDING / REJECTED`
- 当前 dev 实现状态：
  - winner seed 自动落为**方向 canonical**（`raw_subcategory -> canonical_key`）
  - competitor 只在**同名命中**或**类别规则唯一命中赢家方向**时自动批准
  - `carrier_hint` 只保留为上下文，不再用于定义 canonical
- 业务口径：
  - `subcategory_alias_map` 只做**小类方向对齐**
  - 具体载体应由**标题解析层**提取,不能由小类名直接代替
  - `carrier` 的事实来源应回到 `final_drafts` / `product_performance_actual` / 市场达标候选

### `subcategory_baseline`

- ①线赢家小类基线表
- 已从原来的 `sub_category` 精确匹配升级为 `canonical_key` 聚合
- 当前唯一键为：`marketplace + canonical_key + baseline_month`
- `sub_category` 保留为展示名，查询侧允许原始小类名经 alias layer 解析后命中 canonical 基线

## 数据库连接

### 领星周链路与财务日链路（2026-08-20）

- 周、日产品表现请求均固定传 `currency_code=GBP`，UK/DE 金额由领星在请求阶段统一换算；周加工只消费 GBP 来源事实。相关表以 RDS 为主数据源，本地库仅保留历史副本。
- 首轮迁移通过 `scripts/migrate_lingxing_weekly_to_rds.py` 幂等 upsert 完成，不删除 RDS 现有数据，所有表均已按源/目标行数校验。
- `lingxing_product_unified_marketplace` 物化统一表 ASIN 与 UK/DE 的多对多来源关系，不改变原统一表“一 ASIN 一行”主键；两站的 `currency_code` 均记录为 GBP。
- 财务日事实使用 `lingxing_product_performance_daily.marketplace` 保留 UK/DE。自动化在日事实落库后，按当天日事实重算 `lingxing_product_unified_daily`（国家+ASIN）；SKU 总量等于该日快照，不用最新统一表覆盖历史日。飞书仍输出 ALL/GBP。
- DDL：`create_lingxing_product_unified_daily.sql`。
- 历史事实不原地改写币种；历史周/日数据只有经领星按 GBP 重拉后才能进入新的统一 GBP 口径。
- `lingxing_finance_asin_status_snapshot` 主键为 `(snapshot_date, marketplace, asin)`，相同 ASIN 跨站点的状态互不继承。
- DDL：`create_lingxing_product_unified_marketplace.sql` 和 `migrate_finance_daily_marketplace.sql`。

### RDS 连接（同一实例，两个库，四份 env）

实例 `rm-bp1ft07y37887765cqo`，公网 IP `101.37.51.239`，不是两套 RDS。

| 变量 | 文件 | 库 | 谁连 |
|------|------|----|------|
| `USER_MYSQL_*` | `config/public/user-prod.env` + `config/secrets/user-prod.env` | `ai_platform` | java-user；backend/celery 也会加载 |
| `RDS_*` | `config/public/prod.env` + `config/secrets/prod.env` | `sijuelishi` | java-product（领星/财务/运营物流） |
| `MYSQL_*` | `config/public/prod.env` + `config/secrets/prod.env` | 本机 Docker `sijuelishi` | product / Python / Celery 主库 |

`application.yml` 只读环境变量。`config/secrets/finance_rds.env` 只给本机离线脚本，Docker 不读。

### RDS 统一用户表

`ai_platform.users` 同时保留平台字符串主键 `id` 和思觉智贸数字主键
`numeric_id`。Java 用户服务通过 `USER_MYSQL_*` 连接该库，以
`numeric_id` 生成 JWT，并兼容平台明文密码与历史 BCrypt 密码。账号合并按
`username` 去重，目标库已有账号、密码、角色和状态全部保留；只新增缺失的有效
账号。迁移脚本见 `java-backend/sql/merge_users_into_ai_platform.sql`。

### Java 后端
```
jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
```

### Python 后端
```
mysql+aiomysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
```

## 注意事项

1. **双后端共享同一数据库**：Java 和 Python 操作相同的表，需注意事务隔离
2. **迁移顺序**：新迁移先在开发库验证，再应用到生产库
3. **禁止 DML 在迁移文件中**：迁移文件只放 DDL，数据变更用独立脚本
4. **备份**：生产环境变更前必须备份，使用 `system-config/backup` API
