## ADDED Requirements

### Requirement: 所有卖家精灵业务入口创建请求中心运行任务
系统 SHALL 将手动 ASIN 查询、八爪鱼初筛 ASIN、通用竞品查询、店铺全集、候选池抓取、精品复抓、邓总店铺同步和卖家名批量导入统一创建为请求中心运行任务，并向调用方返回 `runId`。

#### Scenario: 邓总店铺同步
- **WHEN** 用户从店铺分析或全部选品页面请求同步邓总店铺
- **THEN** 系统 SHALL 创建 `DENG_ZONG_SHOP_SYNC` 运行任务并导航或返回其 `runId`，而不得同步等待外部请求完成

#### Scenario: ASIN 导入重试
- **WHEN** 用户重试 ASIN 导入中失败或待处理的结果
- **THEN** 系统 SHALL 创建关联来源任务的 ASIN 请求中心运行任务，而不得调用旧的批处理执行器

### Requirement: 请求中心持久化恢复状态
请求中心运行 SHALL 支持 `PENDING`、`RUNNING`、`PAUSED`、`PAUSED_SYSTEM`、`STOPPED`、`SUCCESS`、`PARTIAL_SUCCESS` 和 `FAILED` 状态；子项 SHALL 支持 `WAITING_RETRY` 并持久化尝试次数、下次重试时间、错误代码和原始错误摘要。

#### Scenario: 网络故障暂停运行
- **WHEN** 执行网关返回 `CIRCUIT_OPEN` 或结果未知的网络故障
- **THEN** 当前子项 SHALL 进入等待恢复状态，运行 SHALL 进入 `PAUSED_SYSTEM`，且待处理子项不得被标记失败

#### Scenario: 容器重启恢复
- **WHEN** 产品服务在请求中心运行期间重启
- **THEN** 系统 SHALL 回收未完成子项并恢复安全的可执行或等待状态，而不得将整个运行无条件标记为错误

### Requirement: 暂停、停止和重试在请求边界生效
请求中心 SHALL 在领取子项、发起每一页店铺请求和执行重试前检查运行控制状态。停止 SHALL 阻止未发出的请求；暂停 SHALL 在当前已发出请求完成后停止后续请求。

#### Scenario: 停止多页店铺抓取
- **WHEN** 操作员停止正在抓取多页店铺的运行任务
- **THEN** 系统 SHALL 在当前页完成后不再发起下一页请求，并将未领取子项标记为未发起

#### Scenario: 重试失败子项
- **WHEN** 操作员重试一个可恢复的失败或等待子项
- **THEN** 系统 SHALL 保留原失败审计并创建新的尝试记录，而不得覆盖原始错误原因

### Requirement: 未发出请求不得误标失败或计费
系统 SHALL 只将已实际发出且达到失败终态的业务请求标记为失败。熔断门禁拒绝、暂停、停止和未发出请求的连接失败不得批量更新来源 ASIN 或店铺为 `API_FAIL`，也不得增加卖家精灵使用次数。

#### Scenario: 熔断拒绝后续 ASIN 批次
- **WHEN** ASIN 任务在熔断开启后尝试领取下一批
- **THEN** 系统 SHALL 保留该批 ASIN 的可重试来源状态并暂停运行，而不得将该批 ASIN 标记为 `API_FAIL`

### Requirement: 旧直连入口兼容迁移
旧的同步卖家精灵入口 SHALL 在兼容期内只创建对应请求中心运行任务或返回明确迁移提示。旧入口不得绕过执行网关直接发起卖家精灵 HTTP 请求。

#### Scenario: 调用旧店铺同步路由
- **WHEN** 客户端调用兼容期内的旧店铺同步路由
- **THEN** 系统 SHALL 返回已创建的请求中心 `runId` 或明确的迁移错误，而不得在 HTTP 请求线程内执行店铺抓取

### Requirement: 请求中心月度筛选与用量汇总
请求中心 SHALL 支持按任务创建月份筛选运行任务，并 SHALL 返回指定月份全部任务累计的 `api_calls`，该汇总不得受分页影响。客户端默认选择当前自然月，同时允许切换到其他月份。

#### Scenario: 查看本月请求中心任务
- **WHEN** 操作员进入请求中心且未更改默认月份
- **THEN** 系统 SHALL 展示当前自然月创建的任务，并显示本月全部任务累计请求次数

#### Scenario: 切换历史月份
- **WHEN** 操作员选择一个历史月份
- **THEN** 系统 SHALL 只返回该月创建的任务，并显示该月跨全部分页累计的请求次数

### Requirement: 禁止抓取 Amazon 通用店名
系统 SHALL 将去除首尾空格后、忽略大小写精确等于 `Amazon` 的卖家名称视为禁止抓取目标。请求中心 SHALL 将此类子项标记为跳过并说明原因，执行网关 SHALL 在发出 HTTP 请求前再次拦截，且不得增加使用次数。

#### Scenario: 候选批量包含 Amazon
- **WHEN** 候选店铺任务包含卖家名 `Amazon`
- **THEN** 该子项 SHALL 标记为 `SKIPPED`，其他店铺继续执行，且该子项使用次数为 0

#### Scenario: 其他入口尝试绕过请求中心
- **WHEN** 任意入口向执行网关提交卖家名 `amazon` 或带首尾空格的 ` Amazon `
- **THEN** 网关 SHALL 在请求发出前以 `INVALID_REQUEST` 拒绝，且不得扣费

### Requirement: 单店分页请求上限
系统 SHALL 对所有卖家名称驱动的店铺分页抓取施加单店最多 10 次卖家精灵请求的上限。达到上限后 SHALL 保留已抓取结果，将当前店铺标记为部分完成，并继续处理同一批次的下一个店铺。

#### Scenario: 大店铺超过十页
- **WHEN** 一个店铺完成第 10 次请求后仍存在未抓取分页
- **THEN** 系统 SHALL 不发出第 11 次请求，记录截断原因和剩余数量，并继续消费下一个店铺子项
