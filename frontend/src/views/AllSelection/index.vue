<template>
  <div class="all-selection">
    <div class="selection-layout">
      <!-- 内容区域 -->
      <div class="content">
        <el-card class="main-card">
          <template #header>
            <div class="card-header">
              <span>{{ getSectionTitle() }}</span>
              <div class="header-actions">
                <!-- 高频操作 — 常驻 -->
                <el-button v-if="!isReadOnlySourceScene" type="primary" :icon="Plus" @click="handleAdd">
                  添加选品
                </el-button>
                <el-button v-if="!isReadOnlySourceScene" type="success" :icon="Upload" @click="handleImport">
                  导入Excel
                </el-button>
                <!-- 选中后出现的批量操作 -->
                <template v-if="selectedIds.length > 0">
                  <el-button
                    v-if="isManualLibrarySourceScene"
                    type="success"
                    :icon="Collection"
                    :loading="libraryAddingBucket === 'GOOD'"
                    @click="handleAddToDeveloperLibrary('GOOD')"
                  >
                    加入选品库 ({{ selectedIds.length }})
                  </el-button>
                  <el-button
                    v-if="isManualLibrarySourceScene"
                    type="warning"
                    :icon="Warning"
                    :loading="libraryAddingBucket === 'BAD'"
                    @click="handleAddToDeveloperLibrary('BAD')"
                  >
                    加入差品库 ({{ selectedIds.length }})
                  </el-button>
                  <el-button
                    v-if="!isReadOnlySourceScene"
                    type="danger"
                    :icon="Delete"
                    @click="handleBatchDelete"
                  >
                    批量删除 ({{ selectedIds.length }})
                  </el-button>
                </template>

                <el-button
                  v-if="!isBrsScene"
                  type="success"
                  :icon="Download"
                  :loading="exportingAllResults"
                  :disabled="loading || pagination.total === 0"
                  @click="handleExportAllResultsCsv"
                >
                  下载全部 CSV
                </el-button>
                <el-button
                  v-if="isDownloadCenterXlsxScene"
                  type="success"
                  :icon="Download"
                  :loading="exportingSelectedXlsx"
                  :disabled="loading || selectedIds.length === 0"
                  @click="handleExportSelectedXlsx"
                >
                  下载 XLSX{{ selectedIds.length > 0 ? ` (${selectedIds.length})` : "" }}
                </el-button>

                <el-button
                  v-if="isManualLibrarySourceScene"
                  :type="selectionMode ? 'danger' : 'primary'"
                  :plain="!selectionMode"
                  :icon="Select"
                  @click="toggleSelectionMode"
                >
                  {{ selectionMode ? '退出选择' : '选择模式' }}
                </el-button>

                <!-- 全选（带下拉） -->
                <el-dropdown v-if="cardSelectionEnabled" @command="handleSelectAll">
                  <el-button type="primary" :icon="Select"> 全选 </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="current"
                        >选择当前页</el-dropdown-item
                      >
                      <el-dropdown-item command="all"
                        >选择全部</el-dropdown-item
                      >
                      <el-dropdown-item command="clear" :icon="CircleClose"
                        >清空选择</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <!-- 低频操作 → 更多菜单 -->
                <el-dropdown @command="handleMoreCommand">
                  <el-button type="default" :icon="MoreFilled">
                    更多
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        command="downloadTemplate"
                        :icon="Download"
                        >下载模板</el-dropdown-item
                      >
                      <el-dropdown-item command="recycleBin" :icon="Refresh"
                        >回收站</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>

                <el-button
                  v-if="activeTab === 'zheng'"
                  type="primary"
                  :icon="Shop"
                  @click="openDengZongRequestCenter"
                >
                  管理非标店铺
                </el-button>
                <!-- AI 选品：载体多选筛选（选挂牌只出挂牌，可多选一起看） -->
                <el-select
                  v-if="isAiSelectionScene"
                  v-model="carrierFilter"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  clearable
                  placeholder="载体筛选"
                  style="width: 200px;"
                  @change="handleCarrierFilterChange"
                >
                  <el-option
                    v-for="c in carrierList"
                    :key="c.carrierKey"
                    :label="c.name"
                    :value="c.carrierKey"
                  />
                </el-select>
                <el-button
                  v-if="isAiSelectionScene"
                  :icon="Setting"
                  text
                  @click="openCarrierManage"
                >
                  管理载体
                </el-button>
                <!-- AI 选品：导入 ASIN -->
                <el-button
                  v-if="isAiSelectionScene"
                  type="primary"
                  :icon="Upload"
                  @click="aiImportDialogVisible = true"
                >
                  导入 ASIN
                </el-button>
              </div>
            </div>
          </template>

          <!-- 使用 SelectionQueryForm 组件 -->
          <SelectionQueryForm
            :key="componentKey"
            :model-value="queryParamsState"
            page-type="all"
            :show-compact-mode="true"
            :show-advanced-search="true"
            :hide-inline-filters="true"
            :show-image-search="true"
            :show-title="true"
            :show-total="true"
            :categories="categories"
            :total="pagination.total"
            @update:model-value="onQueryFormChange"
            @search="handleSearch"
            @reset="handleReset"
            @image-search="handleSearchByImage"
          >
            <template v-if="isShopProductsScene" #compact-actions>
              <el-button
                type="primary"
                :icon="Shop"
                @click="openShopRequestDialog"
              >
                店铺请求
              </el-button>
            </template>
          </SelectionQueryForm>

          <el-dialog
            v-model="shopRequestDialogVisible"
            title="店铺请求"
            width="420px"
            destroy-on-close
            @closed="shopRequestForm.sellerName = ''"
          >
            <el-form label-width="72px" @submit.prevent>
              <el-form-item label="国家" required>
                <el-select v-model="shopRequestForm.marketplace" style="width: 100%">
                  <el-option label="英国 UK" value="UK" />
                  <el-option label="德国 DE" value="DE" />
                  <el-option label="美国 US" value="US" />
                </el-select>
              </el-form-item>
              <el-form-item label="店铺名" required>
                <el-input
                  v-model="shopRequestForm.sellerName"
                  clearable
                  placeholder="请输入 Amazon 店铺名"
                  @keyup.enter="submitShopRequest"
                />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="shopRequestDialogVisible = false">取消</el-button>
              <el-button type="primary" :loading="shopRequestSubmitting" @click="submitShopRequest">
                请求店铺
              </el-button>
            </template>
          </el-dialog>

          <!-- 统一筛选入口：站点/大类常驻 + 筛选按钮 + 已选条件标签 -->
          <div class="unified-filter-bar">
            <label class="ufb-field">
              <span class="ufb-field-label">站点</span>
              <el-select
                v-model="activeFilters.country"
                placeholder="全部站点"
                clearable
                style="width: 110px"
                @change="onBarCountryChange"
              >
                <el-option label="美国" value="US" />
                <el-option label="英国" value="UK" />
                <el-option label="德国" value="DE" />
              </el-select>
            </label>
            <label v-if="!isLingxingShopScene" class="ufb-field">
              <span class="ufb-field-label">大类榜单</span>
              <el-select
                v-model="activeFilters.category"
                placeholder="全部大类"
                clearable
                multiple
                collapse-tags
                collapse-tags-tooltip
                style="width: 200px"
                @change="onBarCategoryChange"
              >
                <el-option
                  v-for="cat in categories"
                  :key="cat.category"
                  :label="`${cat.category} (${cat.count})`"
                  :value="cat.category"
                />
              </el-select>
            </label>
            <label v-if="isLingxingShopScene" class="ufb-field">
              <span class="ufb-field-label">按领星店铺</span>
              <el-select
                v-model="activeFilters.sellerSelect"
                placeholder="全部店铺"
                clearable
                filterable
                style="width: 220px"
                @change="onLingxingStoreChange"
              >
                <el-option
                  v-for="s in lingxingStores"
                  :key="s.store"
                  :label="`${s.store} (${s.count})`"
                  :value="s.store"
                />
              </el-select>
            </label>
            <el-button
              :icon="Filter"
              type="primary"
              plain
              @click="openFilterDrawer"
            >
              更多筛选
              <el-badge
                v-if="activeFilterChips.length"
                :value="activeFilterChips.length"
                class="filter-count-badge"
              />
            </el-button>
            <div class="filter-chips">
              <el-tag
                v-for="chip in activeFilterChips"
                :key="chip.key"
                closable
                size="small"
                type="info"
                @close="removeChip(chip.key)"
              >
                {{ chip.label }}
              </el-tag>
              <el-button
                v-if="activeFilterChips.length"
                link
                size="small"
                @click="clearAllFilters"
              >
                清除全部
              </el-button>
            </div>
          </div>

          <!-- 合格规则筛选：按筛选重构计划隐藏，筛选统一走面板 AND 语义（保留组件便于回滚） -->
          <QualifyRuleFilter
            v-if="false"
            class="rule-filter-bar"
            :model-value="newQualifyRules"
            @apply="onNewRulesApply"
          />

          <!-- 置顶开关 + 清洗表开关 -->
          <div class="variant-filter-bar">
            <span class="filter-label">选中置顶</span>
            <el-switch
              v-model="pinSelected"
              size="small"
              :active-action-icon="Top"
              :inactive-action-icon="Bottom"
            />
            <el-tooltip
              v-if="activeTab !== 'zheng' && !isReadOnlySourceScene"
              placement="top"
              content="开启后只显示父群组代表行（去变体污染）；关闭后展示原始所有变体"
            >
              <span class="filter-label" style="margin-left: 16px">
                清洗数据
              </span>
            </el-tooltip>
            <el-switch
              v-if="activeTab !== 'zheng' && !isReadOnlySourceScene"
              v-model="useCleanTable"
              size="small"
              @change="onUseCleanTableChange"
            />
          </div>

          <!-- 卡片缩放：等比例缩小卡片本身，而不是只改变每页请求数量。 -->
          <div class="card-display-settings">
            <div class="card-display-settings__copy">
              <span class="card-display-settings__title">卡片大小</span>
              <span class="card-display-settings__hint">缩小后同一行自动显示更多卡片</span>
            </div>
            <div class="card-display-settings__controls" role="group" aria-label="卡片大小">
              <el-button
                size="small"
                aria-label="缩小卡片"
                :disabled="cardScale <= CARD_SCALE_MIN"
                @click="adjustCardScale(-CARD_SCALE_STEP)"
              >
                −
              </el-button>
              <span class="card-display-settings__count">{{ cardScalePercent }}%</span>
              <el-button
                size="small"
                type="primary"
                aria-label="放大卡片"
                :disabled="cardScale >= CARD_SCALE_MAX"
                @click="adjustCardScale(CARD_SCALE_STEP)"
              >
                +
              </el-button>
            </div>
          </div>

          <template v-if="loading && !hasLoaded">
            <SkeletonWrapper variant="card-grid" :count="12" />
          </template>
          <div
            v-else
            ref="productsGridRef"
            v-loading="refreshing"
            class="products-grid"
            :style="[productGridStyle, virtualGridSpacerStyle]"
            @scroll.passive="onGridScroll"
          >
            <div
              v-for="product in virtualVisibleProducts"
              :key="product.id"
              v-memo="[
                product.id,
                selectedIds.includes(product.asin),
                mySelections.has(product.asin),
                selectionUsersMap[product.asin],
                cardSelectionEnabled,
              ]"
              class="product-card-scale-wrapper"
            >
              <div class="product-card-scale-canvas">
                <UniversalCard
                  :product="product"
                  :selected="selectedIds.includes(product.asin)"
                  :is-selected-by-me="mySelections.has(product.asin)"
                  :selected-by-users="selectionUsersMap[product.asin] || []"
                  :selectable="cardSelectionEnabled"
                  :show-delete="!isReadOnlySourceScene"
                  :incomplete-data-label="
                    isPremiumProductsScene && product.enriched === false
                      ? '待卖家精灵补全'
                      : ''
                  "
                  mode="selection"
                  @click="handleCardClick"
                  @select="handleSelect"
                  @toggle-select="handleToggleSelect"
                  @view="handleView"
                  @delete="handleDelete"
                  @image-search="handleImageSearch"
                />
              </div>
            </div>

            <el-empty
              v-if="!loading && productList.length === 0"
              description="暂无选品数据"
              :image-size="200"
            />
          </div>

          <el-pagination
            :current-page="pagination.page"
            :page-size="pagination.size"
            :total="pagination.total"
            :page-sizes="[60, 100, 200]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handlePageChange"
          />
        </el-card>

        <!-- 统一筛选抽屉 -->
        <FilterDrawer
          v-model:visible="filterDrawerVisible"
          title="更多筛选"
          :size="520"
          @reset="handleDrawerReset"
          @confirm="handleDrawerConfirm"
        >
          <!-- 业务筛选方法 -->
          <div class="fd-section">
            <div class="fd-label">业务筛选方法</div>
            <div v-if="!isBrsScene" class="method-card method-card--m01">
              <div class="method-card__body">
                <div class="method-card__head">
                  <div class="method-card__name">M01 新品榜加速法</div>
                  <el-tag
                    v-if="activeMethodCard?.id === 'M01'"
                    type="success"
                    effect="light"
                    size="small"
                  >
                    已应用
                  </el-tag>
                </div>
                <div class="method-card__desc">
                  {{
                    isPremiumProductsScene
                      ? "在精品原始数据中，按价格带、重量、上架天数、销量分段或 BSR 代理筛出候选。"
                      : isShopProductsScene
                        ? "在店铺商品数据中，按价格带、重量、上架天数、销量分段或 BSR 代理筛出新品候选。"
                        : "clean 表去变体污染后，按价格带、重量、上架天数、销量分段或 BSR 代理筛出新品候选。"
                  }}
                </div>
                <div class="method-card__meta">
                  <span>适合：新品榜快筛</span>
                  <span>站点：UK / DE / US</span>
                  <span v-if="isShopProductsScene">数据源：shop_products</span>
                  <span v-if="isPremiumProductsScene">数据源：premium_products</span>
                  <span>输出：候选 + 命中原因</span>
                </div>
              </div>
              <div class="method-card__actions">
                <el-button
                  v-if="activeMethodCard?.id !== 'M01'"
                  type="primary"
                  size="small"
                  @click="applyM01Method"
                >
                  应用方法
                </el-button>
                <el-button size="small" link @click="openMethodDetail('M01')">
                  了解详情
                </el-button>
                <el-button
                  v-if="activeMethodCard?.id === 'M01'"
                  size="small"
                  link
                  @click="clearMethodCard"
                >
                  退出方法
                </el-button>
              </div>
            </div>

            <div v-if="!isFixedSelectionSourceScene" class="method-card method-card--m02">
              <div class="method-card__body">
                <div class="method-card__head">
                  <div class="method-card__name">M02 非标同行品线跟随法</div>
                  <el-tag
                    v-if="activeMethodCard?.id === 'M02'"
                    type="success"
                    effect="light"
                    size="small"
                  >
                    已应用
                  </el-tag>
                </div>
                <div class="method-card__desc">
                  用非标同行店铺最新批次作为基准盘子，筛选同行已经验证过的候选商品。
                </div>
                <div class="method-card__meta">
                  <span>适合：同行跟随 / 选品优先级</span>
                  <span>数据源：deng_zong_shop</span>
                  <span>输出：候选 + 命中原因</span>
                </div>
              </div>
              <div class="method-card__actions">
                <el-button
                  v-if="activeMethodCard?.id !== 'M02'"
                  type="primary"
                  size="small"
                  @click="applyM02Method"
                >
                  应用方法
                </el-button>
                <el-button size="small" link @click="openMethodDetail('M02')">
                  了解详情
                </el-button>
                <el-button
                  v-if="activeMethodCard?.id === 'M02'"
                  size="small"
                  link
                  @click="clearMethodCard"
                >
                  退出方法
                </el-button>
              </div>
            </div>

            <div v-if="!isBrsScene" class="method-card method-card--m03">
              <div class="method-card__body">
                <div class="method-card__head">
                  <div class="method-card__name">M03 FBM 自发货简单道</div>
                  <el-tag
                    v-if="activeMethodCard?.id === 'M03'"
                    type="success"
                    effect="light"
                    size="small"
                  >
                    已应用
                  </el-tag>
                </div>
                <div class="method-card__desc">
                  {{
                    isPremiumProductsScene
                      ? "在精品原始数据中固定过滤 fulfillment=FBM，用 90 天单一销量门槛快速找自发货候选。"
                      : isShopProductsScene
                        ? "在店铺商品数据中固定过滤 fulfillment=FBM，用 90 天单一销量门槛快速找自发货候选。"
                        : "clean 表里过滤 fulfillment=FBM，用 90 天单一销量门槛快速找 FBM 自发货候选。"
                  }}
                </div>
                <div class="method-card__meta">
                  <span>适合：FBM 自发货打法</span>
                  <span>站点：UK≥5 / DE≥10 / US≥20</span>
                  <span v-if="isShopProductsScene">数据源：shop_products</span>
                  <span v-if="isPremiumProductsScene">数据源：premium_products</span>
                  <span>输出：候选 + 命中原因</span>
                </div>
              </div>
              <div class="method-card__actions">
                <el-button
                  v-if="activeMethodCard?.id !== 'M03'"
                  type="primary"
                  size="small"
                  @click="applyM03Method"
                >
                  应用方法
                </el-button>
                <el-button size="small" link @click="openMethodDetail('M03')">
                  了解详情
                </el-button>
                <el-button
                  v-if="activeMethodCard?.id === 'M03'"
                  size="small"
                  link
                  @click="clearMethodCard"
                >
                  退出方法
                </el-button>
              </div>
            </div>
          </div>

          <!-- 卖家下拉已移除：上千卖家灌进 filterable el-select 会触发 Element Plus
               海量响应式 getter，打开抽屉卡死 ~11s（CDP profiler 实测）。
               按店铺名查找改用顶部搜索框（sellerName 链路，跨批次全库搜，见 loadProducts）。 -->

          <!-- 排序 -->
          <div class="fd-section">
            <div class="fd-label">排序</div>
            <div class="fd-sort-row">
              <el-select
                v-model="draftFilters.sortField"
                placeholder="排序字段"
                clearable
                style="width: 150px"
              >
                <el-option label="销量" value="salesVolume" />
                <el-option label="BSR" value="bsr" />
                <el-option label="价格" value="price" />
                <el-option label="上架时间" value="listingDate" />
                <el-option label="创建时间" value="createdAt" />
              </el-select>
              <el-select
                v-model="draftFilters.sortOrder"
                placeholder="排序方式"
                clearable
                style="width: 120px; margin-left: 12px"
              >
                <el-option label="降序" value="desc" />
                <el-option label="升序" value="asc" />
              </el-select>
            </div>
          </div>

          <!-- 区间筛选面板（绑定 draftFilters.range，不即时查询；周批次依站点 + 来源联动） -->
          <div class="fd-section">
            <div class="fd-label">区间与维度</div>
            <RangeFilterPanel
              v-model="draftFilters.range"
              :country="activeFilters.country || 'UK'"
              :source="currentSource"
              :snapshot-kind="currentSnapshotKind"
              :use-clean-table="useCleanTable"
              :auto-select-latest-week="!activeMethodCard"
              :hide-snapshot="isLingxingShopScene"
              embedded
              @batch-deleted="handleBatchDeleted"
            />
          </div>

          <!-- 我的筛选预设 -->
          <div class="fd-section">
            <FilterPresetSelector
              :current-config="getCurrentFilterConfig"
              @apply="handlePresetApply"
            />
          </div>
        </FilterDrawer>

        <!-- 导入Excel对话框 -->
        <el-dialog
          v-model="importDialogVisible"
          title="导入Excel"
          width="500px"
          destroy-on-close
          class="import-dialog"
        >
          <div class="import-dialog-content">
            <!-- 导入模式选择 -->
            <div
              style="
                margin-bottom: 20px;
                padding: 16px;
                background-color: #f5f7fa;
                border-radius: 4px;
              "
            >
              <div style="font-weight: 500; margin-bottom: 8px; color: #606266">
                导入模式：
              </div>
              <select
                v-model="importMode"
                style="
                  width: 100%;
                  padding: 8px;
                  border: 1px solid #dcdfe6;
                  border-radius: 4px;
                  font-size: 14px;
                "
              >
                <option value="skip">
                  跳过已存在 - 如果ASIN已存在，则跳过该记录
                </option>
                <option value="update">
                  更新已存在 - 如果ASIN已存在，则更新该记录
                </option>
                <option value="overwrite">
                  覆盖已存在 - 如果ASIN已存在，则删除后重新插入
                </option>
              </select>
              <div style="margin-top: 8px; font-size: 12px; color: #909399">
                当前选择：{{
                  importMode === "skip"
                    ? "跳过已存在"
                    : importMode === "update"
                      ? "更新已存在"
                      : "覆盖已存在"
                }}
              </div>
            </div>

            <!-- 文件上传 -->
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :limit="1"
              accept=".xlsx,.xls"
              :on-change="handleFileChange"
              :on-exceed="handleExceed"
              drag
              class="import-upload"
            >
              <el-icon class="el-icon--upload" :size="48"
                ><UploadFilled
              /></el-icon>
              <div class="el-upload__text">
                拖拽文件到此处或 <em>点击上传</em>
              </div>
              <template #tip>
                <div class="el-upload__tip">
                  只支持 .xlsx/.xls 格式的Excel文件
                </div>
              </template>
            </el-upload>
          </div>

          <template #footer>
            <el-button @click="importDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              :loading="importing"
              @click="handleImportSubmit"
            >
              开始导入
            </el-button>
          </template>
        </el-dialog>

        <el-dialog
          v-model="searchByImageDialogVisible"
          title="以图搜图"
          width="500px"
        >
          <el-upload
            ref="imageUploadRef"
            :auto-upload="false"
            :limit="1"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            :on-change="handleImageChange"
            :on-exceed="handleExceed"
            drag
          >
            <el-icon class="el-icon--upload"><PictureFilled /></el-icon>
            <div class="el-upload__text">
              拖拽图片到此处或 <em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 JPG、PNG、WebP、BMP 格式，最大 5MB
              </div>
            </template>
          </el-upload>

          <div v-if="searchImagePreview" class="image-preview">
            <el-image :src="searchImagePreview" fit="contain" />
          </div>

          <template #footer>
            <el-button @click="searchByImageDialogVisible = false"
              >取消</el-button
            >
            <el-button
              type="primary"
              :loading="searching"
              @click="handleSearchByImageSubmit"
            >
              开始搜索
            </el-button>
          </template>
        </el-dialog>

        <ProductDetailDialog
          v-model:visible="detailDialogVisible"
          :product="selectedProduct"
          mode="selection"
          :data-source="detailDataSource"
          :show-edit-button="false"
          :show-delete-button="!isReadOnlySourceScene"
          :show-developer-library-actions="isManualLibrarySourceScene"
          :developer-library-loading="libraryAddingBucket || ''"
          @delete="handleDeleteProduct"
          @select-product="handleSelectProduct"
          @add-to-developer-library="handleAddSingleToDeveloperLibrary"
        />

        <!-- 添加选品对话框 -->
        <el-dialog
          v-model="addDialogVisible"
          title="添加选品"
          width="800px"
          :before-close="handleAddCancel"
        >
          <el-form
            :model="addForm"
            label-width="120px"
            :rules="addFormRules"
            ref="addFormRef"
          >
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="ASIN" prop="asin" required>
                  <el-input
                    v-model="addForm.asin"
                    placeholder="请输入产品ASIN"
                    maxlength="10"
                    show-word-limit
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="商品标题" prop="productTitle" required>
                  <el-input
                    v-model="addForm.productTitle"
                    placeholder="请输入商品标题"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="价格">
                  <el-input
                    v-model="addForm.price"
                    placeholder="请输入价格"
                    type="number"
                    step="0.01"
                  >
                    <template #append>USD</template>
                  </el-input>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="销量">
                  <el-input
                    v-model="addForm.salesVolume"
                    placeholder="请输入销量"
                    type="number"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="上架天数">
                  <el-input
                    v-model="addForm.listingDays"
                    placeholder="请输入上架天数"
                    type="number"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="产品类型" prop="productType">
                  <el-select
                    v-model="addForm.productType"
                    placeholder="请选择产品类型"
                  >
                    <el-option label="新品榜" value="new" />
                    <el-option label="竞品店铺" value="reference" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="商品链接">
              <el-input
                v-model="addForm.productLink"
                placeholder="请输入商品链接"
              />
            </el-form-item>

            <el-form-item label="图片链接">
              <el-input
                v-model="addForm.imageUrl"
                placeholder="请输入商品图片链接"
              />
            </el-form-item>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="店铺名称">
                  <el-input
                    v-model="addForm.storeName"
                    placeholder="请输入店铺名称"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="店铺链接">
                  <el-input
                    v-model="addForm.storeUrl"
                    placeholder="请输入店铺链接"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="分类">
                  <el-input
                    v-model="addForm.category"
                    placeholder="请输入产品分类"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="来源">
                  <el-input
                    v-model="addForm.source"
                    placeholder="请输入产品来源"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="标签">
              <el-select
                v-model="addForm.tags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="请输入标签"
                style="width: 100%"
              >
                <el-option
                  v-for="item in tagOptions"
                  :key="item"
                  :label="item"
                  :value="item"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="配送方式">
              <el-input
                v-model="addForm.deliveryMethod"
                placeholder="请输入配送方式"
              />
            </el-form-item>

            <el-form-item label="相似商品">
              <el-input
                v-model="addForm.similarProducts"
                type="textarea"
                :rows="2"
                placeholder="请输入相似商品链接，多个链接用逗号分隔"
              />
            </el-form-item>

            <el-form-item label="备注">
              <el-input
                v-model="addForm.notes"
                type="textarea"
                :rows="3"
                placeholder="请输入备注信息"
              />
            </el-form-item>

            <el-form-item label="本地路径">
              <el-input
                v-model="addForm.localPath"
                placeholder="请输入本地图片路径"
              />
            </el-form-item>

            <el-form-item label="缩略图路径">
              <el-input
                v-model="addForm.thumbPath"
                placeholder="请输入缩略图路径"
              />
            </el-form-item>
          </el-form>

          <template #footer>
            <el-button @click="handleAddCancel">取消</el-button>
            <el-button
              type="primary"
              :loading="adding"
              @click="handleAddSubmit"
            >
              确定添加
            </el-button>
          </template>
        </el-dialog>

      </div>
    </div>

    <!-- 以图识图结果弹窗 -->
    <el-dialog
      v-model="imageSearchVisible"
      title="以图识图（英国）"
      width="70%"
      top="6vh"
      destroy-on-close
    >
      <ImageSearchPanel
        v-if="imageSearchAsin"
        ref="imageSearchPanelRef"
        :asin="imageSearchAsin"
        :source-image="imageSearchImage"
      />
    </el-dialog>

    <!-- 方法卡详情抽屉 (复用组件) -->
    <MethodDetailDrawer
      v-model="methodDetailVisible"
      :method-id="methodDetailId"
      :fixed-source="
        isPremiumProductsScene
          ? 'premium_products'
          : isShopProductsScene
            ? 'shop_products'
            : undefined
      "
      :marketplace="activeFilters.country || 'UK'"
      @rule-saved="onM01RuleSaved"
    />

    <!-- AI 选品：导入 ASIN 弹窗 -->
    <el-dialog v-model="aiImportDialogVisible" title="导入 ASIN" width="520px" @close="aiImportAsinInput = ''">
      <el-input
        v-model="aiImportAsinInput"
        type="textarea"
        :rows="8"
        :disabled="aiImportLoading"
        placeholder="粘贴 ASIN，每行一个或用空格/逗号分隔&#10;示例：&#10;B0GT4SCSDL&#10;B0H33FYNHY"
      />
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 13px; color: #64748b;">
        <span v-if="aiImportParsedCount > 0">识别到 <strong>{{ aiImportParsedCount }}</strong> 个 ASIN</span>
        <span v-else>输入 ASIN 后将自动识别</span>
        <el-select v-model="aiImportMarketplace" size="small" placeholder="站点（可选）" clearable style="width: 130px">
          <el-option label="美国 US" value="US" />
          <el-option label="英国 UK" value="UK" />
          <el-option label="德国 DE" value="DE" />
        </el-select>
      </div>
      <template #footer>
        <el-button @click="aiImportDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="aiImportLoading" :disabled="aiImportParsedCount === 0" @click="handleAiImport">
          查询并导入
        </el-button>
      </template>
    </el-dialog>

    <!-- 非标载体：管理 -->
    <el-dialog v-model="carrierManageVisible" title="载体管理" width="820px">
      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px;">
        载体定义「一类非标品用哪套检索词」。点「一键同步本周全载体」把所有载体商品灌入本周批次；也可对单个载体点「同步数据」补捞。之后在顶部按载体筛选。
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <span style="font-size: 13px; color: #64748b;">同步站点：</span>
        <el-select v-model="carrierSyncMarketplaces" multiple collapse-tags collapse-tags-tooltip size="small" style="width: 220px;" placeholder="默认三国全选">
          <el-option label="英国 UK" value="UK" />
          <el-option label="德国 DE" value="DE" />
          <el-option label="美国 US" value="US" />
        </el-select>
        <el-button type="success" size="small" :loading="carrierSyncingAll" @click="handleCarrierSyncAll">一键同步本周全载体</el-button>
        <span v-if="carrierSyncAllProgress" style="font-size: 12px; color: #16a34a;">{{ carrierSyncAllProgress }}</span>
        <span v-else style="font-size: 12px; color: #94a3b8;">（全部 enabled 载体写入本周批次 batch_周，重复同步=增量，不新开批次）</span>
      </div>
      <el-table :data="carrierList" size="small" border style="margin-bottom: 16px;">
        <el-table-column prop="name" label="名称" width="80" />
        <el-table-column prop="carrierKey" label="键" width="80" />
        <el-table-column prop="titleKeywords" label="标题主词" show-overflow-tooltip />
        <el-table-column prop="categoryPaths" label="类目词" width="120" show-overflow-tooltip />
        <el-table-column prop="excludeKeywords" label="硬排除词" width="120" show-overflow-tooltip />
        <el-table-column prop="conditionalExcludeKeywords" label="条件排除词" width="120" show-overflow-tooltip />
        <el-table-column prop="includeKeywords" label="成品保护词" width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="190">
          <template #default="{ row }">
            <el-button link type="success" size="small" :loading="carrierSyncing === row.carrierKey" @click="handleCarrierSync(row)">同步数据</el-button>
            <el-button link type="primary" size="small" @click="editCarrier(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="removeCarrier(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-divider content-position="left">{{ carrierEditForm.id ? "编辑载体" : "新增载体" }}</el-divider>
      <el-form :model="carrierEditForm" label-width="90px" size="small">
        <el-form-item label="载体键">
          <el-input v-model="carrierEditForm.carrierKey" placeholder="英文键，如 guapai" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="carrierEditForm.name" placeholder="中文名，如 挂牌" />
        </el-form-item>
        <el-form-item label="标题主词">
          <el-input v-model="carrierEditForm.titleKeywords" type="textarea" :rows="2" placeholder="逗号分隔：suncatcher,stained glass%window hanging,..." />
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">支持 SQL LIKE 的 % 表示有序插词，不能使用裸 window hanging 等过宽主词。</div>
        </el-form-item>
        <el-form-item label="类目词">
          <el-input v-model="carrierEditForm.categoryPaths" placeholder="逗号分隔：Sun Catchers,Sonnenfänger" />
        </el-form-item>
        <el-form-item label="硬排除词">
          <el-input v-model="carrierEditForm.excludeKeywords" type="textarea" :rows="2" placeholder="逗号分隔：sticker,window hanging chain,..." />
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">标题或类目召回的商品都会过滤，成品保护词不能覆盖。</div>
        </el-form-item>
        <el-form-item label="条件排除词">
          <el-input v-model="carrierEditForm.conditionalExcludeKeywords" type="textarea" :rows="2" placeholder="逗号分隔：diy set,bastelset,crystal pendant,..." />
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">通常排除；标题同时命中成品保护词时救回。</div>
        </el-form-item>
        <el-form-item label="成品保护词">
          <el-input v-model="carrierEditForm.includeKeywords" type="textarea" :rows="2" placeholder="逗号分隔：acrylic puzzle,stained glass window hanging,..." />
          <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">只覆盖条件排除，不能救回珠子、贴纸、链条等硬污染。</div>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="carrierEditForm.note" placeholder="定锚说明（可选）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="carrierEditForm.id" @click="resetCarrierForm">取消编辑</el-button>
        <el-button type="primary" @click="saveCarrierForm">{{ carrierEditForm.id ? "更新" : "新增" }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "AllSelection" });
