## ADDED Requirements

### Requirement: Historical Batch List
系统SHALL提供历史批次列表功能，允许用户查看和管理过去的分析批次。

#### Scenario: Display batch history
- **WHEN** 用户访问历史批次页面
- **THEN** 系统显示所有历史分析批次列表，包括批次ID、站点、分析时间、状态、结果摘要

#### Scenario: Sort batch list
- **WHEN** 用户点击列表表头（如分析时间、状态）
- **THEN** 系统按指定字段排序批次列表，支持升序和降序切换

#### Scenario: Filter batch list
- **WHEN** 用户使用筛选条件（如站点、状态、时间范围）
- **THEN** 系统过滤批次列表，仅显示符合条件的批次

#### Scenario: Search batch by ID
- **WHEN** 用户在搜索框中输入批次ID
- **THEN** 系统实时搜索并显示匹配的批次记录

### Requirement: Batch Detail View
系统SHALL提供批次详情视图，展示完整的分析结果和元数据。

#### Scenario: View batch details
- **WHEN** 用户点击某个批次记录
- **THEN** 系统显示该批次的详细信息，包括所有品类的分析结果、统计信息、执行日志

#### Scenario: View result cards
- **WHEN** 用户查看批次详情
- **THEN** 系统以卡片形式展示每个品类的分析结果，支持展开查看详细报告

#### Scenario: Export batch summary
- **WHEN** 用户查看批次详情
- **THEN** 系统提供"导出摘要"按钮，可下载批次的统计摘要（JSON格式）

### Requirement: Batch Comparison
系统SHALL支持批次对比功能，允许用户比较不同批次的分析结果差异。

#### Scenario: Select batches for comparison
- **WHEN** 用户在历史批次列表中选择两个批次（如v1和v2）
- **THEN** 系统高亮显示选中的批次，启用"对比分析"按钮

#### Scenario: Display comparison view
- **WHEN** 用户点击"对比分析"按钮
- **THEN** 系统并排显示两个批次的结果，高亮显示差异项（如评分变化、推荐等级变化）

#### Scenario: Filter comparison differences
- **WHEN** 用户查看对比结果
- **THEN** 系统提供差异筛选选项，用户可选择仅显示"评分变化"、"推荐等级变化"等特定类型的差异

#### Scenario: Export comparison report
- **WHEN** 用户查看对比结果
- **THEN** 系统提供"导出对比报告"按钮，可下载差异分析报告（PDF格式）

### Requirement: Result Export - PDF Report
系统SHALL支持将分析结果导出为PDF格式的报告。

#### Scenario: Generate PDF report
- **WHEN** 用户点击"导出PDF"按钮
- **THEN** 系统生成包含完整分析结果的PDF报告，包括封面、目录、详细结果、统计图表

#### Scenario: Customize PDF content
- **WHEN** 用户选择导出选项
- **THEN** 系统提供PDF内容定制选项，用户可选择包含哪些部分（如仅统计摘要、仅高分品类）

#### Scenario: PDF download
- **WHEN** PDF报告生成完成
- **THEN** 系统自动下载PDF文件，文件名格式为"品线分析报告_批次ID_日期.pdf"

### Requirement: Result Export - Excel Data
系统SHALL支持将分析结果导出为Excel格式的数据表。

#### Scenario: Generate Excel data
- **WHEN** 用户点击"导出Excel"按钮
- **THEN** 系统生成包含所有分析数据的Excel文件，包括品类列表、评分详情、推荐等级

#### Scenario: Excel sheet organization
- **WHEN** 生成Excel文件
- **THEN** 系统按逻辑组织工作表：汇总表、详细数据表、统计图表表

#### Scenario: Excel data formatting
- **WHEN** 生成Excel文件
- **THEN** 系统对数据进行适当格式化：数字保留小数点、日期统一格式、条件格式高亮关键数据

### Requirement: Batch Archive and Cleanup
系统SHALL支持批次归档和清理功能，帮助用户管理历史数据。

#### Scenario: Archive old batches
- **WHEN** 批次创建时间超过指定天数（如90天）
- **THEN** 系统自动将批次标记为"已归档"，从主列表移除但保留在归档列表中

#### Scenario: Restore archived batch
- **WHEN** 用户在归档列表中选择某个批次并点击"恢复"
- **THEN** 系统将该批次从归档状态恢复为正常状态，重新显示在主列表中

#### Scenario: Permanent delete
- **WHEN** 用户选择永久删除某个批次
- **THEN** 系统显示确认对话框，用户确认后删除该批次的所有数据，不可恢复

### Requirement: Batch Metadata Management
系统SHALL允许用户编辑批次的元数据，便于管理和检索。

#### Scenario: Add batch notes
- **WHEN** 用户查看某个批次详情
- **THEN** 系统提供"添加备注"功能，用户可输入文本备注，保存后显示在批次信息中

#### Scenario: Tag batch
- **WHEN** 用户查看某个批次详情
- **THEN** 系统提供"添加标签"功能，用户可为批次添加自定义标签（如"重要"、"待审核"）

#### Scenario: Filter by tags
- **WHEN** 用户在历史批次列表中使用标签筛选
- **THEN** 系统过滤批次列表，仅显示包含指定标签的批次