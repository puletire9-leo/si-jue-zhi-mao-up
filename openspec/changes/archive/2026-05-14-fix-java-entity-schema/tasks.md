## 1. 数据库 schema 审计

- [x] 1.1 导出 sijuelishi 全部表结构（SHOW COLUMNS FROM each table）
- [x] 1.2 整理 Java Entity vs DB 差异清单（表名/列名/类型/主键）

## 2. 核心实体修复（products + users）

- [x] 2.1 修复 Product.java：@TableName、字段名、主键策略、时间类型
- [x] 2.2 修复 User.java：@TableName(users)、字段对齐
- [x] 2.3 验证：GET /api/v1/products 返回 200
- [x] 2.4 验证：POST /api/v1/auth/login 返回 token

## 3. 业务实体修复

- [x] 3.1 FinalDraft.java — @TableName 已正确，无需修改
- [x] 3.2 Selection.java — @TableName 已正确，无需修改
- [x] 3.3 MaterialLibrary.java — @TableName 已正确，无需修改
- [x] 3.4 CarrierLibrary.java — @TableName 已正确，无需修改
- [x] 3.5 Category.java, Tag.java — @TableName 已正确，无需修改
- [x] 3.6 Image.java — @TableName 已正确；ImageVector 表不存在，跳过

## 4. 辅助实体修复

- [x] 4.1 DownloadTask.java, FileLink.java — API 测试通过，无需修改
- [x] 4.2 Role.java, Permission.java, RolePermission.java — API 测试通过，无需修改
- [x] 4.3 RecycleBin 系列 — API 测试通过，无需修改
- [x] 4.4 ScoringConfig.java, GradeThreshold.java — 无需修改

## 5. 编译与回归

- [x] 5.1 mvn compile -DskipTests 零错误
- [x] 5.2 Spring Boot 启动成功，health check UP
- [x] 5.3 全部 12 个核心 API 端点测试通过
- [x] 5.4 Java 后端可独立运行于 8090 端口，health + API 全通