import {
  ref,
  shallowRef,
  markRaw,
  reactive,
  onMounted,
  onUnmounted,
  onActivated,
  onDeactivated,
  computed,
  nextTick,
  watch,
} from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox, ElLoading } from "element-plus";
import {
  Plus,
  Upload,
  Download,
  Delete,
  Search,
  Refresh,
  UploadFilled,
  Picture,
  PictureFilled,
  Select,
  CircleClose,
  Collection,
  Setting,
  TrendCharts,
  Shop,
  Trophy,
  Top,
  Bottom,
  MoreFilled,
  Filter,
  CircleCheck,
  Warning,
  Aim,
  Lock,
  Close,
  DataBoard,
  Files,
  InfoFilled,
} from "@element-plus/icons-vue";
import type { FormInstance, FormRules, UploadFile } from "element-plus";
import UniversalCard from "@/components/UniversalCard/index.vue";
import ImageSearchPanel from "@/components/ImageSearchPanel/index.vue";
import SkeletonWrapper from "@/components/SkeletonWrapper/index.vue";
import ProductDetailDialog from "@/components/ProductDetailDialog/index.vue";
import SelectionQueryForm from "@/components/SelectionQueryForm/index.vue";
import {
  defaultQueryParams,
  type SelectionQueryParams,
} from "@/components/SelectionQueryForm/types";
import FilterPresetSelector from "@/components/FilterPresetSelector/index.vue";
import QualifyRuleFilter from "@/components/QualifyRuleFilter/index.vue";
import RangeFilterPanel from "@/components/RangeFilterPanel/index.vue";
import FilterDrawer from "@/components/FilterDrawer/index.vue";
import { selectionApi } from "@/api/selection";
import { competitorApi, getPremiumCreatedWeeks } from "@/api/competitor";
import { methodCardsApi } from "@/api/methodCards";
import shopCollectionApi from "@/api/shopCollection";
import type { QualifyRule } from "@/api/competitor";
import {
  buildSelectionFilterIntent,
  buildSelectionQueryPlan,
  type SelectionScene,
  type SelectionFilterState as QueryPlanFilterState,
  type SelectionQueryPlan,
} from "./composables/queryPlan";
import { resolveSelectionQueryPlan } from "./composables/queryRuntime";
import {
  downloadAllResultsCsv,
  exportXlsxViaTask,
} from "./composables/selectionCsv";
import { emptyRange, useSelectionFilterState } from "./composables/filterState";
import MethodDetailDrawer from "@/components/MethodDetailDrawer/index.vue";
import {
  fetchMySelections,
  fetchSelectionUsers,
  trackClick,
} from "@/api/clickLog";
import { useUserStore } from "@/stores/user";
import {
  developerSelectionLibraryApi,
  type DeveloperLibraryBucket,
  type DeveloperSelectionSnapshot,
} from "@/api/developerSelectionLibrary";
import { requestCenterApi } from "@/api/shopPremium";

