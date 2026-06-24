# 数据库设计

## 概述

- 数据库：MySQL 8.0
- 字符集：utf8mb4_unicode_ci
- ORM：Java 侧 MyBatis-Plus，Python 侧 SQLAlchemy/AIOMySQL
- ID 策略：Java 业务明细表多用雪花 ID（ASSIGN_ID），统计/汇总表可用自增，Python 侧自增/UUID

## 核心表

| 表名 | 说明 | Java Entity | Python Model |
|------|------|-------------|-------------|
| products | 产品主表 | Product.java | product.py |
| selections | 选品表 | Selection.java | selection.py |
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

### 核心建表脚本

| 文件 | 说明 |
|------|------|
| `init_database.sql` | 初始化数据库（生产） |
| `init_database_dev.sql` | 初始化数据库（开发） |
| `create_final_drafts_table.sql` | 定稿表 |
| `create_product_performance_actual.sql` | ③线真实战绩表 |
| `create_line_one_baselines.sql` | ①线大类/小类基线表 |
| `create_subcategory_alias_layer.sql` | 小类别名对齐层 + 小类基线 canonical 升级 |
| `create_material_carrier_tables.sql` | 素材库 + 运营商库 |
| `create_scoring_tables.sql` | 评分系统 |
| `system_log_tables.sql` | 系统日志 |
| `add_download_tasks_table.sql` | 下载任务 |

### 字段变更脚本

以 `add_` / `fix_` / `update_` / `remove_` 开头，记录每次表结构变更。

## 选品关键表补充

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
