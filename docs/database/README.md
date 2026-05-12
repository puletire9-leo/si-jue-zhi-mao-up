# 数据库设计

## 概述

- 数据库：MySQL 8.0
- 字符集：utf8mb4_unicode_ci
- ORM：Java 侧 MyBatis-Plus，Python 侧 SQLAlchemy/AIOMySQL
- ID 策略：Java 侧雪花 ID（ASSIGN_ID），Python 侧自增/UUID

## 核心表

| 表名 | 说明 | Java Entity | Python Model |
|------|------|-------------|-------------|
| products | 产品主表 | Product.java | product.py |
| selections | 选品表 | Selection.java | selection.py |
| final_drafts | 定稿表 | FinalDraft.java | final_draft.py |
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

SQL 迁移文件位于 `backend/migrations/`，按时间顺序排列。

### 核心建表脚本

| 文件 | 说明 |
|------|------|
| `init_database.sql` | 初始化数据库（生产） |
| `init_database_dev.sql` | 初始化数据库（开发） |
| `create_final_drafts_table.sql` | 定稿表 |
| `create_material_carrier_tables.sql` | 素材库 + 运营商库 |
| `create_scoring_tables.sql` | 评分系统 |
| `system_log_tables.sql` | 系统日志 |
| `add_download_tasks_table.sql` | 下载任务 |

### 字段变更脚本

以 `add_` / `fix_` / `update_` / `remove_` 开头，记录每次表结构变更。

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
