## Why

八爪鱼任务状态接口能够识别最新 Finished 批次及其开始时间、结束时间和采集数量，但网页或八爪鱼定时启动的批次通常没有真实 `lotNo`。当前后端在 `lotNo` 缺失时调用 `/data/all`，并以该接口返回的历史累计 `total` 作为本次导入目标，导致一次 50,090 条的新批次触发 287,753 条历史数据重新读取。批次元数据校验因此只验证了“用户看到哪个批次”，没有约束“实际读取哪一批数据”。

该行为会浪费八爪鱼 API、数据库和初筛资源，并可能污染批次任务统计。系统必须恢复批次边界保护，并将“无法证明只读取目标批次”视为错误，而不是静默退化为全量导入。

## What Changes

- 将批次读取策略明确分为精确模式和受限快照模式：有真实 `lotNo` 时只调用 `/data/lotno/all`；无 `lotNo` 时仅允许在最新批次二次校验通过后读取 `/data/all` 的最新前 N 条，N 为状态接口报告的本批次采集数量。
- 禁止 `fetchBatchDataStreaming` 在任何批次导入场景中以 `/data/all.total` 作为目标行数；累计总数仅用于异常诊断和日志。
- 在无 `lotNo` 模式增加失败关闭保护：批次数量为零、最新批次变化、状态非 Finished、分页提前结束、分页游标不前进、实际读取超过 N 或排序契约无法确认时，不创建成功任务或不继续写入下一页。
- 保留系统主动启动采集的精确链路，并持久化 start 接口返回的真实 `lotNo`；优先推动人工操作使用“系统启动采集并导入”，获得可证明的精确批次边界。
- 前端明确展示导入模式、目标批次和目标数量；批次变化或批次边界不可靠时显示可操作错误，不再让用户看到任务持续读取历史累计数据。
- 增加批次下载、竞态、幂等、失败清理和前后端契约测试，并同步 Java 模块索引、八爪鱼使用文档和变更日志。

## Capabilities

### New Capabilities

- `bazhuayu-latest-batch-import`: 将页面识别的最新八爪鱼批次与实际下载边界绑定，支持真实 `lotNo` 精确读取和无 `lotNo` 时的受限最新快照读取。

### Modified Capabilities


## Impact

- Java 产品服务：`BazhuayuClient`、`BazhuayuBatchSnapshot`、`BazhuayuScheduledService`、`BazhuayuController`、导入任务状态与日志。
- Vue 八爪鱼自动采集页面和 `frontend/src/api/bazhuayu.ts` 的批次导入响应/错误展示。
- `BazhuayuClientDrainTest`、`BazhuayuScheduledServiceTest`、`BazhuayuControllerTest` 及必要的前端测试。
- `java-backend/AGENTS.md`、`docs/八爪鱼使用/榜单链接采榜单数据.md` 和当日变更日志。
- 不需要数据库结构变更；现有 `bazhuayu_batch_*` 与 `bazhuayu_lot_no` 字段继续使用。
