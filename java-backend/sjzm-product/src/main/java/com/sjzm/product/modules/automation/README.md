# 自动化中心

> 财务日报、运营物流、领星运行中心、飞书对接中心、人员维度和 RDS 批处理的完整实施记录，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

自动化中心统一管理业务自动化的注册、手动触发、动态调度、运行审计、分布式互斥和目标记录绑定。

## 参考与取舍

参考了 `艾为系统/sijue-main/cool-admin-midway/src/modules/task/` 的任务配置与任务日志分离设计，以及领星 FBA 货件代码的终态停止刷新设计。

本实现不使用字符串反射调用 Service。每个任务必须实现强类型 `AutomationJob` 接口并注册为 Spring Bean，避免任务配置可以调用任意内部方法。

## 基础表

- `automation_job`：任务开关、CRON/固定间隔配置和下一次执行时间。
- `automation_run`：每次执行的输入、结果、数量和错误审计。
- `automation_record_binding`：业务唯一键到飞书等目标记录 ID 的绑定，支持幂等更新和终态停止跟踪。

迁移文件：`java-backend/sql/create_data_processing_automation_center.sql`。

## 扩展方式

每个任务实现 `AutomationJob`：

```java
@Component
public class OperationsLogisticsAutomationJob implements AutomationJob {
    public String code() { return "OPERATIONS_LOGISTICS_PURCHASE_PROGRESS"; }
    public String name() { return "运营物流采购进度同步"; }
    public AutomationJobResult execute(AutomationExecutionContext context) { ... }
}
```

任务内部可以调用数据处理中心，但不能自己解析第三方原始协议。目标写入应通过飞书等连接器完成。

API：

- `GET /api/v1/modules/automation/jobs`
- `POST /api/v1/modules/automation/jobs/{jobCode}/run`
- `GET /api/v1/modules/automation/runs`

调度器每 30 秒检查一次 `automation_job.next_run_at`。同一任务使用 Redisson 分布式锁互斥，多个 Java 实例不会并发执行同一任务。财务/运营的日常排期实际由领星请求注册表驱动；`recoverQueuedTasks` 会先把 `correlation_id` 为 `lingxing-request:%` 的遗留 RUNNING 审计收口为「进程重启中断」，再重置遗留队列任务。

领星请求中心 `recoverQueuedTasks` 会先把 `correlation_id` 形如 `lingxing-request:%` 的遗留 RUNNING 审计收口为 FAILED（错误信息「进程重启中断」），再重置遗留队列任务。财务/运营 Job 的日常排期走领星注册表，不要把 `automation_job.schedule_type` 再设成 CRON。
