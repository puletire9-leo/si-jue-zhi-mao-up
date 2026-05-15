## Context

Java 后端 Entity/Mapper 与 MySQL 实际 schema 不匹配。数据库由 Python 后端创建并持续使用，不能修改。Java 端只能调整代码适配现有 schema。

## Decisions

- **不修改数据库**：Python 后端依赖现有 schema，零改动
- **字段映射用 `@TableField`**：不使用 MyBatis-Plus 自动驼峰转下划线（已有 `map-underscore-to-camel-case: true`，但实际列名更复杂）
- **主键策略**：SKU 做主键的表用 `@TableId(type = IdType.INPUT)`，手动赋值
- **时间字段**：数据库为 varchar(100) 的，Java 用 `String` 类型
- **验证顺序**：先核心表（products, users, final_drafts, selection_products），再辅助表
