## ADDED Requirements

### Requirement: 页面批次与实际下载边界绑定
系统 SHALL 在导入前校验页面提交的批次号、开始时间、结束时间、采集数量和当前最新 Finished 批次一致，并 SHALL 使用校验后的批次信息限制实际下载范围。系统 MUST NOT 因缺少 `lotNo` 而按 `/data/all` 的历史累计 `total` 导入。

#### Scenario: 最新批次为 50,090 条而任务累计为 287,753 条
- **WHEN** 页面确认的最新 Finished 批次数量为 50,090，且 `/data/all.total` 返回 287,753
- **THEN** 系统 SHALL 最多消费 `/data/all` 最新前 50,090 条，并 MUST NOT 请求或写入第 50,091 条历史数据

#### Scenario: 点击后出现更新批次
- **WHEN** 页面提交批次 A，但异步 worker 开始写入前状态接口已返回批次 B
- **THEN** 系统 SHALL 将本次导入置为错误并提示刷新页面，且 MUST NOT 静默导入批次 B

### Requirement: 真实 lotNo 精确批次导入
系统 SHALL 在拥有 start 接口返回的真实 `lotNo` 时调用 `/data/lotno/all`，并 SHALL 将该 `lotNo` 与页面批次元数据一起持久化到导入任务。系统 MUST NOT 将时间格式化的页面批次号冒充真实 `lotNo`。

#### Scenario: 系统启动采集后导入
- **WHEN** 系统启动任务并取得真实 `lotNo`，且对应执行已 Finished
- **THEN** 系统 SHALL 仅分页读取该 `lotNo` 的数据并将导入模式标记为 `EXACT_LOT_NO`

#### Scenario: 精确批次存量与采集计数不同
- **WHEN** `/data/lotno/all.total` 因云端去重少于 `currentTotalExtractCount`
- **THEN** 系统 SHALL 按精确批次接口的实际存量完成导入，记录计数差值，并 MUST NOT 读取其他批次补足差额

### Requirement: 无 lotNo 的受限最新快照
系统 MAY 在确认 `/data/all` 最新优先排序契约后，为无真实 `lotNo` 的最新 Finished 批次使用 `LATEST_BOUNDED_SNAPSHOT` 模式。该模式 SHALL 以 `currentTotalExtractCount` 为不可突破的硬上限，并 SHALL 将 `/data/all.total` 仅作为累计量诊断信息。

#### Scenario: 最后一页超过剩余批次数量
- **WHEN** 当前已读取数量加上返回页大小超过目标 N
- **THEN** 系统 SHALL 只处理达到 N 所需的行并立即停止，不得处理该页剩余行

#### Scenario: 达到目标数量
- **WHEN** 已处理数量等于 N
- **THEN** 系统 SHALL 完成下载且不得再发起下一页请求

#### Scenario: 达到 N 前数据源提前结束
- **WHEN** N 大于零但分页在读取 N 条之前返回空页、游标不前进或声明无剩余数据
- **THEN** 系统 SHALL 失败关闭并标记任务错误，不得把短读当作成功，也不得继续扫描或补入历史数据

### Requirement: 批次导入状态可审计
系统 SHALL 在导入任务、接口响应和服务日志中记录 taskId、配置映射、页面批次号、真实 `lotNo`（如有）、导入模式、目标数量、累计总量、实际读取数量和失败原因。只有全部批次读取及后续处理完成后任务才能进入 READY 或成功状态。

#### Scenario: 分页处理中发生异常
- **WHEN** 批次读取已写入部分页面后发生 API、游标或批次一致性异常
- **THEN** 系统 SHALL 调用失败收口逻辑，保留已处理数量用于审计，并 MUST NOT 调用成功收口逻辑

#### Scenario: 重复点击同一批次
- **WHEN** 用户对同一任务映射和同一批次再次点击导入
- **THEN** 系统 SHALL 返回既有任务或明确的已导入结果，不得创建第二个并发导入任务

### Requirement: 用户可识别导入保证级别
前端 SHALL 展示当前目标批次号、目标数量和导入模式，并 SHALL 在批次变化、缺少精确批次能力或短读时显示可操作错误。前端提示 MUST NOT 声称受限快照是 `lotNo` 精确导入。

#### Scenario: 外部定时批次没有 lotNo
- **WHEN** 页面显示的最新批次来自八爪鱼网页或云端定时计划且没有真实 `lotNo`
- **THEN** 页面 SHALL 标识为“最新快照（限本批次数量）”，并在失败时建议使用系统启动采集以获得精确批次
