# 数据处理中心

> 运营物流 FIFO 分配、三状态公式和财务/运营自动化完整实施记录，见 `docs/架构/财务与运营自动化任务完整实施记录.md`。

数据处理中心负责把已经进入系统的数据转化为稳定、可复用的业务事实。

## 边界

- 外部模块负责鉴权、请求、限流、翻页和来源事实落库。
- 数据处理管线负责标准化、校验、去重、关联、计算和业务表物化。
- 自动化中心负责触发、编排、重试和向外部目标投递。
- 管线不得直接持有 `@Scheduled`，也不得把飞书等协作平台当作事实来源。

## 扩展方式

每条处理链实现 `DataProcessingPipeline` 并注册为 Spring Bean：

```java
@Component
public class LogisticsPurchaseProgressPipeline implements DataProcessingPipeline {
    public String code() { return "LOGISTICS_PURCHASE_PROGRESS"; }
    public String name() { return "运营物流采购进度"; }
    public DataProcessingResult execute(DataProcessingContext context) { ... }
}
```

框架会自动完成唯一编码校验、目录展示和统一执行入口。

API：

- `GET /api/v1/modules/data-processing/pipelines`
- `POST /api/v1/modules/data-processing/pipelines/{pipelineCode}/run`

现有 Excel、卖家精灵、八爪鱼和领星逻辑暂不移动。后续修改旧链路时，再把可复用的数据处理步骤逐步迁入本模块。