const router = useRouter();
const route = useRoute();
/** 店铺选品与新品榜共用页面外壳，只在查询计划中替换为 shop_products 数据源。 */
const isShopProductsScene = computed(() => route.path === "/reference-products");
const shopRequestDialogVisible = ref(false);
const shopRequestSubmitting = ref(false);
const shopRequestForm = reactive({ marketplace: "UK", sellerName: "" });
/** 精品复用同一页面外壳，但始终读取 premium_products 原始表。 */
const isPremiumProductsScene = computed(() => route.path === "/premium-products");
/** 这三个业务页共用下载中心的异步 XLSX 导出。 */
const isDownloadCenterXlsxScene = computed(() =>
  ["/new-products", "/reference-products", "/premium-products"].includes(
    route.path,
  ),
);
/** AI 选品复用同一页面外壳，读取 ai_selection 持久表。 */
const isAiSelectionScene = computed(() => route.path === "/ai-selection");
/** BRS 榜单复用同一页面外壳，读取 brs_ranking_raw 表。 */
const isBrsScene = computed(() => route.path === "/brs-ranking");
/** 领星店铺数据复用同一页面外壳，读取 lingxing_product_unified 统一表。 */
const isLingxingShopScene = computed(
  () => route.path === "/lingxing-shop-data",
);
const isFixedSelectionSourceScene = computed(
  () =>
    isShopProductsScene.value ||
    isPremiumProductsScene.value ||
    isAiSelectionScene.value ||
    isBrsScene.value ||
    isLingxingShopScene.value,
);
const isReadOnlySourceScene = isFixedSelectionSourceScene;
const isManualLibrarySourceScene = computed(() =>
  [
    "/all-selection",
    "/new-products",
    "/reference-products",
    "/premium-products",
    "/ai-selection",
  ].includes(route.path),
);

function openShopRequestDialog() {
  shopRequestForm.marketplace = activeFilters.country || queryParamsState.value.country || "UK";
  shopRequestForm.sellerName = "";
  shopRequestDialogVisible.value = true;
}

async function submitShopRequest() {
  const sellerName = shopRequestForm.sellerName.trim();
  if (!shopRequestForm.marketplace || !sellerName) {
    ElMessage.warning("请选择国家并填写店铺名");
    return;
  }

  shopRequestSubmitting.value = true;
  try {
    const result = await requestCenterApi.createShopTaskOnce({
      marketplace: shopRequestForm.marketplace,
      triggerType: "MANUAL",
      triggerRef: JSON.stringify({ source: "reference-products" }),
      fetchReason: "店铺选品页手动请求店铺全集",
      items: [{ marketplace: shopRequestForm.marketplace, sellerName }],
    });
    shopRequestDialogVisible.value = false;
    if (result.queuedCount > 0) {
      ElMessage.success("请求成功，请搜索店铺查看");
    } else {
      ElMessage.info("该店铺已请求过或已有数据，请搜索店铺查看");
    }
  } catch (error: any) {
    ElMessage.error(error?.message || "店铺请求失败");
  } finally {
    shopRequestSubmitting.value = false;
  }
}
const detailDataSource = computed(() =>
  isPremiumProductsScene.value ? "premium" : "selection",
);
const queryParamsState = ref<SelectionQueryParams>({ ...defaultQueryParams });

const syncQueryParamsState = (params?: Partial<SelectionQueryParams>) => {
  queryParamsState.value = {
    ...queryParamsState.value,
    ...(params || {}),
  };
};

const applyQueryParams = (params?: Partial<SelectionQueryParams>) => {
  syncQueryParamsState(params);
};

// 组件刷新key
const componentKey = ref(2);

// 当前激活的标签页
const activeTab = ref<string>("all");

// 统一筛选框是默认查询的唯一条件来源；方法规则只在用户显式应用时生效。
const newQualifyRules = ref<QualifyRule[]>([]);
const activeMethodCard = ref<{
  id: "M01" | "M02" | "M03";
  name: string;
} | null>(null);

// 方法卡详情抽屉状态 (内容由 MethodDetailDrawer 组件根据 methodId 自动读取)
const methodDetailVisible = ref(false);
const methodDetailId = ref<"M01" | "M02" | "M03" | null>(null);

const openMethodDetail = (id: "M01" | "M02" | "M03") => {
  methodDetailId.value = id;
  methodDetailVisible.value = true;
};

// M01 阈值保存成功后：若当前正在看 M01 候选，立即用新口径重查列表
const onM01RuleSaved = async (marketplace: "UK" | "DE" | "US") => {
  if (activeMethodCard.value?.id !== "M01") return;
  const currentMarketplace = normalizeM01Marketplace(activeFilters.value.country);
  if (marketplace !== currentMarketplace) {
    ElMessage.info(`${marketplace} 站阈值已保存；当前页面是 ${currentMarketplace} 站，列表未重查`);
    return;
  }

  const beforeTotal = pagination.total;
  await Promise.all([loadProducts(), loadCategories()]);
  const afterTotal = pagination.total;
  if (beforeTotal === afterTotal) {
    ElMessage.info(`M01 已按新阈值刷新，当前命中 ${afterTotal} 条；首页排序可能保持不变`);
  } else {
    ElMessage.success(`M01 命中总数已更新：${beforeTotal} → ${afterTotal}`);
  }
};

// 应用新品榜规则并重新加载
const onNewRulesApply = (rules: QualifyRule[]) => {
  newQualifyRules.value = rules;
  pagination.page = 1;
  loadProducts();
};

// 将 activeTab 映射到产品类型字符串
const activeProductType = computed<"" | "new" | "reference" | "zheng">(() => {
  const map: Record<string, "" | "new" | "reference" | "zheng"> = {
    new: "new",
    reference: "reference",
    zheng: "zheng",
    all: "",
  };
  return map[activeTab.value] || "";
});

// 将 activeTab 映射到导入类型（import 接口用 'all' 而非 ''）
const activeImportType = computed(() => {
  const map: Record<string, string> = {
    new: "new",
    reference: "reference",
    zheng: "zheng",
    all: "all",
  };
  return map[activeTab.value] || "all";
});

// 标签页切换处理
const handleTabChange = (tab: string): void => {
  activeTab.value = tab;
  activeMethodCard.value = null;

  const productTypeMap: Record<string, "new" | "reference" | "zheng" | ""> = {
    all: "",
    new: "new",
    reference: "reference",
    zheng: "zheng",
  };

  // 新品榜默认：英国（筛选改由合格规则承担）
  const defaults = tab === "new" ? { country: "UK" } : {};
  applyQueryParams({
    productType: productTypeMap[tab] || "",
    ...defaults,
  });

  // 重置页码并重新加载数据
  pagination.page = 1;
  loadProducts();
};

