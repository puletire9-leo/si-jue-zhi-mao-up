## ADDED Requirements

### Requirement: 唯一卖家精灵执行网关
系统 SHALL 仅通过一个卖家精灵执行网关发起 `competitor-lookup` 外部 HTTP 请求。ASIN 查询、店铺全集、邓总店铺和卖家名批量导入不得自行构造卖家精灵 HTTP 客户端或直接读取密钥。

#### Scenario: ASIN 批量查询执行
- **WHEN** 请求中心领取一个 ASIN 批量查询子项
- **THEN** 系统 SHALL 通过执行网关发起该批次请求并将关联 runId、itemId 和结果写入调用审计

#### Scenario: 店铺全集执行
- **WHEN** 请求中心领取一个店铺全集类子项
- **THEN** 系统 SHALL 通过同一执行网关按页请求店铺数据而不使用独立 HTTP 客户端

### Requirement: 统一调用审计与错误分类
执行网关 SHALL 为每次外部调用持久化请求范围、请求是否已发出、耗时、使用次数确认状态、错误代码、错误摘要和关联任务标识。系统 SHALL 将连接超时、读取超时、网络、熔断、限流、鉴权、参数和上游业务错误区分记录。

#### Scenario: 连接超时
- **WHEN** 在建立 TCP 连接前发生超时
- **THEN** 审计 SHALL 记录 `CONNECT_TIMEOUT`、`requestDispatched=false`，且不得确认卖家精灵使用次数

#### Scenario: 卖家精灵业务错误
- **WHEN** 卖家精灵返回非成功业务码
- **THEN** 审计 SHALL 保存脱敏后的原始错误摘要和对应业务错误代码

### Requirement: 全局限流和熔断门禁
执行网关 SHALL 使用跨 worker 可见的门禁协调卖家精灵分钟限流和熔断状态。熔断开启期间，网关 SHALL 拒绝新外部请求并返回恢复时间与原始触发摘要。

#### Scenario: 熔断开启
- **WHEN** 失败率达到熔断阈值并打开门禁
- **THEN** 后续调用 SHALL 在发出 HTTP 请求前被拒绝，并返回 `CIRCUIT_OPEN` 与可恢复时间

#### Scenario: 并发任务共享配额
- **WHEN** 多个请求中心运行同时领取卖家精灵子项
- **THEN** 系统 SHALL 以同一全局配额决定是否允许下一次外部请求

### Requirement: 安全重试策略
执行网关 SHALL 仅对确认未发出请求的瞬时连接/DNS 故障和卖家精灵明确短期限流进行有限自动重试。读取超时或请求已发出但结果未知时，系统 MUST 不自动重复请求。

#### Scenario: 未发出请求的连接超时
- **WHEN** 子项发生 `CONNECT_TIMEOUT` 且未超过重试上限
- **THEN** 系统 SHALL 计算退避时间并将该子项安排为可重试状态

#### Scenario: 结果未知的读取超时
- **WHEN** 子项在请求已发出后发生读取超时
- **THEN** 系统 SHALL 保留原始错误并等待操作员或显式恢复策略，而不得自动重复扣费请求
