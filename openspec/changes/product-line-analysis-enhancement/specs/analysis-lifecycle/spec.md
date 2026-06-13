## ADDED Requirements

### Requirement: Analysis State Machine
系统SHALL实现完整的分析状态机，支持以下状态转换：idle → starting → running → paused → resuming → completed / failed → retrying。

#### Scenario: Start analysis
- **WHEN** 用户点击"开始分析"按钮并输入有效的批次ID和站点
- **THEN** 系统状态从idle转换为starting，创建分析任务，建立SSE连接

#### Scenario: Pause analysis
- **WHEN** 分析正在运行（状态为running）且用户点击"暂停"按钮
- **THEN** 系统发送暂停请求到后端，状态转换为paused，SSE连接保持但分析任务暂停

#### Scenario: Resume analysis
- **WHEN** 分析已暂停（状态为paused）且用户点击"继续"按钮
- **THEN** 系统发送继续请求到后端，状态转换为resuming，分析从断点恢复

#### Scenario: Stop analysis
- **WHEN** 分析正在运行（状态为running或paused）且用户点击"停止"按钮
- **THEN** 系统发送停止请求到后端，状态转换为idle，分析任务终止，SSE连接关闭

### Requirement: Checkpoint Recovery
系统SHALL支持断点续传，确保分析中断后可以从上次完成的节点继续。

#### Scenario: Resume after page refresh
- **WHEN** 用户刷新页面且存在未完成的分析任务
- **THEN** 系统从后端获取任务状态，自动恢复到上次的分析进度，继续执行未完成的节点

#### Scenario: Resume after network interruption
- **WHEN** SSE连接断开后重新连接
- **THEN** 系统自动重连，从后端获取最新状态，继续未完成的分析任务

### Requirement: Failure Retry Mechanism
系统SHALL支持失败节点的重试机制，包括单个重试和全部重试。

#### Scenario: Retry single failed node
- **WHEN** 某个分析节点失败且用户选择"重试此节点"
- **THEN** 系统重新执行该节点的分析，更新该节点的结果，不影响其他已完成节点

#### Scenario: Retry all failed nodes
- **WHEN** 存在多个失败节点且用户选择"重试所有失败节点"
- **THEN** 系统重新执行所有失败节点的分析，按顺序更新结果

#### Scenario: Auto-retry on transient failure
- **WHEN** 分析节点因临时性错误（如网络超时）失败
- **THEN** 系统自动重试最多3次，每次间隔递增（1秒、2秒、4秒）

### Requirement: State Persistence
系统SHALL持久化分析状态，确保状态在页面刷新或断线后不丢失。

#### Scenario: State saved to Redis
- **WHEN** 分析状态发生变更（如暂停、完成一个节点）
- **THEN** 系统将当前状态保存到Redis，包括当前节点索引、已完成节点列表、错误信息

#### Scenario: State恢复 from Redis
- **WHEN** 系统启动或重新连接时
- **THEN** 系统从Redis读取上次保存的状态，恢复到对应的状态和进度

### Requirement: User Interface State Controls
系统SHALL提供清晰的状态控制按钮，根据当前状态动态显示可用操作。

#### Scenario: Show pause button during analysis
- **WHEN** 分析状态为running
- **THEN** 系统显示"暂停"按钮，隐藏"开始分析"按钮

#### Scenario: Show resume button when paused
- **WHEN** 分析状态为paused
- **THEN** 系统显示"继续"和"停止"按钮，隐藏"暂停"按钮

#### Scenario: Show start button when idle
- **WHEN** 分析状态为idle或completed
- **THEN** 系统显示"开始分析"按钮，隐藏"暂停"、"继续"、"停止"按钮