// 获取当前区域标题
const getSectionTitle = (): string => {
  if (activeMethodCard.value?.id === "M03") return "FBM 自发货";
  const titles = {
    all: "全部选品",
    new: "新品榜",
    reference: "店铺选品",
    premium: "精品",
    zheng: "非标店铺上新",
    fbm: "FBM 自发货",
    ai_selection: "AI 选品",
    brs: "BRS榜单",
  };
  return titles[activeTab.value as keyof typeof titles] || "选品管理";
};

// 商品列表用 shallowRef + markRaw：商品是「只读展示数据」，卡片不修改其字段，
// 无需深层响应式。避免几百条 × 数十字段的 reactive 深代理开销（前端卡顿主因之一）。
// 整表替换（productList.value = [...]）仍触发视图更新，满足翻页/搜索刷新。
const productList = shallowRef<Record<string, any>[]>([]);
const selectedIds = ref([]);
const libraryAddingBucket = ref<DeveloperLibraryBucket | null>(null);
const DEFAULT_ADMIN_LIBRARY_DEVELOPER_NAME = "刘淼";
const selectionMode = ref(false);
const cardSelectionEnabled = computed(
  () => !isManualLibrarySourceScene.value || selectionMode.value,
);
const pinSelected = ref(false);
/**
 * 是否查询清洗表（按父 ASIN 去重后的代表行）。
 * 默认 true：消费 competitor_products_clean，避免变体污染。
 * zheng tab 走独立接口（deng_zong_shop 自己已去重），开关对它无效。
 */
const useCleanTable = ref(true);
const onUseCleanTableChange = () => {
  pagination.page = 1;
  loadProducts();
};
/** 当前 tab 对应的 source 字符串（与 sourceMap 保持一致），供 RangeFilterPanel 拉同口径的周列表 */
const currentSource = computed(() => {
  const m: Record<string, string> = {
    new: "新品榜",
    reference: "店铺商品",
    premium: "精品榜",
    zheng: "非标店铺",
    ai_selection: "AI 选品",
    brs: "BRS榜单",
    all: "",
  };
  return m[effectiveScene.value] || "";
});
const effectiveScene = computed(() => {
  // /reference-products 始终维持店铺语义；M01/M03 仅作为叠加规则，不能切回新品榜。
  if (isShopProductsScene.value) return "reference";
  // 精品同样固定数据源；方法卡只叠加规则，不得切换回 competitor clean。
  if (isPremiumProductsScene.value) return "premium";
  // AI 选品固定数据源，不支持方法卡。
  if (isAiSelectionScene.value) return "ai_selection";
  // BRS 榜单固定数据源，不支持方法卡。
  if (isBrsScene.value) return "brs";
  // 领星店铺数据固定读统一表，不支持方法卡。
  if (isLingxingShopScene.value) return "lingxing_shop";
  if (activeMethodCard.value?.id === "M01") return "new";
  if (activeMethodCard.value?.id === "M02") return "zheng";
  if (activeMethodCard.value?.id === "M03") return "fbm";
  if (
    activeTab.value === "all" ||
    activeTab.value === "new" ||
    activeTab.value === "reference" ||
    activeTab.value === "premium" ||
    activeTab.value === "zheng" ||
    activeTab.value === "fbm"
  ) {
    return activeTab.value;
  }
  return "all";
});
const currentSnapshotKind = computed<
  | "competitor_created_week"
  | "premium_created_week"
  | "deng_zong_batch"
  | "shop_batch"
  | "ai_selection_batch"
  | "lingxing_shop_store"
  | "brs_ranking_created_week"
>(() =>
  effectiveScene.value === "premium"
    ? "premium_created_week"
    : effectiveScene.value === "reference"
    ? "shop_batch"
    : effectiveScene.value === "zheng"
      ? "deng_zong_batch"
      : effectiveScene.value === "ai_selection"
        ? "ai_selection_batch"
        : effectiveScene.value === "lingxing_shop"
          ? "lingxing_shop_store"
          : effectiveScene.value === "brs"
            ? "brs_ranking_created_week"
            : "competitor_created_week",
);
const mySelections = ref<Set<string>>(new Set());
const selectionUsersMap = ref<
  Record<string, { userId: number; userName: string }[]>
>({});
/** 防止重复点击：正在处理中的 ASIN */
const togglingAsins = ref<Set<string>>(new Set());
/** 记录每个 ASIN 最近一次操作时间，轮询时跳过近期操作的 ASIN */
const lastToggleTime = ref<Record<string, number>>({});

/** 选中产品置顶（需开启开关） */
const sortedProductList = computed(() => {
  const list = productList.value;
  if (!pinSelected.value || mySelections.value.size === 0) return list;
  const selected: any[] = [];
  const unselected: any[] = [];
  for (const p of list) {
    (mySelections.value.has(p.asin) ? selected : unselected).push(p);
  }
  return [...selected, ...unselected];
});

/** 选中用户实时轮询定时器（5 秒间隔，同步其他用户的选中状态） */
let selectionPollTimer: ReturnType<typeof setInterval> | null = null;
const selectedProduct = ref(null);
const detailDialogVisible = ref(false);
const addDialogVisible = ref(false);
const loading = ref(false);
const importDialogVisible = ref(false);
const searchByImageDialogVisible = ref(false);
const importing = ref(false);
const searching = ref(false);
const exportingAllResults = ref(false);
const exportingSelectedXlsx = ref(false);

// AI 选品导入 ASIN 状态
const aiImportDialogVisible = ref(false);
const aiImportAsinInput = ref("");
const aiImportMarketplace = ref("");
const aiImportLoading = ref(false);
const aiImportParsed = computed(() =>
  [...new Set(aiImportAsinInput.value.split(/[,;\s\n]+/).map((s) => s.trim()).filter(Boolean))],
);
const aiImportParsedCount = computed(() => aiImportParsed.value.length);

// 非标载体：多选筛选 + 管理
const carrierList = ref<any[]>([]);
const carrierFilter = ref<string[]>([]); // 顶部多选筛选：选中的载体键
const carrierManageVisible = ref(false);
// 管理弹窗内同步数据的站点（多选，默认三国全选，一次同步多国）
const carrierSyncMarketplaces = ref<string[]>(["UK", "DE", "US"]);
const carrierSyncing = ref(""); // 正在同步的载体键
const carrierSyncingAll = ref(false); // 一键同步本周全载体进行中
const carrierSyncAllProgress = ref(""); // 全载体同步进度文案
const carrierEditForm = reactive({
  id: undefined as number | undefined,
  carrierKey: "",
  name: "",
  titleKeywords: "",
  categoryPaths: "",
  excludeKeywords: "",
  conditionalExcludeKeywords: "",
  includeKeywords: "",
  note: "",
});

const loadCarriers = async () => {
  try {
    const { getCarriers } = await import("@/api/nonstandard-carrier");
    carrierList.value = await getCarriers();
  } catch (e) {
    ElMessage.error(`载体列表加载失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
};

/** 载体多选筛选变化：重置到第一页并按载体重查 */
const handleCarrierFilterChange = () => {
  pagination.page = 1;
  loadProducts();
  loadCategories();
};

const openCarrierManage = async () => {
  carrierManageVisible.value = true;
  await loadCarriers();
};

/** RangeFilterPanel 删除某 AI 选品批次后：重拉商品列表与类目统计。
 *  批次下拉自身已在组件内刷新，这里只需同步主列表。 */
const handleBatchDeleted = (_batchId: string) => {
  if (!isAiSelectionScene.value) return;
  pagination.page = 1;
  loadProducts();
  loadCategories();
};

/** 管理弹窗内：把某载体的商品从两表全批次增量同步进选品库（数据入口，非主筛选流程）。
 *  一次请求带多站点：后端合并为「一个批次」，相对 载体+站点+ASIN 历史去重，只灌新增。
 *  卖家精灵/库容无关，纯库内 INSERT SELECT。 */
const handleCarrierSync = async (row: any) => {
  const markets = carrierSyncMarketplaces.value;
  if (!markets || markets.length === 0) {
    ElMessage.warning("请先选择至少一个同步站点");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将从 shop_products + 新品榜全批次按「${row.name}」检索词捞取 ${markets.join(" / ")} 站点商品，写入「本周批次」：同周重复=增量（已有不重复、新增补入）。确定继续？`,
      "补捞载体数据（写入本周批次）",
      { type: "warning" },
    );
  } catch {
    return;
  }
  carrierSyncing.value = row.carrierKey;
  try {
    const { harvest } = await import("@/api/ai-selection-pool");
    // 单载体补捞，写入当周批次
    const resp = await harvest(row.carrierKey, markets);
    ElMessage.success(
      `补捞完成：${row.name} 写入本周批次，当前本周批次共 ${resp.total ?? 0} 条`,
    );
    if (isAiSelectionScene.value) {
      pagination.page = 1;
      loadProducts();
      loadCategories();
    }
  } catch (e) {
    ElMessage.error(`同步失败: ${e instanceof Error ? e.message : "未知错误"}`);
  } finally {
    carrierSyncing.value = "";
  }
};

/** 一键同步本周全载体：后端遍历所有 enabled 载体，全部写入当周批次 batch_<ISO周>。
 *  同周重复=增量更新，不新开批次。 */
const handleCarrierSyncAll = async () => {
  const markets = carrierSyncMarketplaces.value;
  if (!markets || markets.length === 0) {
    ElMessage.warning("请先选择至少一个同步站点");
    return;
  }
  try {
    await ElMessageBox.confirm(
      `将遍历所有启用载体，从 shop_products + 新品榜全批次捞取 ${markets.join(" / ")} 站点商品，全部合并写入「本周批次」。同周重复同步=增量更新，不新开批次。确定继续？`,
      "一键同步本周全载体",
      { type: "warning" },
    );
  } catch {
    return;
  }
  carrierSyncingAll.value = true;
  try {
    const { harvestAll, harvestRunStatus } = await import(
      "@/api/ai-selection-pool"
    );
    const { runId } = await harvestAll(markets);
    ElMessage.info("已开始后台同步全载体，进度将实时更新…");

    // 轮询进度：每 2.5s 查一次，直到 SUCCESS/FAILED
    await new Promise<void>((resolve) => {
      const timer = setInterval(async () => {
        try {
          const st = await harvestRunStatus(runId);
          const done = st.carrierDone ?? 0;
          const total = st.carrierTotal ?? 0;
          if (st.status === "RUNNING") {
            carrierSyncAllProgress.value = `同步中 ${done}/${total} 步，已入库 ${st.batchTotal ?? 0} 条`;
          } else if (st.status === "SUCCESS") {
            clearInterval(timer);
            carrierSyncAllProgress.value = "";
            ElMessage.success(
              `全载体同步完成：${markets.join("/")} 本周批次共 ${st.batchTotal ?? 0} 条商品（1 个批次）`,
            );
            if (isAiSelectionScene.value) {
              pagination.page = 1;
              loadProducts();
              loadCategories();
            }
            resolve();
          } else {
            clearInterval(timer);
            carrierSyncAllProgress.value = "";
            ElMessage.error(`同步失败: ${st.errorMessage ?? "未知错误"}`);
            resolve();
          }
        } catch (e) {
          clearInterval(timer);
          carrierSyncAllProgress.value = "";
          ElMessage.error(
            `进度查询失败: ${e instanceof Error ? e.message : "未知错误"}`,
          );
          resolve();
        }
      }, 2500);
    });
  } catch (e) {
    ElMessage.error(`同步失败: ${e instanceof Error ? e.message : "未知错误"}`);
  } finally {
    carrierSyncingAll.value = false;
  }
};

const resetCarrierForm = () => {
  carrierEditForm.id = undefined;
  carrierEditForm.carrierKey = "";
  carrierEditForm.name = "";
  carrierEditForm.titleKeywords = "";
  carrierEditForm.categoryPaths = "";
  carrierEditForm.excludeKeywords = "";
  carrierEditForm.conditionalExcludeKeywords = "";
  carrierEditForm.includeKeywords = "";
  carrierEditForm.note = "";
};

const editCarrier = (row: any) => {
  carrierEditForm.id = row.id;
  carrierEditForm.carrierKey = row.carrierKey;
  carrierEditForm.name = row.name;
  carrierEditForm.titleKeywords = row.titleKeywords ?? "";
  carrierEditForm.categoryPaths = row.categoryPaths ?? "";
  carrierEditForm.excludeKeywords = row.excludeKeywords ?? "";
  carrierEditForm.conditionalExcludeKeywords = row.conditionalExcludeKeywords ?? "";
  carrierEditForm.includeKeywords = row.includeKeywords ?? "";
  carrierEditForm.note = row.note ?? "";
};

const saveCarrierForm = async () => {
  if (!carrierEditForm.carrierKey || !carrierEditForm.name) {
    ElMessage.warning("载体键和名称必填");
    return;
  }
  try {
    const { saveCarrier } = await import("@/api/nonstandard-carrier");
    await saveCarrier({ ...carrierEditForm });
    ElMessage.success("已保存");
    resetCarrierForm();
    await loadCarriers();
  } catch (e) {
    ElMessage.error(`保存失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
};

const removeCarrier = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定删除载体「${row.name}」？`, "提示", { type: "warning" });
  } catch {
    return;
  }
  try {
    const { deleteCarrier } = await import("@/api/nonstandard-carrier");
    await deleteCarrier(row.id);
    ElMessage.success("已删除");
    await loadCarriers();
  } catch (e) {
    ElMessage.error(`删除失败: ${e instanceof Error ? e.message : "未知错误"}`);
  }
};

/** 首屏是否已完成首次加载（用于骨架屏/loading切换） */
const hasLoaded = ref(false);
const refreshing = computed(() => loading.value && hasLoaded.value);

