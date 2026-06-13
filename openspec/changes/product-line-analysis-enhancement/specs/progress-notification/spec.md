## ADDED Requirements

### Requirement: Estimated Time Remaining
系统SHALL提供分析剩余时间的估算，帮助用户规划工作时间。

#### Scenario: Calculate remaining time
- **WHEN** 分析正在进行中
- **THEN** 系统基于历史分析速度和剩余品类数量，计算并显示预计剩余时间

#### Scenario: Update remaining time
- **WHEN** 分析进度更新时
- **THEN** 系统实时更新预计剩余时间，确保估算准确性

#### Scenario: Display remaining time
- **WHEN** 用户查看分析进度
- **THEN** 系统在进度条下方显示"预计剩余时间：XX分钟"，格式清晰易读

### Requirement: Throughput Chart
系统SHALL提供吞吐量图表，展示分析速度的变化趋势。

#### Scenario: Display throughput chart
- **WHEN** 分析正在进行或已完成
- **THEN** 系统显示吞吐量折线图，X轴为时间，Y轴为每分钟分析的品类数量

#### Scenario: Real-time chart update
- **WHEN** 分析过程中有新的品类完成
- **THEN** 系统实时更新吞吐量图表，添加新的数据点

#### Scenario: Chart time range selection
- **WHEN** 用户查看吞吐量图表
- **THEN** 系统提供时间范围选择（如最近5分钟、15分钟、全部），用户可切换查看不同时间范围的数据

### Requirement: Browser Notification
系统SHALL支持浏览器通知，在分析完成或异常时提醒用户。

#### Scenario: Request notification permission
- **WHEN** 用户首次使用分析功能
- **THEN** 系统请求浏览器通知权限，说明通知用途

#### Scenario: Notify on analysis complete
- **WHEN** 分析任务成功完成
- **THEN** 系统发送浏览器通知，显示"分析完成"和关键统计信息

#### Scenario: Notify on analysis failure
- **WHEN** 分析任务失败或出现严重错误
- **THEN** 系统发送浏览器通知，显示"分析异常"和错误摘要

#### Scenario: Notification click action
- **WHEN** 用户点击浏览器通知
- **THEN** 系统将浏览器窗口聚焦到分析页面，显示详细结果

### Requirement: Real-time Alert System
系统SHALL提供异常实时告警功能，在分析过程中及时通知用户异常情况。

#### Scenario: Alert on node failure
- **WHEN** 某个分析节点失败
- **THEN** 系统在页面顶部显示红色告警条，包含失败节点名称和错误信息

#### Scenario: Alert on connection loss
- **WHEN** SSE连接断开
- **THEN** 系统显示黄色警告条，提示连接中断，正在尝试重连

#### Scenario: Alert on long running task
- **WHEN** 分析任务运行时间超过预期（如超过30分钟）
- **THEN** 系统显示蓝色提示条，询问用户是否继续等待或停止分析

### Requirement: Progress Visualization
系统SHALL提供丰富的进度可视化，帮助用户直观了解分析状态。

#### Scenario: Multi-level progress display
- **WHEN** 用户查看分析进度
- **THEN** 系统显示三级进度：总体进度（批次级别）、当前小类进度、当前节点进度

#### Scenario: Progress with status indicators
- **WHEN** 分析过程中
- **THEN** 系统使用不同颜色和图标表示不同状态：进行中（蓝色）、已完成（绿色）、失败（红色）、暂停（黄色）

#### Scenario: Progress history
- **WHEN** 分析已完成
- **THEN** 系统保留并显示完整的进度历史，用户可回顾分析过程

### Requirement: Log Stream Enhancement
系统SHALL增强实时日志流功能，提供更详细的分析过程信息。

#### Scenario: Filtered log view
- **WHEN** 用户查看实时日志
- **THEN** 系统提供日志级别筛选（info、warn、error），用户可选择查看特定级别的日志

#### Scenario: Search in logs
- **WHEN** 用户在日志流中搜索关键词
- **THEN** 系统高亮显示匹配的日志行，支持正则表达式搜索

#### Scenario: Export logs
- **WHEN** 分析完成或用户需要保存日志
- **THEN** 系统提供日志导出功能，支持下载为文本文件

### Requirement: Sound Notification
系统SHALL支持声音通知，在分析完成或异常时播放提示音。

#### Scenario: Play completion sound
- **WHEN** 分析成功完成
- **THEN** 系统播放完成提示音（如轻快的叮咚声）

#### Scenario: Play error sound
- **WHEN** 分析失败或出现严重错误
- **THEN** 系统播放错误提示音（如低沉的警报声）

#### Scenario: Sound notification settings
- **WHEN** 用户查看通知设置
- **THEN** 系统提供声音通知开关，用户可启用或禁用声音通知