# BSR 选品系统功能说明文档


---

## 1. Backlog (待办/初筛池)
**对应文件**: [bsr-candidate-backlog.vue](file:///e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate-backlog.vue)
**功能概述**: 数据的初始入口。用于导入原始选品数据，并进行初步的人工筛选（通过或拒绝）。

### 操作说明

#### 1.1 批量导入
*   **按钮功能**: 将外部来源（如插件抓取、Excel整理）的原始产品数据导入系统。
*   **后端交互**:
    *   **发送数据**: 点击后，前端将整理好的数据数组（包含ASIN、站点、图片URL等基础信息）发送至后端 `batchSubmit` 接口。
    *   **后端处理**: 后端接收数据后，会根据 `ASIN` + `Marketplace` 进行去重检查。如果数据库中不存在该记录，则创建新记录，初始状态通常设为 `0` (待处理)。
    *   **返回结果**: 返回成功导入的数量和失败原因。前端刷新列表显示新数据。

#### 1.2 更新状态 (通过/拒绝)
*   **按钮功能**: 筛选产品。"通过"将产品推送到下一阶段（Candidate），"拒绝"则将产品归档或删除。
*   **后端交互**:
    *   **发送数据**: 选中表格行后，前端发送 `id` 列表和目标 `status` 值（例如 `status=1` 表示通过）到后端 `updateStatus` 接口。
    *   **后端处理**: 更新数据库中对应记录的 `status` 字段。
    *   **返回结果**: 操作成功后，该条记录会从当前 Backlog 页面消失（因为页面筛选条件通常排除已处理状态），并出现在下一阶段页面中。

---

## 2. Candidate (初选/市场分析)
**对应文件**: [bsr-candidate.vue](file:///e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate.vue)
**功能概述**: 主要分析工作台。展示详细的市场数据（FBA/FBM/自营的销量、库存、价格），供运营人员判断市场潜力。

### 操作说明

#### 2.1 查看市场数据
*   **功能描述**: 页面加载时自动展示聚合的市场数据，包括英国、德国、法国、西班牙、意大利五个站点。
*   **后端交互**:
    *   **数据来源**: 页面加载时调用 `page` 接口。后端查询 `app_amz_bsr_candidate` 表，并关联 `bsr_candidate_competitor` 表。
    *   **数据处理**: 后端会根据 `asin_candidate` 聚合竞品数据，计算各配送类型（FBA、FBM、Amazon自营）的 30天销量总和、平均价格、库存水平等。
    *   **前端展示**: 数据被格式化显示在表格的 "FBA销量|库存"、"FBM数据"、"自营数据" 列中。

#### 2.2 编辑与状态流转
*   **按钮功能**: 修改产品备注、完善信息，或点击 "下一步"（状态流转）。
*   **后端交互**:
    *   **发送数据**: 编辑保存时发送修改后的字段（如 `item_name`, `remarks`）。更改状态时发送 `status=4`。
    *   **后端处理**: 更新数据库记录。
    *   **结果**: 当状态更新为 `4` 时，产品将进入 **Candidate 4** 页面。

---

## 3. Candidate 4 (图片比对/精选)
**对应文件**: [bsr-candidate4.vue](file:///e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate4.vue)
**功能概述**: 侧重于视觉筛选和供应链初步匹配，确认产品是否有货源。

### 操作说明

#### 3.1 图片比对 (阿里云图搜)
*   **按钮功能**: 在1688或其他平台搜索与当前产品相似的图片，寻找供应商。
*   **后端交互**:
    *   **发送数据**: 发送当前产品的图片 URL (`image_url`)。
    *   **后端处理**: 后端调用阿里云图像搜索服务（或类似第三方API），传入图片。API 返回相似的商品列表（包含 1688 链接、相似度分值）。后端将这些结果保存到数据库的关联字段中。
    *   **返回结果**: 前端展示相似图片列表，供用户点击跳转查看货源。

#### 3.2 导出数据
*   **按钮功能**: 导出当前阶段的产品数据进行线下分析。
*   **后端交互**:
    *   **发送数据**: 触发导出请求。
    *   **后端处理**: 后端查询状态为 `4` 的所有记录，提取 ASIN、产品名称、SKU 等关键字段，生成 CSV 或 Excel 文件流。
    *   **返回结果**: 浏览器下载数据文件。

---

## 4. Candidate 3 (采购决策)
**对应文件**: [bsr-candidate3.vue](file:///e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate3.vue)
**功能概述**: 确定采购意向，生成采购单，并进行具体的采购数据导出。

### 操作说明

#### 4.1 导出勾选采购数据
*   **按钮功能**: 导出选中产品的详细采购信息，用于发给采购部门。
*   **后端交互**:
    *   **发送数据**: 前端获取表格中选中行的 `id` 列表，调用 `service.app.bsr_candidate.exportSelectedPurchases`，同时传入当前用户名称。
    *   **后端处理**:
        1.  **查询基础信息**: 根据 `ids` 查询 `bsr_candidate` 表获取产品名。
        2.  **查询利润参数**: 查询 `common_repo` 表获取成本、长宽高等数据。
        3.  **查询市场价格**: 查询 `market_repo` 表获取英国(UK)、德国(DE)等站点的竞品售价和配送费。
        4.  **查询采购意向**: 查询 `app_amz_bsr_candidate_purchaser` 表，获取当前用户针对该产品的选定变体和采购数量。
        5.  **数据组装**: 将上述数据合并，生成包含 ASIN、产品名、各站点采购量、成本、售价、利润率的 CSV 文件。
    *   **返回结果**: 返回文件流，前端触发浏览器下载 `selected_competitors_日期.csv`。

#### 4.2 生成采购单
*   **按钮功能**: 确认采购，在系统中正式立项。
*   **后端交互**:
    *   **发送数据**: 点击后调用 `service.app.bsr_candidate.sync_add_product_from_lx`，传入产品 `id`。
    *   **后端处理 (sync_add_product_from_lx)**:
        1.  获取产品关联的所有采购人信息。
        2.  根据采购人所属项目组（如"思觉"、"润芸"）进行分组。
        3.  在领星 ERP 中检查或创建对应的产品档案（如果尚未存在）。
    *   **前端后续**: 接口调用成功后，前端紧接着调用 `service.app.listing.add`，在本地 Listing 表中创建记录，写入 `local_sku`、`asin`、`quantity` 等初始数据。
    *   **结果**: 界面提示“采购单生成成功”，数据状态更新。

#### 4.3 竞品参数应用
*   **按钮功能**: 将竞品列表中的尺寸、重量、售价等参数应用到当前的利润计算器中，作为参考。
*   **操作逻辑**: 用户在子表格中点击“应用尺寸重量”或“应用售价运费”。前端直接读取该行竞品数据，填入页面上方的表单输入框中，无需立即请求后端，待用户确认无误后点击保存才提交。

---

## 5. Candidate 2 (配置与领星同步)
**对应文件**: [bsr-candidate2.vue](file:///e:/yuanma/amz-listing-optimiser-source-delivery/woeau/cool-admin-vue/src/modules/app/views/bsr-candidate2.vue)
**功能概述**: 最终配置阶段。设置工厂链接、组合变体、精确计算利润，并最终生成领星 SKU。

### 操作说明

#### 5.1 工厂链接管理
*   **按钮功能**: 录入供应商链接（1688链接），并将其分类为“主体”、“配件”、“包装”等组别。
*   **后端交互**:
    *   **发送数据**: 用户在界面添加/编辑链接后，数据以 JSON 格式存储在前端。点击保存时，通过 `update` 接口将 `factory_links` 字段（JSON字符串）发送给后端。
    *   **后端处理**: 更新数据库中的 `factory_links` 字段。

#### 5.2 变体组合
*   **按钮功能**: 将录入的工厂链接进行组合，定义一个可售卖的变体（例如：主体A + 配件B）。
*   **后端交互**:
    *   **发送数据**: 用户勾选不同的工厂链接组件，设置比例，生成变体行。保存时，通过 `update` 接口将 `variant_Combination` 字段（JSON字符串）发送给后端。

#### 5.3 生成领星 SKU (核心功能)
*   **按钮功能**: 根据变体组合，在领星 ERP 中创建对应的供应商和产品，并生成本地 SKU。
*   **后端交互**:
    *   **发送数据**: 调用 `service.app.bsr_candidate.createLocalSKU`，传入 `id`、`selectedVariantIndexes`（选中的变体索引）和 `lingxingID`。
    *   **后端处理**:
        1.  **解析数据**: 读取 `factory_links` 和 `variant_Combination`。
        2.  **生成规则**: 读取系统参数 `sku` (计数器)。根据组件类型生成 SKU 前缀（主体A, 配件B, 包装C, 变体D）。
        3.  **领星同步 - 供应商**: 调用领星接口 `/erp/sc/routing/storage/supplier/edit`，为每个独立的工厂链接创建供应商档案。
        4.  **领星同步 - 组合产品**: 调用领星接口 `/erp/sc/routing/storage/product/set`。
            *   如果是单品，直接创建。
            *   如果是组合变体，将包含的组件 SKU 和数量作为 `group_list` 上传，在领星建立组合关系。
        5.  **保存结果**: 将生成的 SKU 回写到本地数据库，并更新全局 SKU 计数器。
    *   **返回结果**: 提示“领星SKU生成成功”。

#### 5.4 利润计算与保存
*   **按钮功能**: 填写精确的成本、税率、汇率后，计算最终利润率并保存。