const adding = ref(false);
const uploadRef = ref(null);
const imageUploadRef = ref(null);
const importFile = ref(null);
const importMode = ref("skip"); // 导入模式：skip(跳过)/update(更新)/overwrite(覆盖)
const searchImageFile = ref(null);
const searchImagePreview = ref("");
const categories = ref([]);

// ===== 统一筛选状态：activeFilters(已生效) + draftFilters(抽屉草稿) =====
type FilterState = QueryPlanFilterState;

const addForm = reactive({
  asin: "",
  productTitle: "",
  price: "",
  imageUrl: "",
  localPath: "",
  thumbPath: "",
  storeName: "",
  storeUrl: "",
  category: "",
  tags: [],
  notes: "",
  productLink: "",
  salesVolume: "",
  listingDate: "",
  listingDays: "",
  deliveryMethod: "",
  similarProducts: "",
  source: "",
  productType: "new",
});

const addFormRef = ref(null);

const addFormRules = {
  asin: [
    { required: true, message: "请输入ASIN", trigger: "blur" },
    { min: 10, max: 10, message: "ASIN必须为10位字符", trigger: "blur" },
  ],
  productTitle: [
    { required: true, message: "请输入商品标题", trigger: "blur" },
    {
      min: 1,
      max: 200,
      message: "商品标题长度在1-200个字符之间",
      trigger: "blur",
    },
  ],
  productType: [
    { required: true, message: "请选择产品类型", trigger: "change" },
  ],
};

const tagOptions = [
  "热销",
  "新品",
  "爆款",
  "潜力款",
  "高利润",
  "低竞争",
  "季节性",
  "节日款",
  "家居",
  "电子",
  "服装",
  "美妆",
  "母婴",
  "户外",
  "宠物",
  "办公",
];

const CARD_SCALE_STORAGE_KEY = "sjzm:all-selection:card-scale";
const CARD_SCALE_MIN = 0.4;
const CARD_SCALE_MAX = 1;
const CARD_SCALE_STEP = 0.1;
const DEFAULT_CARD_SCALE = 0.5;
const BASE_CARD_WIDTH = 280;
const BASE_CARD_HEIGHT = 560;
const BASE_CARD_GAP = 16;

const normalizeCardScale = (value: number): number => {
  const rounded = Math.round(value / CARD_SCALE_STEP) * CARD_SCALE_STEP;
  return Math.min(
    CARD_SCALE_MAX,
    Math.max(CARD_SCALE_MIN, Number(rounded.toFixed(1))),
  );
};

const readCardScale = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(CARD_SCALE_STORAGE_KEY));
    return Number.isFinite(stored)
      ? normalizeCardScale(stored)
      : DEFAULT_CARD_SCALE;
  } catch {
    return DEFAULT_CARD_SCALE;
  }
};

const cardScale = ref(readCardScale());
const cardScalePercent = computed(() => Math.round(cardScale.value * 100));
const productGridStyle = computed(() => ({
  "--selection-card-scale": String(cardScale.value),
  "--selection-card-min-width":
    Math.round(BASE_CARD_WIDTH * cardScale.value) + "px",
  "--selection-card-fallback-height":
    Math.round(BASE_CARD_HEIGHT * cardScale.value) + "px",
  "--selection-card-gap":
    Math.max(8, Math.round(BASE_CARD_GAP * cardScale.value)) + "px",
}));

const productCardKey = (product: Record<string, unknown>): string =>
  String(product.id ?? product.asin ?? "");

// 卡片缩放改用 CSS zoom（见 .product-card-scale-canvas 样式）：卡片在正常文档流中
// 自然撑高，无需再用 ResizeObserver 测量 canvas 高度回填 wrapper。原先那套
// cardBaseHeights + cardHeightObserver + cardWrapperStyle 在滚动时会因 200 张卡进出
// 视口触发 observer 回调风暴 → 越滚越卡直至卡死，现已整体删除。
const resetVisibleCardMetrics = (_products: Record<string, unknown>[]) => {};

// ============================================================
// 网格行虚拟化（当前阈值下常用 page size 走全量渲染，保留逻辑供大列表兜底）。
// zoom 缩放后卡片高度由 CSS 自然决定，虚拟化行高估算仅用 fallback 近似。
// ============================================================
const productsGridRef = ref<HTMLElement | null>(null);
const gridScrollTop = ref(0);
const gridViewportHeight = ref(0);
const gridColumns = ref(1);
const VIRT_ROW_BUFFER = 3; // 可视区上下各多渲染的缓冲行数
// 阈值 600：覆盖常用每页规模(60/100/200)走全量渲染。全量渲染用原生滚动，
// 配合 zoom(CSS 自然高度) + v-memo + shallowRef + markRaw + content-visibility 视口裁剪，
// 无 JS 高度测量/回调风暴。500 选项已从前端移除。
const VIRT_MIN_COUNT = 600;

const scaledFallbackRowHeight = computed(
  () => Math.round(BASE_CARD_HEIGHT * cardScale.value),
);
const scaledGap = computed(() => Math.max(8, Math.round(BASE_CARD_GAP * cardScale.value)));

// 虚拟化行高估算（仅超大列表兜底用）：zoom 后无逐卡实测高度，统一用 fallback 近似。
const scaledCardHeight = (_product: Record<string, unknown>): number => {
  return scaledFallbackRowHeight.value;
};

// 依据容器宽度与卡片最小宽度推算每行列数。
const recomputeGridColumns = () => {
  const el = productsGridRef.value;
  if (!el) return;
  const styles = getComputedStyle(el);
  const minWidth = Math.round(BASE_CARD_WIDTH * cardScale.value);
  const paddingX =
    parseFloat(styles.paddingLeft || "0") + parseFloat(styles.paddingRight || "0");
  const usable = el.clientWidth - paddingX;
  const gap = scaledGap.value;
  const cols = Math.max(1, Math.floor((usable + gap) / (minWidth + gap)));
  gridColumns.value = cols;
  gridViewportHeight.value = el.clientHeight;
};

// 把当前商品列表按列数切成行，并累计每行 top 偏移与高度。
const virtualRows = computed(() => {
  const list = sortedProductList.value;
  const cols = Math.max(1, gridColumns.value);
  const gap = scaledGap.value;
  const rows: { top: number; height: number; start: number; end: number }[] = [];
  let top = 0;
  for (let i = 0; i < list.length; i += cols) {
    let rowH = 0;
    const end = Math.min(i + cols, list.length);
    for (let j = i; j < end; j++) {
      const h = scaledCardHeight(list[j] as Record<string, unknown>);
      if (h > rowH) rowH = h;
    }
    rows.push({ top, height: rowH, start: i, end });
    top += rowH + gap;
  }
  return rows;
});

const virtualTotalHeight = computed(() => {
  const rows = virtualRows.value;
  if (rows.length === 0) return 0;
  const last = rows[rows.length - 1];
  return last.top + last.height;
});

// 计算当前可视行区间（含 buffer）。
const virtualRange = computed(() => {
  const rows = virtualRows.value;
  const list = sortedProductList.value;
  if (list.length < VIRT_MIN_COUNT || rows.length === 0) {
    return { startIndex: 0, endIndex: list.length, padTop: 0, padBottom: 0 };
  }
  const scrollTop = gridScrollTop.value;
  const viewport = gridViewportHeight.value || 800;
  let firstRow = 0;
  let lastRow = rows.length - 1;
  for (let r = 0; r < rows.length; r++) {
    if (rows[r].top + rows[r].height >= scrollTop) {
      firstRow = r;
      break;
    }
  }
  for (let r = firstRow; r < rows.length; r++) {
    if (rows[r].top > scrollTop + viewport) {
      lastRow = r;
      break;
    }
  }
  firstRow = Math.max(0, firstRow - VIRT_ROW_BUFFER);
  lastRow = Math.min(rows.length - 1, lastRow + VIRT_ROW_BUFFER);
  const startIndex = rows[firstRow].start;
  const endIndex = rows[lastRow].end;
  const padTop = rows[firstRow].top;
  const padBottom = virtualTotalHeight.value - (rows[lastRow].top + rows[lastRow].height);
  return { startIndex, endIndex, padTop, padBottom: Math.max(0, padBottom) };
});

const virtualVisibleProducts = computed(() => {
  const { startIndex, endIndex } = virtualRange.value;
  return sortedProductList.value.slice(startIndex, endIndex);
});

// 用 grid 的上下 padding 占位被虚拟化掉的行，保持滚动高度与列布局。
const virtualGridSpacerStyle = computed(() => {
  const list = sortedProductList.value;
  if (list.length < VIRT_MIN_COUNT) return {};
  const { padTop, padBottom } = virtualRange.value;
  return {
    paddingTop: padTop + "px",
    paddingBottom: padBottom + "px",
  };
});

let gridScrollHandle: number | null = null;
const onGridScroll = () => {
  const el = productsGridRef.value;
  if (!el) return;
  if (gridScrollHandle !== null) return;
  gridScrollHandle = requestAnimationFrame(() => {
    gridScrollHandle = null;
    if (!productsGridRef.value) return;
    gridScrollTop.value = productsGridRef.value.scrollTop;
    gridViewportHeight.value = productsGridRef.value.clientHeight;
  });
};

let gridResizeObserver: ResizeObserver | null = null;
// 列数受容器宽度和缩放影响，两者变化都要重算。
watch(cardScale, () => nextTick(recomputeGridColumns));
// 列表刷新或翻页后回到顶部并重算区间。
watch(
  () => sortedProductList.value.length,
  () => {
    if (productsGridRef.value) productsGridRef.value.scrollTop = 0;
    gridScrollTop.value = 0;
    nextTick(recomputeGridColumns);
  },
);

const pagination = reactive({
  page: 1,
  size: 60,
  total: 0,
});

let categoriesReqId = 0;
const loadCategories = async () => {
  const reqId = ++categoriesReqId;
  // 作用域切换后旧榜单已失效；立即清空，避免新请求完成前误选旧站点/旧批次分类。
  categories.value = [];
  // 根据当前标签页获取分类来源
  const sourceMap: Record<string, string> = {
    new: "新品榜",
    reference: "店铺商品",
    premium: "精品榜",
    zheng: "非标店铺",
    brs: "BRS榜单",
    all: "",
  };
  const source = sourceMap[effectiveScene.value] || "";

  try {
    if (isShopProductsScene.value) {
      const categoryFilters = {
        ...activeFilters.value,
        category: [],
        range: {
          ...activeFilters.value.range,
          category: [],
        },
      };
      const intent = buildSelectionFilterIntent({
        scene: "reference",
        methodId: activeMethodCard.value?.id ?? null,
        queryParams: { ...queryParamsState.value, category: "" },
        activeFilters: categoryFilters,
        useCleanTable: useCleanTable.value,
        qualifyRules: newQualifyRules.value,
      });
      const plan = buildSelectionQueryPlan({ intent, page: 1, size: 1 });
      if (plan.executor !== "shop_products") return;
      const nextCategories = await shopCollectionApi.selectionCategories(plan.params);
      if (reqId !== categoriesReqId) return;
      categories.value = nextCategories;
      return;
    }
    if (isPremiumProductsScene.value) {
      const response = await competitorApi.getPremiumCategories(
        activeFilters.value.country || "UK",
      );
      if (reqId !== categoriesReqId) return;
      categories.value = response.data || [];
      return;
    }
    if (isAiSelectionScene.value) {
      const { getCategories } = await import("@/api/ai-selection-pool");
      const nextCategories = await getCategories(
        activeFilters.value.country || "UK",
        activeFilters.value.range.createdWeeks,
      );
      if (reqId !== categoriesReqId) return;
      categories.value = nextCategories;
      return;
    }
    if (isLingxingShopScene.value) {
      // 领星店铺数据不用大类榜单，改加载"按领星店铺"下拉。
      categories.value = [];
      await loadLingxingStores();
      return;
    }
    if (isBrsScene.value) {
      // BRS 榜单暂无大类榜单接口，先置空（不影响核心筛选/周批次/卡片）。
      categories.value = [];
      return;
    }
    if (activeMethodCard.value?.id === "M01") {
      const categoryFilters = {
        ...activeFilters.value,
        category: [],
        range: {
          ...activeFilters.value.range,
          category: [],
        },
      };
      const intent = buildSelectionFilterIntent({
        scene: effectiveScene.value as SelectionScene,
        methodId: "M01",
        queryParams: { ...queryParamsState.value, category: "" },
        activeFilters: categoryFilters,
        useCleanTable: useCleanTable.value,
        qualifyRules: newQualifyRules.value,
      });
      const plan = buildSelectionQueryPlan({ intent, page: 1, size: 1 });
      if (plan.executor !== "method_card" || plan.methodId !== "M01") return;
      const response = await methodCardsApi.getM01Categories(plan.params);
      if (reqId !== categoriesReqId) return;
      categories.value = response.data || [];
      return;
    }
    const response = await selectionApi.getCategories(source || undefined);
    if (reqId !== categoriesReqId) return;
    categories.value = response.data || [];
    console.log("加载分类列表成功:", categories.value, "来源:", source);
  } catch (error) {
    if (reqId === categoriesReqId) categories.value = [];
    console.error("加载分类列表失败:", error);
  }
};

const lastQueryPlan = ref<SelectionQueryPlan | null>(null);
let productsReqId = 0;

