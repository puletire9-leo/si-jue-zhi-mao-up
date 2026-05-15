## Why

Java 后端 204 个源文件编译通过、Spring Boot 启动成功、MySQL/Redis 全部健康，但所有 API 返回 500——因为 22 个 Entity 的 `@TableName` 和字段映射与实际数据库列名不匹配。数据库是按 Python 后端建的（SKU 主键、varchar 时间、snake_case 列名），Java 实体是独立设计的（自增 ID、datetime、camelCase 字段）。必须先对齐才能让 Java 后端可用，之后才能基于可工作的单体进行微服务拆分。

## What Changes

- 逐一核对 22 个 Entity 的 `@TableName` 与数据库表名对齐
- 逐一核对每个 Entity 的字段名（`@TableField`）与数据库列名对齐
- 修正主键策略（数据库用 SKU/varchar 作主键的，Java 不能用 `@TableId(type = IdType.AUTO)`）
- 修正时间字段类型（数据库 `create_time` 为 varchar(100)，不能用 `LocalDateTime`）
- 修正后逐个 API 端点验证（至少 product/login/auth/selection 四个核心模块通过）
- 非 `id` 主键的表不需要 `id` 列，实体移除 `id` 字段

## Capabilities

### New Capabilities

- `entity-schema-alignment`: 所有 Java Entity 字段与 MySQL 数据库列名/类型精确匹配，MyBatis-Plus 可正常 CRUD

## Impact

- **Java Entity 层**: 22 个 entity 文件，字段名/类型/主键策略全部核对修正
- **Java Mapper 层**: 自定义 SQL 中的列名引用需同步修正
- **数据库**: 不修改（Python 后端持续依赖现有 schema）
- **编译**: 字段类型变更可能导致编译错误，需同步修正 Service 层引用
