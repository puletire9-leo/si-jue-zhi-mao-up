# 领星请求中心

> 财务日报、运营物流、前端领星运行中心和限流策略的完整实施记录，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

领星调用固定分三层：

```text
lingxing_automation_request_registry  ->  lingxing_request_task  ->  LingxingClient
       注册/周期/错峰/启停                    单次队列/状态/审计          唯一 HTTP 出口
```

注册表只负责在 `next_run_at` 到期时生成请求任务，不在调度线程中调用领星。
请求中心使用单线程 worker，按 `priority DESC, id ASC` 消费，避免多个自动化同时打领星。

## 注册规则

- 每一个需要领星数据的自动化必须有唯一 `registration_code`。
- `task_type` 必须对应一个 `LingxingTaskHandler`，不能用字符串反射调用任意 Service。
- `DAILY` / `WEEKLY` 使用 `run_time` 和 `day_of_week`；`FIXED_DELAY` 使用 `fixed_delay_seconds`。
- 同一 `slot_group` 通过 `slot_order * minimum_gap_seconds` 自动错峰。
- 注册项默认停用；验证领星账号、目标权限和一次人工任务后，再通过注册表启用。

## 运营物流

`OPS_LOGISTICS_DAILY` 是第一条注册项，处理器为
`OPERATIONS_LOGISTICS_PURCHASE_PROGRESS`。它通过自动化中心复用采购/SP 同步、
数据处理、三状态计算、飞书幂等写入和运行审计；不再由独立定时器直接调用领星。

## 基础数据同步

原有周产品表现和每日库存批次的 `@Scheduled` 只负责入队，不再直接调用领星：

- `LINGXING_WEEKLY_PRODUCT_SYNC`：周数据拉取、周表加工、统一表重建。
- `LINGXING_INVENTORY_BATCH_SYNC`：每日库存批次增量。

它们属于领星基础数据任务，不是跨系统业务自动化；因此显示在领星运行中心，
不占用自动化任务中心的“财务日报/运营物流”业务任务数量。

## 产品表现限流探针

`LINGXING_PRODUCT_PERFORMANCE_RATE_PROBE` 用于小范围验证产品表现接口的真实限流间隔：

- 必须通过请求中心入队，并与正式任务共用单线程队列和账号门禁；
- 只读取少量 UK/DE 店铺、少量分页，不写 RDS、不加工、不投递飞书；
- 单组最长 180 秒，遇到 `103/3001008` 立即收口，不执行正式请求的多轮重试；
- 结果记录每次请求的响应耗时、响应完成后的实际间隔、限流次数和下一轮建议间隔。

只有无正式任务在途时才入队探针。2026-08-20 小页探针实测 12s 仍限流、13s 可连续成功；
但正式 1000 行分页已在原节奏下成功，且客户端与 Service 等待大部分重合。探针结果只用于诊断，
不能直接把正式参数改成 14s；生产提速优先优化 RDS 批量写入。
