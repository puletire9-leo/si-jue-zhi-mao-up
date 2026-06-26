## ADDED Requirements

### Requirement: Category Selection
系统SHALL允许用户选择特定品类进行分析，而不是默认分析所有品类。

#### Scenario: Display category list
- **WHEN** 用户启动分析前查看品类选择界面
- **THEN** 系统显示当前批次的所有品类列表，包括品类名称、状态（待分析/已完成/失败）

#### Scenario: Select multiple categories
- **WHEN** 用户在品类列表中勾选需要分析的品类
- **THEN** 系统记录选中的品类ID列表，仅分析这些选中的品类

#### Scenario: Select all categories
- **WHEN** 用户点击"全选"按钮
- **THEN** 系统选中所有品类，等同于分析全部品类

### Requirement: Skip Completed Categories
系统SHALL支持跳过已完成的品类，避免重复分析。

#### Scenario: Auto-skip completed categories
- **WHEN** 用户选择分析所有品类，但部分品类已完成
- **THEN** 系统自动跳过已完成的品类，仅分析未完成的品类

#### Scenario: Manual skip completed categories
- **WHEN** 用户查看品类列表并选择"跳过已完成"
- **THEN** 系统隐藏已完成的品类，仅显示未完成和失败的品类供选择

### Requirement: Incremental Analysis
系统SHALL支持增量分析，仅分析新增或变化的品类。

#### Scenario: Detect new categories
- **WHEN** 用户选择"增量分析"模式
- **THEN** 系统对比当前批次与上次分析的品类列表，识别新增的品类

#### Scenario: Detect changed categories
- **WHEN** 用户选择"增量分析"模式
- **THEN** 系统对比品类数据的时间戳或版本号，识别发生变化的品类

#### Scenario: Analyze only incremental categories
- **WHEN** 系统识别出新增或变化的品类
- **THEN** 系统仅分析这些品类，跳过未变化的品类

### Requirement: Category Status Tracking
系统SHALL跟踪每个品类的分析状态，提供清晰的可视化展示。

#### Scenario: Display category status
- **WHEN** 用户查看品类列表
- **THEN** 系统显示每个品类的状态：待分析、分析中、已完成、失败、跳过

#### Scenario: Real-time status update
- **WHEN** 分析过程中某个品类的状态发生变化
- **THEN** 系统实时更新该品类的状态显示，无需刷新页面

### Requirement: Batch Category Operations
系统SHALL支持批量操作品类，提升操作效率。

#### Scenario: Batch select categories
- **WHEN** 用户按住Shift键并点击多个品类
- **THEN** 系统选中点击范围内的所有品类

#### Scenario: Batch retry failed categories
- **WHEN** 存在多个失败品类且用户选择"重试所有失败"
- **THEN** 系统重新分析所有失败的品类，不影响已完成的品类

### Requirement: Category Filter and Search
系统SHALL提供品类筛选和搜索功能，帮助用户快速找到目标品类。

#### Scenario: Search by category name
- **WHEN** 用户在搜索框中输入品类名称
- **THEN** 系统实时过滤品类列表，仅显示名称匹配的品类

#### Scenario: Filter by status
- **WHEN** 用户选择状态筛选条件（如"仅显示失败"）
- **THEN** 系统过滤品类列表，仅显示符合状态条件的品类

### Requirement: Category Analysis Configuration
系统SHALL允许用户为不同品类配置不同的分析参数。

#### Scenario: Configure analysis depth
- **WHEN** 用户选择某个品类并设置"分析深度"参数
- **THEN** 系统使用指定的分析深度参数分析该品类，而不是使用默认参数

#### Scenario: Configure timeout
- **WHEN** 用户选择某个品类并设置"超时时间"参数
- **THEN** 系统使用指定的超时时间分析该品类，超过时间则标记为超时失败