const loadProducts = async (params?: SelectionQueryParams) => {
  const reqId = ++productsReqId;
  loading.value = true;
  try {
    const queryParams = params || queryParamsState.value;
    const intent = buildSelectionFilterIntent({
      scene: effectiveScene.value as SelectionScene,
      methodId: activeMethodCard.value?.id ?? null,
      queryParams,
      activeFilters: activeFilters.value,
      useCleanTable: useCleanTable.value,
      qualifyRules: newQualifyRules.value,
      overrides: isAiSelectionScene.value && carrierFilter.value.length > 0
        ? { carriers: [...carrierFilter.value] }
        : undefined,
    });
    const plan = buildSelectionQueryPlan({
      intent,
      page: pagination.page,
      size: pagination.size,
    });
    console.log("[selection-query-plan]", {
      executor: plan.executor,
      scene: effectiveScene.value,
      methodId: plan.methodId,
      forcedFilters: plan.forcedFilters,
      unsupportedFilters: plan.unsupportedFilters,
      params: plan.params,
    });
    const resolved = await resolveSelectionQueryPlan(plan);
    if (reqId !== productsReqId) return;
    lastQueryPlan.value = resolved.plan;

    // markRaw 每个商品对象：明确标记为非响应式，杜绝进入任何 reactive 代理，
    // 配合 shallowRef 的 productList，几百条数据只有一层浅响应（整表引用）。
    const nextProducts = (resolved.result.list as Record<string, any>[]).map((p) =>
      markRaw(p),
    );
    resetVisibleCardMetrics(nextProducts);
    productList.value = nextProducts;
    pagination.total = resolved.result.total;
    // 商品列表已就位，先结束 loading 让卡片立即渲染；选中态（我的选品 + 多人选中）
    // 与列表渲染无关，改为异步补齐，不再串在首屏关键路径上拖长转圈时间。
    loading.value = false;
    hasLoaded.value = true;
    loadSelections().catch((err) => {
      console.error("加载选品选中态失败:", err);
    });
  } catch (error) {
    if (reqId !== productsReqId) return;
    console.error("加载选品列表失败:", error);
    ElMessage.error("加载选品列表失败");
    loading.value = false;
    hasLoaded.value = true;
  }
};

// M01 支持 UK / DE / US 三站点; 其他站点 (如 FR/IT/ES) 归一为 UK
const normalizeM01Marketplace = (value?: string): "UK" | "DE" | "US" => {
  if (value === "DE") return "DE";
  if (value === "US") return "US";
  return "UK";
};

const createMethodFilterState = (country: string): FilterState => ({
  country,
  sellerSelect: "",
  category: [],
  sortField: isShopProductsScene.value ? "salesVolume" : "createdAt",
  sortOrder: "desc",
  range: emptyRange(),
});

const resetFiltersForMethodCard = () => {
  const country = normalizeM01Marketplace(activeFilters.value.country);
  const fixedSourceWeeks = isPremiumProductsScene.value || isShopProductsScene.value
    ? [...activeFilters.value.range.createdWeeks]
    : [];
  activeFilters.value = createMethodFilterState(country);
  draftFilters.value = createMethodFilterState(country);
  if (fixedSourceWeeks.length > 0) {
    activeFilters.value.range.createdWeeks = fixedSourceWeeks;
    draftFilters.value.range.createdWeeks = [...fixedSourceWeeks];
  }
  applyQueryParams({
    country,
    storeName: "",
    sellerSelect: "",
    category: "",
    dataFilterMode: "",
    listingDateStart: "",
    listingDateEnd: "",
    grade: "",
    weekTag: "",
  });
};

const applyM01Method = () => {
  activeMethodCard.value = { id: "M01", name: "新品榜加速法" };
  // AI 选品页保持在 ai_selection 场景（门槛作用在 ai_selection 表），不切走
  if (!isAiSelectionScene.value) {
    activeTab.value = isPremiumProductsScene.value
      ? "premium"
      : isShopProductsScene.value
        ? "reference"
        : "new";
  }
  resetFiltersForMethodCard();
  filterDrawerVisible.value = false;
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

const applyM02Method = () => {
  if (isFixedSelectionSourceScene.value) {
    ElMessage.info(
      `${isPremiumProductsScene.value ? "精品选品" : "店铺选品"}暂不支持 M02，请选择 M01 或 M03`,
    );
    return;
  }
  activeMethodCard.value = { id: "M02", name: "非标同行品线跟随法" };
  activeTab.value = "zheng";
  resetFiltersForMethodCard();
  filterDrawerVisible.value = false;
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

// M03 FBM 自发货简单道 - 独立 handler, 不共用 M01/new 视角逻辑
const applyM03Method = () => {
  activeMethodCard.value = { id: "M03", name: "FBM 自发货简单道" };
  // AI 选品页保持在 ai_selection 场景（门槛作用在 ai_selection 表），不切走
  if (!isAiSelectionScene.value) {
    activeTab.value = isPremiumProductsScene.value
      ? "premium"
      : isShopProductsScene.value
        ? "reference"
        : "fbm";
  }
  resetFiltersForMethodCard();
  filterDrawerVisible.value = false;
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

const clearMethodCard = () => {
  activeMethodCard.value = null;
  filterDrawerVisible.value = false;
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

const loadSelections = async () => {
  const marketplace = activeFilters.value.country || "UK";
  mySelections.value = await fetchMySelections(marketplace);

  const asins = productList.value.map((p: any) => p.asin).filter(Boolean);
  if (asins.length > 0) {
    selectionUsersMap.value = await fetchSelectionUsers(asins, marketplace);
  }
};

/**
 * 定期刷新当前页产品的选中用户列表（5 秒轮询）
 * 仅更新其他用户状态，保护当前用户的乐观本地状态
 * 跳过最近 3 秒内操作过的 ASIN（防止覆盖乐观更新）
 */
const refreshSelectionUsers = async () => {
  if (!document.hidden && productList.value.length > 0) {
    const userStore = useUserStore();
    const currentUserId = Number(userStore.userInfo?.id) || 1;
    const currentUserName =
      userStore.userInfo?.username || userStore.userInfo?.name || "我";
    const marketplace = activeFilters.value.country || "UK";

    try {
      const queriedAsins = productList.value
        .map((p: any) => p.asin)
        .filter(Boolean);
      const users = await fetchSelectionUsers(queriedAsins, marketplace);
      const now = Date.now();

      // 合并服务端数据与当前用户的乐观本地状态
      for (const asin of Object.keys(users)) {
        // 跳过近期操作过的 ASIN，防止覆盖乐观更新
        if (now - (lastToggleTime.value[asin] || 0) < 3000) continue;

        const serverUsers = users[asin] || [];
        // 服务端无数据时保留本地状态，不覆盖
        if (
          serverUsers.length === 0 &&
          selectionUsersMap.value[asin]?.length > 0
        )
          continue;

        if (mySelections.value.has(asin)) {
          const otherUsers = serverUsers.filter(
            (u: any) => u.userId !== currentUserId,
          );
          selectionUsersMap.value[asin] = [
            { userId: currentUserId, userName: currentUserName },
            ...otherUsers,
          ];
        } else {
          selectionUsersMap.value[asin] = serverUsers;
        }
      }

      // 清理：只清理本次查询范围内、服务端确认不存在、且自己也没选的 ASIN
      const queriedSet = new Set(queriedAsins);
      for (const asin of Object.keys(selectionUsersMap.value)) {
        if (!queriedSet.has(asin)) continue;
        if (now - (lastToggleTime.value[asin] || 0) < 3000) continue;
        if (!(asin in users) && !mySelections.value.has(asin)) {
          delete selectionUsersMap.value[asin];
        }
      }
    } catch {}
  }
};

/** 每个 ASIN 的校准定时器，新操作时取消前次 */
const calibrateTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({});

const handleToggleSelect = async (asin: string, selected: boolean) => {
  // 防抖：同一 ASIN 正在处理中则跳过
  if (togglingAsins.value.has(asin)) return;
  togglingAsins.value.add(asin);

  try {
    const userStore = useUserStore();
    const currentUser = {
      userId: Number(userStore.userInfo?.id) || 1,
      userName:
        userStore.userInfo?.username || userStore.userInfo?.name || "我",
    };

    const marketplace = activeFilters.value.country || "UK";
    const product = productList.value.find((p: any) => p.asin === asin);
    const action = selected ? "select" : "unselect";

    // 记录操作时间，防止轮询覆盖
    lastToggleTime.value[asin] = Date.now();

    // 1. 乐观更新 — 即时显示
    if (selected) {
      mySelections.value.add(asin);
      const existing = selectionUsersMap.value[asin] || [];
      if (!existing.find((u: any) => u.userId === currentUser.userId)) {
        selectionUsersMap.value[asin] = [...existing, currentUser];
      }
    } else {
      mySelections.value.delete(asin);
      const existing = selectionUsersMap.value[asin] || [];
      selectionUsersMap.value[asin] = existing.filter(
        (u: any) => u.userId !== currentUser.userId,
      );
      if (selectionUsersMap.value[asin].length === 0) {
        delete selectionUsersMap.value[asin];
      }
    }

    // 2. 同步到服务端（fire-and-forget）
    const token = userStore.token;
    fetch("/api/v1/click-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify({
        asin,
        marketplace,
        source:
          product?.source ||
          (
            {
              zheng: "非标店铺",
              new: "新品榜",
              reference: "店铺选品",
              premium: "精品",
              brs: "BRS榜单",
            } as Record<
              string,
              string
            >
          )[activeTab.value] ||
          "新品榜",
        action,
        userId: currentUser.userId,
        productTitle: product?.title || product?.productTitle || "",
        userName: currentUser.userName,
      }),
    }).catch(() => {});

    // 3. 取消前次校准，启动新校准（1 秒后，给服务端更多处理时间）
    if (calibrateTimers.value[asin]) {
      clearTimeout(calibrateTimers.value[asin]);
    }
    calibrateTimers.value[asin] = setTimeout(async () => {
      delete calibrateTimers.value[asin];
      try {
        const users = await fetchSelectionUsers([asin], marketplace);
        const serverUsers = users[asin] || [];
        const otherUsers = serverUsers.filter(
          (u: any) => u.userId !== currentUser.userId,
        );

        if (mySelections.value.has(asin)) {
          selectionUsersMap.value[asin] = [currentUser, ...otherUsers];
        } else {
          if (otherUsers.length > 0) {
            selectionUsersMap.value[asin] = otherUsers;
          } else {
            delete selectionUsersMap.value[asin];
          }
        }
      } catch {}
    }, 1000);
  } finally {
    // 短暂防抖后释放
    setTimeout(() => togglingAsins.value.delete(asin), 300);
  }
};

const onQueryFormChange = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
};

const handleSearch = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
  pagination.page = 1;
  loadProducts(params);
};

const triggerFilterQuery = () => {
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

/** 领星店铺数据：按店铺下拉选项 [{store,count}]。 */
const lingxingStores = ref<Array<{ store: string; count: number }>>([]);
async function loadLingxingStores() {
  try {
    const { shopStores } = await import("@/api/lingxingShopData");
    lingxingStores.value = await shopStores(
      activeFilters.value.country || undefined,
    );
  } catch (e) {
    lingxingStores.value = [];
    console.error("加载领星店铺列表失败:", e);
  }
}
/** 切换按店铺筛选 → 重查列表（店铺下拉本身不随选择变化，不重拉）。 */
function onLingxingStoreChange() {
  pagination.page = 1;
  loadProducts();
}

const {
  activeFilters,
  draftFilters,
  filterDrawerVisible,
  activeFilterChips,
  handleReset: baseHandleReset,
  onBarCountryChange: baseOnBarCountryChange,
  onBarCategoryChange,
  openFilterDrawer,
  handleDrawerConfirm,
  handleDrawerReset,
  removeChip,
  getCurrentFilterConfig,
  handlePresetApply,
  setCountry,
} = useSelectionFilterState({
  activeMethodCard,
  getQualifyRules: () => [...newQualifyRules.value],
  setQualifyRules: (rules) => {
    newQualifyRules.value = Array.isArray(rules)
      ? (rules as QualifyRule[])
      : [];
  },
  applyQuery: triggerFilterQuery,
  syncMarketplaceScope: (_marketplace) => {
    // 卖家下拉已移除，不再预拉取上千卖家（曾致抽屉卡死）；仅刷新类目统计。
    loadCategories();
  },
  normalizeMethodMarketplace: normalizeM01Marketplace,
  patchQueryParams: (config) => {
    applyQueryParams(config);
  },
  initialCountry: "UK",
});

const getLatestFixedSourceBatch = async (country: string) => {
  if (isPremiumProductsScene.value) {
    const weeks = await getPremiumCreatedWeeks(country);
    return weeks.data?.[0]?.week;
  }
  if (isShopProductsScene.value) {
    const weeks = await shopCollectionApi.selectionBatches(country);
    return weeks?.[0]?.week;
  }
  return undefined;
};

const resetFixedSourceToLatestBatch = async () => {
  const country = activeFilters.value.country || "UK";
  const latestWeek = await getLatestFixedSourceBatch(country);
  activeMethodCard.value = null;
  activeFilters.value = createMethodFilterState(country);
  draftFilters.value = createMethodFilterState(country);
  if (latestWeek) {
    activeFilters.value.range.createdWeeks = [latestWeek];
    draftFilters.value.range.createdWeeks = [latestWeek];
  }
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

const handleReset = () => {
  if (!isPremiumProductsScene.value && !isShopProductsScene.value) {
    baseHandleReset();
    return;
  }
  resetFixedSourceToLatestBatch().catch((error) => {
    console.error("重置固定选品源最新批次失败:", error);
    ElMessage.error("重置筛选失败");
  });
};

const clearAllFilters = handleReset;

const onBarCountryChange = (country: string) => {
  if (!isPremiumProductsScene.value && !isShopProductsScene.value) {
    baseOnBarCountryChange(country);
    return;
  }
  activeFilters.value.country = country || "UK";
  activeFilters.value.sellerSelect = "";
  draftFilters.value.country = activeFilters.value.country;
  // 卖家下拉已移除，切站点不再预拉取卖家列表
  getLatestFixedSourceBatch(activeFilters.value.country)
    .then((latestWeek) => {
      activeFilters.value.range.createdWeeks = latestWeek ? [latestWeek] : [];
      draftFilters.value = {
        ...activeFilters.value,
        category: [...activeFilters.value.category],
        range: {
          ...activeFilters.value.range,
          fulfillment: [...activeFilters.value.range.fulfillment],
          createdWeeks: [...activeFilters.value.range.createdWeeks],
          category: [...activeFilters.value.range.category],
          grade: [...activeFilters.value.range.grade],
        },
      };
      pagination.page = 1;
      loadCategories();
      loadProducts();
    })
    .catch((error) => {
      console.error("切换固定选品源站点最新批次失败:", error);
      ElMessage.error("切换站点失败");
    });
};

// 非标商品页只展示 deng_zong_shop，店铺登记和请求统一由店铺请求中心负责。
const openDengZongRequestCenter = () => {
  router.push({ name: 'module-shop-candidate-pool-ShopCandidatePool', query: { mode: 'deng-zong' } });
};

const handleAdd = () => {
  addDialogVisible.value = true;
};

const resetAddForm = () => {
  addForm.asin = "";
  addForm.productTitle = "";
  addForm.price = "";
  addForm.imageUrl = "";
  addForm.localPath = "";
  addForm.thumbPath = "";
  addForm.storeName = "";
  addForm.storeUrl = "";
  addForm.category = "";
  addForm.tags = [];
  addForm.notes = "";
  addForm.productLink = "";
  addForm.salesVolume = "";
  addForm.listingDate = "";
  addForm.listingDays = "";
  addForm.deliveryMethod = "";
  addForm.similarProducts = "";
  addForm.source = "";
  addForm.productType = "new";
};

const handleAddSubmit = async () => {
  if (!addFormRef.value) return;

  try {
    await addFormRef.value.validate();

    adding.value = true;
    try {
      const productData = {
        asin: addForm.asin.trim(),
        product_title: addForm.productTitle.trim(),
        price: addForm.price ? parseFloat(addForm.price) : null,
        image_url: addForm.imageUrl.trim() || null,
        local_path: addForm.localPath.trim() || null,
        thumb_path: addForm.thumbPath.trim() || null,
        store_name: addForm.storeName.trim() || null,
        store_url: addForm.storeUrl.trim() || null,
        category: addForm.category.trim() || null,
        tags: addForm.tags.length > 0 ? addForm.tags : null,
        notes: addForm.notes.trim() || null,
        product_link: addForm.productLink.trim() || null,
        sales_volume: addForm.salesVolume
          ? parseInt(addForm.salesVolume)
          : null,
        listing_date: addForm.listingDate ? addForm.listingDate : null,
        listing_days: addForm.listingDays
          ? parseInt(addForm.listingDays)
          : null,
        delivery_method: addForm.deliveryMethod.trim() || null,
        similar_products: addForm.similarProducts.trim() || null,
        source: addForm.source.trim() || null,
        product_type: addForm.productType,
      };

      await selectionApi.create(productData);
      ElMessage.success("添加选品成功");
      addDialogVisible.value = false;
      resetAddForm();
      loadProducts();
    } catch (error) {
      console.error("添加选品失败:", error);
      ElMessage.error("添加选品失败");
    } finally {
      adding.value = false;
    }
  } catch (error) {
    ElMessage.error("请检查表单填写是否正确");
  }
};

const handleAddCancel = () => {
  addDialogVisible.value = false;
  resetAddForm();
};

const handleSelect = (id, selected) => {
  if (selected) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value.push(id);
    }
  } else {
    const index = selectedIds.value.indexOf(id);
    if (index > -1) {
      selectedIds.value.splice(index, 1);
    }
  }
};

