# RDS 处理中心

> 财务日报、运营物流和 Listing 非破坏刷新的完整实施记录，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

`rds` 包是 Java product 服务访问远程 MySQL RDS 的边界。仓库级现状总账：`docs/rds中心/README.md`。

## 写入唯一入口

所有 RDS 写入必须通过
`service/RdsBatchWriteService.java`，业务 Service 不得直接提交 RDS Mapper 写操作。

- 逐行 insert/update/upsert：使用 `execute`，中心以 MyBatis `ExecutorType.BATCH`
  在同一连接和事务内分批 flush。
- MyBatis-Plus 实体新增：使用 `insert`。
- MyBatis-Plus 实体新增/更新：使用 `saveOrUpdate`。
- 一条集合 SQL、截断、状态更新或多语句原子操作：使用 `executeOne`。
- RDS 读取可以直接调用 Mapper。

禁止对 RDS 实体使用 `Db.saveBatch` / `Db.saveOrUpdateBatch`：`Db` 会按默认
SqlSession 选择主数据源，既可能写错库，也无法保证远程 RDS 批处理。

## 数据源绑定

- `config/RdsDataSourceConfig` 管理 RDS DataSource、SqlSessionFactory 和事务管理器。
- `rds.mapper` 与 `rds.finance.mapper` 直接绑定 RDS。
- 历史上位于 `com.sjzm.product.mapper` 的领星 Mapper，通过
  `LingxingRdsMapper` 标记接口绑定 RDS。

## 连接收束与管理中心

生产业务库连接只登记在 `config/`（见 `docs/database/connection-registry.md`）。
`RdsCenterCatalog` + `GET /api/v1/modules/rds-center/overview` 列出接口绑定；
Python `GET /api/v1/rds-center/status` 提供 FastAPI/Celery 池实况。前端模块
`frontend/src/modules/rds-management-center/`。

## 批次与观测

业务根据行大小选择批次，默认 200；常规结构化行可使用 500。中心统一记录
Mapper、写入行数、flush size 和耗时，任务阶段耗时由自动化运行审计继续记录。

财务日报刷新 `lingxing_listing` 时必须使用非破坏批量 upsert：先批量读取已有
`sid + seller_sku` 主键，再调用 `RdsBatchWriteService.saveOrUpdate`。财务任务禁止
清空 Listing；历史重算设置 `refreshListing=false`，只读取 RDS 已有事实。
