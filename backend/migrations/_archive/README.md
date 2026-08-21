# 归档的冗余迁移脚本（2026-08-13）

这些是历史迁移的**冗余版本**，已被主目录的权威版本取代。归档保留可追溯，**不要再执行**。

| 归档文件 | 被谁取代 | 差异 |
|---------|---------|------|
| `add_grade_fields.sql` | `../add_grade_fields_fixed.sql` | fixed 版用 INFORMATION_SCHEMA 判断，幂等 |
| `init_scoring_system_simple.sql` | `../init_scoring_system.sql` | 建同样两表；保留 init 版因 `fix_scoring.py` 提示指向它 |
| `create_scoring_tables.sql` | `../init_scoring_system.sql` | 内容与 init 版一致 |
| `add_image_storage_fields_sijuelishi.sql` | `../add_image_storage_fields.sql` | 唯一差别是 `USE sijuelishi` vs `USE sijuelishi_dev`（库名硬编码） |
| `add_original_image_metadata.sql` | `../add_original_image_metadata_single.sql` | single 版一条 ALTER 加全部字段 |
| `init_database_dev.sql` | `../init_database.sql` | 仅库名 dev vs 生产 |
| `fix_carrier_sku.sql` | `../remove_carrier_sku.sql` | fix 先改 sku 允许 NULL，remove 是最终态直接 DROP 列 |

> 注：`../_oneoff_queries/` 存放的是从迁移目录移出的纯查询脚本（check_/debug_，只有 SELECT 无 DDL），非迁移。