const toggleSelectionMode = () => {
  selectionMode.value = !selectionMode.value;
  if (!selectionMode.value) {
    selectedIds.value = [];
  }
};

const handleCardClick = (product) => {
  if (isManualLibrarySourceScene.value && selectionMode.value) {
    handleSelect(product.asin, !selectedIds.value.includes(product.asin));
    return;
  }
  selectedProduct.value = product;
  detailDialogVisible.value = true;
};

const handleSelectProduct = (variant) => {
  selectedProduct.value = {
    ...variant,
    productTitle: variant.title || "",
    storeName: variant.sellerName || "",
    productLink: variant.productUrl || "",
    salesVolume: variant.units ?? 0,
  };
};

const handleView = (product) => {
  selectedProduct.value = product;
  detailDialogVisible.value = true;
};

// ── 以图识图 ──
const imageSearchVisible = ref(false);
const imageSearchAsin = ref("");
const imageSearchImage = ref("");
const imageSearchPanelRef = ref<InstanceType<typeof ImageSearchPanel> | null>(
  null,
);

const handleImageSearch = (product: Record<string, any>) => {
  imageSearchAsin.value = product.asin || "";
  imageSearchImage.value = product.imageUrl || product.image || "";
  imageSearchVisible.value = true;
  // 弹窗打开后先查缓存（destroy-on-close 重建，等子组件挂载）
  nextTick(() => imageSearchPanelRef.value?.loadCache());
};

const handleDeleteProduct = async (product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选品 ${product.asin} 吗？`,
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await selectionApi.delete(product.id);
    ElMessage.success("删除成功");
    loadProducts();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

const handleDelete = async (product) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选品 ${product.asin} 吗？`,
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    await selectionApi.delete(product.id);
    ElMessage.success("删除成功");
    loadProducts();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("删除失败");
    }
  }
};

/** AI 选品：手动导入 ASIN */
const handleAiImport = async () => {
  const asins = aiImportParsed.value;
  if (asins.length === 0) {
    ElMessage.warning("请先输入 ASIN");
    return;
  }
  aiImportLoading.value = true;
  try {
    const { importAsins } = await import("@/api/ai-selection-pool");
    const resp = await importAsins({
      asins,
      marketplace: aiImportMarketplace.value || "UK",
      batchLabel: `手动导入 ${aiImportMarketplace.value || "UK"} ${new Date().toLocaleDateString("zh-CN")}`,
    });
    if (resp.invalidAsins && resp.invalidAsins.length > 0) {
      ElMessage.warning(`已忽略 ${resp.invalidAsins.length} 个未找到数据的 ASIN`);
    }
    if (resp.total > 0) {
      ElMessage.success(`成功导入 ${resp.total} 件商品`);
      aiImportDialogVisible.value = false;
      aiImportAsinInput.value = "";
      // 刷新列表
      pagination.page = 1;
      loadProducts();
      loadCategories();
    } else {
      ElMessage.info("未在这些 ASIN 的商品数据");
    }
  } catch (e) {
    ElMessage.error(`导入失败: ${e instanceof Error ? e.message : "未知错误"}`);
  } finally {
    aiImportLoading.value = false;
  }
};

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 个选品吗？`,
      "确认删除",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning",
      },
    );

    console.log("开始批量删除，ASIN列表:", selectedIds.value);
    const result = await selectionApi.batchDelete(selectedIds.value);
    console.log("批量删除结果:", result);
    ElMessage.success("批量删除成功");
    selectedIds.value = [];
    pagination.page = 1;
    await loadCategories();
    await loadProducts();
  } catch (error) {
    if (error !== "cancel") {
      console.error("批量删除失败:", error);
      ElMessage.error("批量删除失败");
    }
  }
};

const handleImport = () => {
  // 重置导入模式为默认值
  importMode.value = "skip";
  importFile.value = null;
  importDialogVisible.value = true;
};

const handleDownloadTemplate = async () => {
  try {
    const blob = await selectionApi.downloadTemplate();
    downloadFile(blob, "selection_import_template.xlsx");
    ElMessage.success("模板下载成功");
  } catch (error) {
    ElMessage.error("模板下载失败");
  }
};

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const handleFileChange = (file) => {
  importFile.value = file.raw;
};

const handleImageChange = (file: { raw?: File }) => {
  searchImageFile.value = file.raw;
  const reader = new FileReader();
  reader.onload = (e) => {
    searchImagePreview.value = e.target?.result as string;
  };
  reader.readAsDataURL(file.raw as File);
};

const handleExceed = () => {
  ElMessage.warning("只能上传一个文件");
};

const handleImportSubmit = async () => {
  if (!importFile.value) {
    ElMessage.warning("请选择要导入的Excel文件");
    return;
  }

  importing.value = true;
  try {
    console.log(
      "开始导入，文件:",
      importFile.value,
      "模式:",
      importMode.value,
      "类型:",
      activeImportType.value,
    );
    const response = await selectionApi.import(
      importFile.value,
      activeImportType.value,
      importMode.value,
    );
    console.log("导入响应:", response);

    const result =
      (
        response as {
          data?: {
            failed?: number;
            success?: number;
            message?: string;
            errors?: string[];
          };
        }
      ).data || {};

    if ((result.failed ?? 0) > 0) {
      if ((result.success ?? 0) === 0) {
        ElMessage.error(result.message || "导入失败");
      } else {
        ElMessage.warning(result.message || "导入完成，但有部分数据失败");
      }

      if (result.errors && result.errors.length > 0) {
        const errorDetails = result.errors
          .slice(0, 10)
          .map(
            (err: string) =>
              `<div style="margin-bottom: 8px; color: #f56c6c;">${err}</div>`,
          )
          .join("");
        ElMessageBox.alert(
          `<div style="max-height: 400px; overflow-y: auto;">${errorDetails}</div>`,
          "导入错误详情",
          {
            dangerouslyUseHTMLString: true,
            confirmButtonText: "确定",
            type: "error",
          },
        );
      }
    } else {
      ElMessage.success(result.message || "导入成功");
    }

    importDialogVisible.value = false;
    importFile.value = null;
    await loadCategories();
    await loadProducts();
  } catch (error) {
    console.error("导入失败:", error);
    ElMessage.error((error as Error)?.message || "导入失败");
  } finally {
    importing.value = false;
  }
};

const handleSearchByImage = () => {
  searchByImageDialogVisible.value = true;
};

const handleSearchByImageSubmit = async () => {
  if (!searchImageFile.value) {
    ElMessage.warning("请选择要搜索的图片");
    return;
  }

  searching.value = true;
  try {
    ElMessage.info("以图搜图功能开发中...");
  } catch (error) {
    ElMessage.error("搜索失败");
  } finally {
    searching.value = false;
  }
};

// 更多菜单命令
const handleMoreCommand = (command: string) => {
  if (command === "downloadTemplate") {
    handleDownloadTemplate();
  } else if (command === "recycleBin") {
    handleRecycleBin();
  }
};

const handleRecycleBin = () => {
  router.push("/selection-recycle-bin");
};

const handleSelectAll = async (command) => {
  if (command === "current") {
    const currentAsins = productList.value.map((p) => p.asin);
    selectedIds.value = [...new Set([...selectedIds.value, ...currentAsins])];
    ElMessage.success(`已选择当前页 ${currentAsins.length} 个商品`);
  } else if (command === "all") {
    try {
      if (isManualLibrarySourceScene.value && lastQueryPlan.value) {
        const total = pagination.total;
        if (total > 10_000) {
          ElMessage.warning("一次最多选择 10000 个商品，请先缩小筛选范围");
          return;
        }
        const size = 100;
        const pageCount = Math.ceil(total / size);
        const allAsins: string[] = [];
        for (let page = 1; page <= pageCount; page += 1) {
          const plan = {
            ...lastQueryPlan.value,
            params: { ...lastQueryPlan.value.params, page, size },
          } as SelectionQueryPlan;
          const response = await resolveSelectionQueryPlan(plan);
          response.result.list.forEach((product) => {
            if (product.asin) allAsins.push(product.asin);
          });
        }
        selectedIds.value = [...new Set(allAsins)];
        ElMessage.success(`已选择全部 ${selectedIds.value.length} 个商品`);
        return;
      }
      const response = await selectionApi.getAllAsins(activeProductType.value);
      selectedIds.value = response.data?.asins ?? [];
      ElMessage.success(`已选择全部 ${response.data?.total ?? 0} 个商品`);
    } catch (error) {
      ElMessage.error("获取全部商品失败");
    }
  } else if (command === "clear") {
    selectedIds.value = [];
    ElMessage.info("已清空选择");
  }
};

const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      "确定要清空所有选品数据吗？此操作不可恢复！",
      "警告",
      {
        confirmButtonText: "确定清空",
        cancelButtonText: "取消",
        type: "warning",
        dangerouslyUseHTMLString: true,
      },
    );

    await selectionApi.clearAll();
    ElMessage.success("清空数据成功");
    selectedIds.value = [];
    await loadCategories();
    loadProducts();
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error("清空数据失败");
    }
  }
};

const handleExportAllResultsCsv = async () => {
  if (pagination.total === 0) {
    ElMessage.warning("当前筛选没有可导出的商品");
    return;
  }

  exportingAllResults.value = true;
  try {
    const marketplace =
      activeFilters.value.country || productList.value[0]?.marketplace || "UK";
    const result = await downloadAllResultsCsv({
      plan: lastQueryPlan.value,
      total: pagination.total,
      marketplace,
    });
    ElMessage.success(`已导出全部 ${result.count} 条商品完整字段`);
  } catch (error: any) {
    console.error("导出全部筛选结果 CSV 失败:", error);
    ElMessage.error(error?.message || "导出全部 CSV 失败，请稍后重试");
  } finally {
    exportingAllResults.value = false;
  }
};

const handleExportSelectedXlsx = async () => {
  const source = lastQueryPlan.value?.targetSource;
  const supportedSources = new Set([
    "competitor_clean",
    "competitor_raw",
    "shop_products",
    "premium_products",
  ]);
  if (!source || !supportedSources.has(source)) {
    ElMessage.error("当前页面的数据源不支持 XLSX 导出");
    return;
  }

  exportingSelectedXlsx.value = true;
  try {
    const marketplace = String(
      activeFilters.value.country || productList.value[0]?.marketplace || "UK",
    ).toUpperCase();
    await exportXlsxViaTask(
      [...selectedIds.value],
      marketplace,
      source,
      `${getSectionTitle()}-${marketplace}-${selectedIds.value.length}条`,
    );
    try {
      await ElMessageBox.confirm(
        "XLSX 任务已创建，可前往下载中心查看进度并下载。",
        "导出任务已提交",
        {
          confirmButtonText: "前往下载中心",
          cancelButtonText: "留在当前页",
          type: "success",
        },
      );
      await router.push("/download-manager");
    } catch (action) {
      if (action !== "cancel" && action !== "close") throw action;
    }
  } catch (error: any) {
    console.error("创建 XLSX 导出任务失败:", error);
    ElMessage.error(error?.message || "创建 XLSX 导出任务失败，请稍后重试");
  } finally {
    exportingSelectedXlsx.value = false;
  }
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toDeveloperSelectionSnapshot = (
  product: Record<string, any>,
): DeveloperSelectionSnapshot => ({
  asin: String(product.asin || "").trim().toUpperCase(),
  marketplace: String(
    product.marketplace || product.country || activeFilters.value.country || "UK",
  ).toUpperCase(),
  originScene:
    route.path === "/premium-products"
      ? "PREMIUM_PRODUCTS"
      : route.path === "/reference-products"
      ? "REFERENCE_PRODUCTS"
      : route.path === "/ai-selection"
      ? "AI_SELECTION"
      : "NEW_PRODUCTS",
  originSource: product.source || currentSource.value || undefined,
  snapshotKey: String(product.snapshotKey || product.id || "") || undefined,
  title: product.productTitle || product.title || undefined,
  brand: product.brand || product.brandName || undefined,
  imageUrl:
    product.imageUrl || product.image || product.referenceImage || undefined,
  price: optionalNumber(product.price),
  units: optionalNumber(product.units ?? product.salesVolume),
  bsr: optionalNumber(product.bsr ?? product.mainCategoryBsr),
  ratings: optionalNumber(
    product.ratings ?? product.reviewCount ?? product.ratingsCount,
  ),
  rating: optionalNumber(product.rating ?? product.starRating),
  listingDays: optionalNumber(product.listingDays),
  weightG: optionalNumber(product.weightG ?? product.weight_g),
  sellerName: product.sellerName || product.storeName || undefined,
  nodeLabelPath:
    product.nodeLabelPath || product.node_label_path || product.category || undefined,
  productUrl: product.productUrl || product.productLink || undefined,
  snapshot: { ...product },
});

const resolveDeveloperLibraryName = (): string => {
  const userStore = useUserStore();
  if (userStore.isAdmin) return DEFAULT_ADMIN_LIBRARY_DEVELOPER_NAME;
  const user = userStore.userInfo;
  return (
    user?.realName ||
    user?.name ||
    user?.nickname ||
    user?.username ||
    "当前开发"
  );
};

const handleAddToDeveloperLibrary = async (
  bucket: DeveloperLibraryBucket,
) => {
  const selectedSet = new Set(selectedIds.value.map((value) => String(value)));
  const selectedProducts = productList.value.filter((product: any) =>
    selectedSet.has(String(product.asin)),
  );
  if (!selectedProducts.length) {
    ElMessage.warning("请先选择当前页面中的商品");
    return;
  }

  const developerName = resolveDeveloperLibraryName();

  libraryAddingBucket.value = bucket;
  try {
    const result = await developerSelectionLibraryApi.add({
      bucket,
      developerName,
      items: selectedProducts.map(toDeveloperSelectionSnapshot),
    });
    const libraryName = bucket === "GOOD" ? "选品库" : "差品库";
    const omitted = selectedIds.value.length - selectedProducts.length;
    ElMessage.success(
      `已加入${libraryName} ${result.total} 个${
        omitted > 0 ? `；另有 ${omitted} 个不在当前页，未加入` : ""
      }`,
    );
    selectedIds.value = [];
  } catch (error: any) {
    console.error("加入人工选品库失败:", error);
    ElMessage.error(error?.message || "加入人工选品库失败");
  } finally {
    libraryAddingBucket.value = null;
  }
};

const handleAddSingleToDeveloperLibrary = async (
  product: Record<string, any>,
  bucket: DeveloperLibraryBucket,
) => {
  if (!product?.asin) {
    ElMessage.warning("该商品缺少 ASIN，无法加入人工选品库");
    return;
  }

  const developerName = resolveDeveloperLibraryName();

  libraryAddingBucket.value = bucket;
  try {
    await developerSelectionLibraryApi.add({
      bucket,
      developerName,
      items: [toDeveloperSelectionSnapshot(product)],
    });
    ElMessage.success(
      bucket === "GOOD" ? "已加入选品库" : "已加入差品库",
    );
  } catch (error: any) {
    console.error("详情页加入人工选品库失败:", error);
    ElMessage.error(error?.message || "加入人工选品库失败");
  } finally {
    libraryAddingBucket.value = null;
  }
};

const setCardScale = (value: number) => {
  const scale = normalizeCardScale(value);
  if (cardScale.value === scale) return;
  cardScale.value = scale;
  try {
    window.localStorage.setItem(CARD_SCALE_STORAGE_KEY, String(scale));
  } catch {
    // 本地存储不可用时仍让当前会话的设置生效。
  }
};

const adjustCardScale = (delta: number) => {
  setCardScale(cardScale.value + delta);
};

const handleSizeChange = (size: number) => {
  pagination.size = size;
  pagination.page = 1;
  loadProducts();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadProducts();
  window.scrollTo(0, 0);
};

onMounted(async () => {
  // 初始化网格虚拟化：测量列数/视口，并监听容器尺寸变化。
  nextTick(() => {
    recomputeGridColumns();
    if (productsGridRef.value) {
      gridResizeObserver = new ResizeObserver(() => recomputeGridColumns());
      gridResizeObserver.observe(productsGridRef.value);
    }
  });

  // 根据当前路由初始化 tab 和默认筛选（route watch 不设 immediate，由这里处理首次加载）
  const pathTabMap: Record<string, string> = {
    "/zheng-products": "zheng",
    "/new-products": "new",
    "/reference-products": "reference",
    "/premium-products": "premium",
    "/ai-selection": "ai_selection",
    "/lingxing-shop-data": "lingxing_shop",
    "/brs-ranking": "brs",
    "/all-selection": "all",
  };
  const tab = pathTabMap[route.path] || "all";
  activeTab.value = tab;

  // AI 选品场景：预载非标载体列表，供顶部多选筛选下拉使用
  if (tab === "ai_selection") {
    loadCarriers();
  }

  // 自动应用方法卡的路由白名单 (只有以下两个入口自动绑 M01):
  //   /new-products       → M01 (新品榜加速法)
  //
  // 明确不自动应用 (进页面默认全量视图, 用户点方法卡才应用):
  //   /all-selection  → 全量选品视图, 不自动应用任何方法卡
  //   /zheng-products → 用户手动点 M02 才应用, 默认非标店铺全量
  //   /premium-products → premium_products 原始数据, 用户手动点 M01/M03 才筛选
  if (tab === "new" || tab === "reference") {
    activeMethodCard.value = { id: "M01", name: "新品榜加速法" };
  }

  // 读取路由 query 参数，预填搜索条件
  const initParams: Record<string, any> = {};
  if (activeTab.value === "new" || activeMethodCard.value?.id === "M01") {
    initParams.country = "UK";
  }
  if (route.query.storeName) {
    initParams.storeName = route.query.storeName as string;
  }
  if (route.query.marketplace) {
    initParams.country = route.query.marketplace as string;
  }
  // 同步主栏常驻站点（默认 UK，与新品榜数据口径一致）
  setCountry(initParams.country || "UK");
  initParams.country = activeFilters.value.country;
  applyQueryParams(initParams);
  // 精品与店铺首屏必须先锁定最新入库批次，再发出首个列表/分类查询，禁止空批次查全历史。
  if (isPremiumProductsScene.value || isShopProductsScene.value) {
    try {
      const latestWeek = await getLatestFixedSourceBatch(activeFilters.value.country || "UK");
      if (latestWeek) {
        activeFilters.value.range.createdWeeks = [latestWeek];
        draftFilters.value.range.createdWeeks = [latestWeek];
      }
    } catch (error) {
      console.error("加载固定选品源最新批次失败:", error);
      ElMessage.warning("最新批次加载失败，请稍后重试");
    }
  }
  // 加载大类榜单列表
  loadCategories();
  // 如果有路由 query 参数，触发搜索
  if (initParams.storeName) {
    handleSearch(queryParamsState.value);
  } else {
    loadProducts();
  }
  window.scrollTo(0, 0);

  startSelectionPolling();
});

const startSelectionPolling = () => {
  if (!selectionPollTimer) {
    selectionPollTimer = setInterval(refreshSelectionUsers, 5000);
  }
};

const stopSelectionPolling = () => {
  if (selectionPollTimer) {
    clearInterval(selectionPollTimer);
    selectionPollTimer = null;
  }
};

// KeepAlive 恢复页面时只恢复交互，不重新拉取列表数据。
onActivated(startSelectionPolling);
onDeactivated(stopSelectionPolling);

onUnmounted(() => {
  if (gridScrollHandle !== null) {
    cancelAnimationFrame(gridScrollHandle);
    gridScrollHandle = null;
  }
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
  stopSelectionPolling();
  // 清理校准定时器
  Object.values(calibrateTimers.value).forEach((t) => clearTimeout(t));
  calibrateTimers.value = {};
});
</script>

<style scoped lang="scss">
// 抽屉内分区（drawer append-to-body，需顶层选择器匹配 slotted 元素）
.fd-section {
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid #f0f2f5;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
  }

  .fd-label {
    font-weight: 600;
    font-size: 14px;
    color: #303133;
    margin-bottom: 10px;
  }

  .fd-sort-row {
    display: flex;
    align-items: center;
  }
}

.method-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
  border: 1px solid #d8e8df;
  border-radius: 12px;
  background: linear-gradient(135deg, #f3fbf5 0%, #eef7ff 100%);

  &__body {
    min-width: 0;
  }

  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  &__name {
    font-size: 15px;
    font-weight: 700;
    color: #1f2f25;
  }

  &__desc {
    margin-top: 6px;
    color: #52645a;
    line-height: 1.6;
    font-size: 13px;
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    color: #3b8060;
    font-size: 12px;
  }

  &__actions {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 8px;
    flex-direction: column;
    flex-shrink: 0;
  }
}

.all-selection {
  padding: 20px;
  height: 100%;
  box-sizing: border-box;

  // 统一筛选入口栏
  .unified-filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #ebeef5;
    border-radius: 8px;

    .ufb-field {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #606266;

      .ufb-field-label {
        white-space: nowrap;
      }
    }

    .filter-count-badge {
      margin-left: 2px;
    }

    .filter-chips {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
  }

  .selection-layout {
    height: 100%;

    .content {
      width: 100%;
      height: 100%;

      .section-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid #ebeef5;

        h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #303133;
        }

        .product-count {
          font-size: 14px;
          color: #909399;
        }
      }
    }
  }

  .main-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
  }

  .search-form {
    margin-bottom: 20px;
    padding: 0;

    :deep(.el-form-item) {
      margin-bottom: 16px;
      margin-right: 16px;
    }
  }

  .products-grid {
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(var(--selection-card-min-width, 280px), 1fr)
    );
    gap: var(--selection-card-gap, 16px);
    margin-bottom: 0;
    min-height: 400px;
    flex: 1;
    align-items: start;
    overflow-y: auto;
    max-height: calc(100% - 130px);
    padding-bottom: 50px;
  }

  .product-card-scale-wrapper {
    position: relative;
    min-width: 0;
    // 固定高度（缩放后 fallback 高）：选品卡片结构统一，等高完全可接受。
    // 放弃逐卡精确测高——原先 ResizeObserver 测高在滚动时 200 张卡回调风暴致卡死；
    // zoom 方案则触发 Chrome 对 zoom 元素的滚动重绘性能问题（实测滚动 JS 忙 37s）。
    // 用固定高度 + transform:scale，零 JS 测量、零 zoom，滚动走浏览器原生（实测 JS 忙 28ms）。
    height: var(--selection-card-fallback-height, 560px);
    overflow: hidden;
  }

  .product-card-scale-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% / var(--selection-card-scale, 1));
    transform: scale(var(--selection-card-scale, 1));
    transform-origin: top left;
  }

  .card-display-settings {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 12px;
    padding: 10px 14px;
    background: linear-gradient(90deg, #f0f9ff 0%, #f8fbff 100%);
    border: 1px solid #d9ecff;
    border-radius: 8px;

    &__copy {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    &__title {
      font-size: 14px;
      font-weight: 600;
      color: #303133;
    }

    &__hint {
      font-size: 12px;
      color: #909399;
    }

    &__controls {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    &__count {
      min-width: 64px;
      color: #303133;
      font-size: 14px;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      max-width: 100%;

      .el-button {
        margin-left: 0;
      }
    }
  }

  .el-pagination {
    display: flex;
    justify-content: center;
    margin: 0;
    padding: 8px 0;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1px solid #e4e7ed;
    z-index: 10;
  }

  .image-preview {
    margin-top: 20px;
    text-align: center;

    .el-image {
      max-width: 100%;
      max-height: 300px;
    }
  }

  // 导入对话框样式
  .import-dialog-content {
    .import-alert {
      margin-bottom: 20px;

      .import-columns {
        margin: 10px 0;
        padding-left: 20px;

        li {
          margin-bottom: 4px;
        }
      }

      .import-tip {
        margin-top: 10px;
        color: #409eff;
      }
    }

    .import-mode-wrapper {
      margin-bottom: 20px;
      padding: 16px;
      background-color: #f5f7fa;
      border-radius: 4px;

      .import-mode-title {
        font-weight: 500;
        margin-bottom: 8px;
        color: #606266;
      }

      .import-mode-select {
        width: 100%;
      }

      .import-mode-hint {
        margin-top: 8px;
        font-size: 12px;
        color: #909399;
      }
    }

    .import-upload {
      .el-upload-dragger {
        width: 100%;
      }
    }
  }

  // 卖家管理弹窗样式
  .seller-dialog-content {
    .seller-toolbar {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
  }
}

@media (max-width: 1200px) {
  .all-selection {
    .selection-layout {
      .content {
        width: 100%;
      }
    }
  }
}

// ========== 暗黑模式适配 ==========
:deep(html.dark) {
  .products-grid {
    background: var(--el-bg-color);
  }
  .page-header {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
  }
  .table-container {
    background: var(--el-bg-color);
  }
  .filter-section {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
  }
  .section-title {
    color: var(--el-text-color-primary);
    border-bottom-color: var(--el-border-color);

    h3 {
      color: var(--el-text-color-primary);
    }
    .product-count {
      color: var(--el-text-color-secondary);
    }
  }
  .empty-state {
    color: var(--el-text-color-secondary);
  }
  .el-pagination {
    background: var(--el-bg-color);
    border-color: var(--el-border-color);
  }
}
</style>
