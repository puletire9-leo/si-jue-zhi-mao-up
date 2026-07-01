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
                <el-button type="primary" :icon="Plus" @click="handleAdd">
                  添加选品
                </el-button>
                <el-button type="success" :icon="Upload" @click="handleImport">
                  导入Excel
                </el-button>
                <el-button
                  type="warning"
                  :icon="Star"
                  :loading="scoringCurrentWeek"
                  @click="handleScoreCurrentWeek"
                >
                  一键计算评级
                </el-button>

                <!-- 选中后出现的批量操作 -->
                <template v-if="selectedIds.length > 0">
                  <el-button
                    type="danger"
                    :icon="Delete"
                    @click="handleBatchDelete"
                  >
                    批量删除 ({{ selectedIds.length }})
                  </el-button>
                  <el-button
                    type="success"
                    :icon="Download"
                    :loading="exporting"
                    @click="handleExportAsins"
                  >
                    导出选中ASIN ({{ selectedIds.length }})
                  </el-button>
                </template>

                <!-- 全选（带下拉） -->
                <el-dropdown @command="handleSelectAll">
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
                  @click="openSellerDialog"
                >
                  查看店铺
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
          />

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
            <label class="ufb-field">
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

          <!-- 评分配置面板 -->
          <ScoringConfigPanel v-if="activeTab === 'all'" />

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
              v-if="activeTab !== 'zheng'"
              placement="top"
              content="开启后只显示父群组代表行（去变体污染）；关闭后展示原始所有变体"
            >
              <span class="filter-label" style="margin-left: 16px">
                清洗数据
              </span>
            </el-tooltip>
            <el-switch
              v-if="activeTab !== 'zheng'"
              v-model="useCleanTable"
              size="small"
              @change="onUseCleanTableChange"
            />
          </div>

          <template v-if="loading && !hasLoaded">
            <SkeletonWrapper variant="card-grid" :count="12" />
          </template>
          <div v-else v-loading="refreshing" class="products-grid">
            <UniversalCard
              v-for="product in sortedProductList"
              :key="product.id"
              :product="product"
              :selected="selectedIds.includes(product.asin)"
              :is-selected-by-me="mySelections.has(product.asin)"
              :selected-by-users="selectionUsersMap[product.asin] || []"
              mode="selection"
              @click="handleCardClick"
              @select="handleSelect"
              @toggle-select="handleToggleSelect"
              @view="handleView"
              @delete="handleDelete"
              @image-search="handleImageSearch"
            />

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
            :page-sizes="[60, 100, 200, 500]"
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
            <div class="method-card method-card--m01">
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
                  clean 表去变体污染后，按价格带、重量、上架天数、销量分段或 BSR
                  代理筛出新品候选。
                </div>
                <div class="method-card__meta">
                  <span>适合：新品榜快筛</span>
                  <span>站点：UK / DE</span>
                  <span>输出：候选 + 命中原因</span>
                </div>
              </div>
              <div class="method-card__actions">
                <el-button
                  type="primary"
                  size="small"
                  :loading="loading && activeMethodCard?.id === 'M01'"
                  @click="applyM01Method"
                >
                  应用方法
                </el-button>
                <el-button size="small" link @click="openMethodDetail('M01')">
                  了解详情
                </el-button>
                <el-button
                  v-if="activeMethodCard"
                  size="small"
                  link
                  @click="clearMethodCard"
                >
                  退出方法
                </el-button>
              </div>
            </div>

            <div class="method-card method-card--m02">
              <div class="method-card__body">
                <div class="method-card__head">
                  <div class="method-card__name">M02 郑总同行品线跟随法</div>
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
                  用郑总同行店铺最新批次作为基准盘子，筛选同行已经验证过的候选商品。
                </div>
                <div class="method-card__meta">
                  <span>适合：同行跟随 / 选品优先级</span>
                  <span>数据源：deng_zong_shop</span>
                  <span>输出：候选 + 命中原因</span>
                </div>
              </div>
              <div class="method-card__actions">
                <el-button
                  type="primary"
                  size="small"
                  :loading="loading && activeMethodCard?.id === 'M02'"
                  @click="applyM02Method"
                >
                  应用方法
                </el-button>
                <el-button size="small" link @click="openMethodDetail('M02')">
                  了解详情
                </el-button>
                <el-button
                  v-if="activeMethodCard"
                  size="small"
                  link
                  @click="clearMethodCard"
                >
                  退出方法
                </el-button>
              </div>
            </div>
          </div>

          <!-- 方法卡详情抽屉 -->
          <el-drawer
            v-model="methodDetailVisible"
            :title="methodDetail?.title || '方法卡详情'"
            direction="rtl"
            size="520px"
            append-to-body
          >
            <div v-if="methodDetail" class="method-detail">
              <p class="method-detail__tagline">{{ methodDetail.tagline }}</p>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><CircleCheck /></el-icon> 何时用
                </div>
                <ul>
                  <li v-for="item in methodDetail.whenToUse" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><CircleClose /></el-icon> 何时不用
                </div>
                <ul>
                  <li v-for="item in methodDetail.whenNotToUse" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><Warning /></el-icon> 硬门槛 (一票否决)
                </div>
                <div class="method-detail__criteria">
                  <div
                    v-for="c in methodDetail.hardCriteria"
                    :key="c.label"
                    class="criterion"
                  >
                    <span class="criterion__label">{{ c.label }}</span>
                    <span class="criterion__value">{{ c.value }}</span>
                    <span v-if="c.note" class="criterion__note">
                      {{ c.note }}
                    </span>
                  </div>
                </div>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><Aim /></el-icon> 达标逻辑
                </div>
                <ul>
                  <li v-for="item in methodDetail.passLogic" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><Lock /></el-icon> 强制固定字段
                </div>
                <div class="method-detail__tags">
                  <el-tag
                    v-for="f in methodDetail.forcedFilters"
                    :key="f"
                    type="info"
                    size="small"
                  >
                    {{ f }}
                  </el-tag>
                </div>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><Close /></el-icon> 不支持的筛选
                </div>
                <ul>
                  <li
                    v-for="f in methodDetail.unsupportedFilters"
                    :key="f"
                    class="method-detail__unsupported"
                  >
                    {{ f }}
                  </li>
                </ul>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><DataBoard /></el-icon> 数据源
                </div>
                <p class="method-detail__text">{{ methodDetail.dataSource }}</p>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><Files /></el-icon> 输出
                </div>
                <p class="method-detail__text">{{ methodDetail.output }}</p>
              </div>

              <div class="method-detail__section">
                <div class="method-detail__label">
                  <el-icon><InfoFilled /></el-icon> 依据 / 为什么这样筛
                </div>
                <ul>
                  <li v-for="item in methodDetail.rationale" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>

              <div
                v-if="methodDetail.fullDocPath"
                class="method-detail__footer"
              >
                完整方法卡文档：
                <code>{{ methodDetail.fullDocPath }}</code>
              </div>
            </div>
          </el-drawer>

          <!-- 卖家 -->
          <div class="fd-section">
            <div class="fd-label">卖家</div>
            <el-select
              v-model="draftFilters.sellerSelect"
              placeholder="全部卖家"
              clearable
              filterable
              style="width: 100%"
              :loading="drawerSellerLoading"
            >
              <el-option
                v-for="seller in drawerSellerOptions"
                :key="seller.id"
                :label="seller.sellerName"
                :value="seller.sellerName"
              />
            </el-select>
          </div>

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
                <el-option label="评分" value="score" />
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
              embedded
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
          data-source="selection"
          :show-edit-button="false"
          :show-delete-button="true"
          @delete="handleDeleteProduct"
          @select-product="handleSelectProduct"
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

        <!-- 卖家管理对话框 -->
        <el-dialog
          v-model="sellerDialogVisible"
          title="邓总店铺卖家管理"
          width="800px"
          destroy-on-close
        >
          <div class="seller-dialog-content">
            <div class="seller-toolbar">
              <el-select
                v-model="sellerFilterMarketplace"
                placeholder="按站点筛选"
                clearable
                style="width: 150px"
                @change="loadSellerList"
              >
                <el-option label="UK" value="UK" />
                <el-option label="DE" value="DE" />
              </el-select>
              <el-button type="primary" :icon="Plus" @click="handleAddSeller"
                >新增卖家</el-button
              >
            </div>
            <el-table
              :data="sellerList"
              border
              stripe
              style="width: 100%"
              max-height="500"
            >
              <el-table-column prop="marketplace" label="站点" width="80" />
              <el-table-column
                prop="sellerName"
                label="卖家名称"
                min-width="200"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <el-input
                    v-if="row._editing"
                    v-model="row.sellerName"
                    size="small"
                    @keyup.enter="handleSaveSeller(row)"
                  />
                  <span v-else>{{ row.sellerName }}</span>
                </template>
              </el-table-column>
              <el-table-column label="店铺链接" min-width="100">
                <template #default="{ row }">
                  <el-link
                    v-if="row.storeUrl"
                    :href="row.storeUrl"
                    target="_blank"
                    type="primary"
                  >
                    打开
                  </el-link>
                  <span v-else style="color: #909399">无</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="260" fixed="right">
                <template #default="{ row }">
                  <template v-if="row._editing">
                    <el-button
                      type="success"
                      size="small"
                      @click="handleSaveSeller(row)"
                      >保存</el-button
                    >
                    <el-button size="small" @click="row._editing = false"
                      >取消</el-button
                    >
                  </template>
                  <template v-else>
                    <el-button
                      type="primary"
                      size="small"
                      @click="row._editing = true"
                      >编辑</el-button
                    >
                    <el-button
                      type="warning"
                      size="small"
                      :loading="row._syncing"
                      @click="handleSyncSeller(row)"
                      >同步数据</el-button
                    >
                    <el-button
                      type="danger"
                      size="small"
                      @click="handleDeleteSeller(row)"
                      >删除</el-button
                    >
                  </template>
                </template>
              </el-table-column>
            </el-table>
          </div>
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
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "AllSelection" });
import {
  ref,
  reactive,
  onMounted,
  onUnmounted,
  computed,
  watch,
  nextTick,
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
  TrendCharts,
  Shop,
  Star,
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
import ScoringConfigPanel from "./ScoringConfigPanel.vue";
import FilterPresetSelector from "@/components/FilterPresetSelector/index.vue";
import QualifyRuleFilter from "@/components/QualifyRuleFilter/index.vue";
import RangeFilterPanel from "@/components/RangeFilterPanel/index.vue";
import FilterDrawer from "@/components/FilterDrawer/index.vue";
import { selectionApi } from "@/api/selection";
import { competitorApi } from "@/api/competitor";
import type { QualifyRule } from "@/api/competitor";
import {
  buildSelectionFilterIntent,
  buildSelectionQueryPlan,
  type SelectionFilterState as QueryPlanFilterState,
  type SelectionQueryPlan,
} from "./composables/queryPlan";
import { resolveSelectionQueryPlan } from "./composables/queryRuntime";
import { useSelectionFilterState } from "./composables/filterState";
import { METHOD_CARD_INFO } from "./composables/methodCardInfo";
import {
  fetchMySelections,
  fetchSelectionUsers,
  trackClick,
} from "@/api/clickLog";
import { useUserStore } from "@/stores/user";

const router = useRouter();
const route = useRoute();
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

// 新品榜合格规则（取代写死的 MODE1）。默认：上架≤30天 且 月销>30。
const NEW_TAB_DEFAULT_RULES: QualifyRule[] = [
  {
    conditions: [
      { field: "listingDays", op: "le", value: 30 },
      { field: "units", op: "gt", value: 30 },
    ],
  },
];
const newQualifyRules = ref<QualifyRule[]>([...NEW_TAB_DEFAULT_RULES]);
const activeMethodCard = ref<{ id: "M01" | "M02"; name: string } | null>(null);

// 方法卡详情抽屉状态
const methodDetailVisible = ref(false);
const methodDetailId = ref<"M01" | "M02" | null>(null);
const methodDetail = computed(() =>
  methodDetailId.value ? METHOD_CARD_INFO[methodDetailId.value] : null,
);

const openMethodDetail = (id: "M01" | "M02") => {
  methodDetailId.value = id;
  methodDetailVisible.value = true;
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
  const titles = {
    all: "全部选品",
    new: "新品榜",
    reference: "竞品店铺",
    zheng: "郑总店铺上新",
  };
  return titles[activeTab.value as keyof typeof titles] || "选品管理";
};

const productList = ref([]);
const selectedIds = ref([]);
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
    reference: "竞品店铺",
    zheng: "郑总店铺",
    all: "",
  };
  return m[effectiveScene.value] || "";
});
const effectiveScene = computed(() => {
  if (activeMethodCard.value?.id === "M01") return "new";
  if (activeMethodCard.value?.id === "M02") return "zheng";
  if (
    activeTab.value === "all" ||
    activeTab.value === "new" ||
    activeTab.value === "reference" ||
    activeTab.value === "zheng"
  ) {
    return activeTab.value;
  }
  return "all";
});
const currentSnapshotKind = computed<
  "competitor_created_week" | "deng_zong_batch"
>(() =>
  effectiveScene.value === "zheng"
    ? "deng_zong_batch"
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
const exporting = ref(false);

/** 首屏是否已完成首次加载（用于骨架屏/loading切换） */
const hasLoaded = ref(false);
const refreshing = computed(() => loading.value && hasLoaded.value);

// 卖家管理弹窗
const sellerDialogVisible = ref(false);
const sellerList = ref<any[]>([]);
const sellerFilterMarketplace = ref("");
const adding = ref(false);
const scoringCurrentWeek = ref(false);
const uploadRef = ref(null);
const imageUploadRef = ref(null);
const importFile = ref(null);
const importMode = ref("skip"); // 导入模式：skip(跳过)/update(更新)/overwrite(覆盖)
const searchImageFile = ref(null);
const searchImagePreview = ref("");
const categories = ref([]);

// ===== 统一筛选状态：activeFilters(已生效) + draftFilters(抽屉草稿) =====
type FilterState = QueryPlanFilterState;
const drawerSellerOptions = ref<
  { id: number; marketplace: string; sellerName: string; storeUrl: string }[]
>([]);
const drawerSellerLoading = ref(false);

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

const pagination = reactive({
  page: 1,
  size: 60,
  total: 0,
});

const loadCategories = async () => {
  // 根据当前标签页获取分类来源
  const sourceMap: Record<string, string> = {
    new: "新品榜",
    reference: "竞品",
    zheng: "郑总店铺",
    all: "",
  };
  const source = sourceMap[effectiveScene.value] || "";

  try {
    const response = await selectionApi.getCategories(source || undefined);
    categories.value = response.data || [];
    console.log("加载分类列表成功:", categories.value, "来源:", source);
  } catch (error) {
    console.error("加载分类列表失败:", error);
  }
};

const lastQueryPlan = ref<SelectionQueryPlan | null>(null);

const loadProducts = async (params?: SelectionQueryParams) => {
  loading.value = true;
  try {
    const queryParams = params || queryParamsState.value;
    const intent = buildSelectionFilterIntent({
      scene: effectiveScene.value as "all" | "new" | "reference" | "zheng",
      methodId: activeMethodCard.value?.id ?? null,
      queryParams,
      activeFilters: activeFilters.value,
      useCleanTable: useCleanTable.value,
      qualifyRules: newQualifyRules.value,
    });
    const plan = buildSelectionQueryPlan({
      intent,
      page: pagination.page,
      size: pagination.size,
    });
    const resolved = await resolveSelectionQueryPlan(plan);
    lastQueryPlan.value = resolved.plan;

    console.log("[selection-query-plan]", {
      executor: resolved.plan.executor,
      scene: effectiveScene.value,
      methodId: resolved.plan.methodId,
      forcedFilters: resolved.plan.forcedFilters,
      unsupportedFilters: resolved.plan.unsupportedFilters,
      params: resolved.plan.params,
    });

    productList.value = resolved.result.list;
    pagination.total = resolved.result.total;
    await loadSelections();
  } catch (error) {
    console.error("加载选品列表失败:", error);
    ElMessage.error("加载选品列表失败");
  } finally {
    loading.value = false;
    hasLoaded.value = true;
  }
};

const normalizeM01Marketplace = (value?: string): "UK" | "DE" => {
  return value === "DE" ? "DE" : "UK";
};

const applyM01Method = () => {
  activeMethodCard.value = { id: "M01", name: "新品榜加速法" };
  activeTab.value = "new";
  activeFilters.value.country = normalizeM01Marketplace(
    activeFilters.value.country,
  );
  filterDrawerVisible.value = false;
  pagination.page = 1;
  loadCategories();
  loadProducts();
};

const applyM02Method = () => {
  activeMethodCard.value = { id: "M02", name: "郑总同行品线跟随法" };
  activeFilters.value.country = normalizeM01Marketplace(
    activeFilters.value.country,
  );
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
            { zheng: "郑总店铺", new: "新品榜", reference: "竞品" } as Record<
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

// 根据路由自动设置产品类型
// 注：不设 immediate，首次加载由 onMounted 处理（此时 queryFormRef 可用）
watch(
  () => route.path,
  (newPath) => {
    const pathMap: Record<
      string,
      { tab: string; productType: "" | "new" | "reference" | "zheng" }
    > = {
      "/zheng-products": { tab: "zheng", productType: "zheng" },
      "/new-products": { tab: "new", productType: "new" },
      "/reference-products": { tab: "reference", productType: "reference" },
      "/all-selection": { tab: "all", productType: "" },
    };

    const config = pathMap[newPath];
    if (config) {
      activeTab.value = config.tab;
      const defaults = config.tab === "new" ? { country: "UK" } : {};
      applyQueryParams({
        productType: config.productType,
        ...defaults,
      });
      loadCategories();
    }

    pagination.page = 1;
    loadProducts();
  },
);

const onQueryFormChange = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
};

const handleSearch = (params: SelectionQueryParams) => {
  queryParamsState.value = { ...params };
  pagination.page = 1;
  loadProducts(params);
};

const loadDrawerSellers = async (marketplace?: string) => {
  drawerSellerLoading.value = true;
  try {
    const res = await competitorApi.getDengZongShopSellers(
      marketplace ? { marketplace } : undefined,
    );
    drawerSellerOptions.value = res.data || [];
  } catch {
    drawerSellerOptions.value = [];
  } finally {
    drawerSellerLoading.value = false;
  }
};

const triggerFilterQuery = () => {
  pagination.page = 1;
  loadProducts();
};

const {
  activeFilters,
  draftFilters,
  filterDrawerVisible,
  activeFilterChips,
  handleReset,
  onBarCountryChange,
  onBarCategoryChange,
  openFilterDrawer,
  handleDrawerConfirm,
  handleDrawerReset,
  removeChip,
  clearAllFilters,
  getCurrentFilterConfig,
  handlePresetApply,
  setCountry,
} = useSelectionFilterState({
  activeMethodCard,
  getQualifyRules: () => [...newQualifyRules.value],
  setQualifyRules: (rules) => {
    newQualifyRules.value = Array.isArray(rules)
      ? (rules as QualifyRule[])
      : [...NEW_TAB_DEFAULT_RULES];
  },
  applyQuery: triggerFilterQuery,
  syncMarketplaceScope: (marketplace) => {
    loadDrawerSellers(marketplace);
    loadCategories();
  },
  normalizeMethodMarketplace: normalizeM01Marketplace,
  patchQueryParams: (config) => {
    applyQueryParams(config);
  },
  initialCountry: "UK",
});

// ========== 卖家管理 ==========
const openSellerDialog = () => {
  sellerDialogVisible.value = true;
  loadSellerList();
};

const loadSellerList = async () => {
  try {
    const params = sellerFilterMarketplace.value
      ? { marketplace: sellerFilterMarketplace.value }
      : undefined;
    const res = await competitorApi.getDengZongShopSellers(params);
    sellerList.value = (res.data || []).map((s: any) => ({
      ...s,
      _editing: false,
    }));
  } catch {
    sellerList.value = [];
  }
};

const handleAddSeller = async () => {
  try {
    const { value } = await ElMessageBox.prompt("请输入卖家名称", "新增卖家", {
      inputPlaceholder: "卖家名称",
      inputValidator: (v) => !!v?.trim() || "卖家名称不能为空",
    });
    const marketplace = sellerFilterMarketplace.value || "UK";
    await competitorApi.createDengZongShopSeller({
      sellerName: value.trim(),
      marketplace,
    });
    ElMessage.success("新增成功");
    loadSellerList();
  } catch {}
};

const handleSaveSeller = async (row: any) => {
  if (!row.sellerName?.trim()) {
    ElMessage.warning("卖家名称不能为空");
    return;
  }
  try {
    await competitorApi.updateDengZongShopSeller(row.id, {
      sellerName: row.sellerName,
      marketplace: row.marketplace,
      storeUrl: row.storeUrl,
      notes: row.notes,
    });
    row._editing = false;
    ElMessage.success("保存成功");
  } catch {
    ElMessage.error("保存失败");
  }
};

const handleDeleteSeller = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定删除卖家「${row.sellerName}」？`, "提示", {
      type: "warning",
    });
    await competitorApi.deleteDengZongShopSeller(row.id);
    ElMessage.success("删除成功");
    loadSellerList();
  } catch {}
};

const handleSyncSeller = async (row: any) => {
  row._syncing = true;
  try {
    const res = await competitorApi.syncDengZongShop({
      sellerName: row.sellerName,
      marketplace: row.marketplace,
    });
    const data = res.data;
    ElMessage.success(
      `同步完成：共 ${data.total} 条，入库 ${data.inserted} 条`,
    );
    // 同步后刷新产品列表
    loadProducts();
  } catch (e: any) {
    ElMessage.error("同步失败：" + (e.message || "未知错误"));
  } finally {
    row._syncing = false;
  }
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
    selectedIds.value.push(id);
  } else {
    const index = selectedIds.value.indexOf(id);
    if (index > -1) {
      selectedIds.value.splice(index, 1);
    }
  }
};

const handleCardClick = (product) => {
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

const handleExportAsins = async () => {
  if (selectedIds.value.length === 0) {
    ElMessage.warning("请先选择要导出的商品");
    return;
  }

  try {
    exporting.value = true;

    // 显示导出进度提示
    const loadingMessage = ElMessage({
      message: `正在导出 ${selectedIds.value.length} 个商品的ASIN...`,
      type: "info",
      duration: 0,
      showClose: false,
    });

    try {
      // 调用导出API
      const blob = await selectionApi.exportSelectedAsins(selectedIds.value);

      // 关闭加载提示
      loadingMessage.close();

      // 生成文件名（包含时间戳）
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5);
      const filename = `selected_asins_${timestamp}.txt`;

      // 下载文件
      downloadFile(blob, filename);

      // 显示成功提示
      ElMessage.success(`成功导出 ${selectedIds.value.length} 个商品的ASIN`);

      console.log("导出ASIN成功:", {
        count: selectedIds.value.length,
        filename: filename,
      });
    } catch (apiError) {
      // 关闭加载提示
      loadingMessage.close();
      throw apiError;
    }
  } catch (error) {
    console.error("导出ASIN失败:", error);

    // 检查是否是网络错误
    if (
      error?.message?.includes("Network Error") ||
      error?.message?.includes("网络")
    ) {
      ElMessageBox.confirm("网络异常，导出失败。是否重试？", "导出失败", {
        confirmButtonText: "重试",
        cancelButtonText: "取消",
        type: "error",
      })
        .then(() => {
          // 用户选择重试
          handleExportAsins();
        })
        .catch(() => {
          // 用户取消
          ElMessage.info("已取消导出");
        });
    } else {
      // 其他错误
      ElMessage.error(error?.message || "导出ASIN失败，请稍后重试");
    }
  } finally {
    exporting.value = false;
  }
};

const handleScoreCurrentWeek = async () => {
  scoringCurrentWeek.value = true;
  try {
    const res = await selectionApi.scoreCurrentWeek();
    if (res.code === 200 && res.data) {
      ElMessage.success(`评级完成，共评 ${res.data.totalScored} 个商品`);
      loadProducts();
    } else {
      ElMessage.error(res.message || "评级失败");
    }
  } catch (e) {
    ElMessage.error("一键计算评级失败");
  } finally {
    scoringCurrentWeek.value = false;
  }
};

const handleSizeChange = (size) => {
  pagination.size = size;
  pagination.page = 1;
  loadProducts();
};

const handlePageChange = (page) => {
  pagination.page = page;
  loadProducts();
  window.scrollTo(0, 0);
};

onMounted(() => {
  // 根据当前路由初始化 tab 和默认筛选（route watch 不设 immediate，由这里处理首次加载）
  const pathTabMap: Record<string, string> = {
    "/zheng-products": "zheng",
    "/new-products": "new",
    "/reference-products": "reference",
    "/all-selection": "all",
  };
  const tab = pathTabMap[route.path] || "all";
  activeTab.value = tab;

  // 默认应用 M01 新品榜加速法(用户想上来直接看新品筛选结果);
  // 只在通用路径(all)启用, 专用路径(zheng/new/reference)保持原意图;
  // M01 强制 tab=new + country 归一为 UK/DE, 用户可点"退出方法"回全量
  if (tab === "all") {
    activeMethodCard.value = { id: "M01", name: "新品榜加速法" };
    activeTab.value = "new";
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
  // 加载大类榜单列表
  loadCategories();
  // 如果有路由 query 参数，触发搜索
  if (initParams.storeName) {
    handleSearch(queryParamsState.value);
  } else {
    loadProducts();
  }
  window.scrollTo(0, 0);

  // 启动选中用户实时轮询（5 秒间隔）
  selectionPollTimer = setInterval(refreshSelectionUsers, 5000);
});

onUnmounted(() => {
  if (selectionPollTimer) {
    clearInterval(selectionPollTimer);
    selectionPollTimer = null;
  }
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
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 0;
    min-height: 400px;
    flex: 1;
    overflow-y: auto;
    max-height: calc(100% - 130px);
    padding-bottom: 50px;
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

// 方法卡详情抽屉
.method-detail {
  padding: 4px 6px 24px;

  &__tagline {
    margin: 0 0 20px;
    padding: 12px 14px;
    background: var(--el-color-primary-light-9);
    border-left: 3px solid var(--el-color-primary);
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
  }

  &__section {
    margin-bottom: 20px;
  }

  &__label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-weight: 600;
    font-size: 13px;
    color: var(--el-text-color-primary);

    .el-icon {
      color: var(--el-color-primary);
      font-size: 15px;
    }
  }

  &__text {
    margin: 0;
    padding-left: 22px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--el-text-color-regular);
  }

  ul {
    margin: 0;
    padding-left: 22px;

    li {
      margin-bottom: 6px;
      font-size: 13px;
      line-height: 1.6;
      color: var(--el-text-color-regular);
    }
  }

  &__unsupported {
    color: var(--el-text-color-secondary) !important;
    text-decoration: line-through;
  }

  &__criteria {
    padding-left: 22px;

    .criterion {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 13px;

      &__label {
        min-width: 72px;
        color: var(--el-text-color-secondary);
      }

      &__value {
        font-weight: 600;
        color: var(--el-color-danger);
      }

      &__note {
        color: var(--el-text-color-secondary);
        font-size: 12px;
      }
    }
  }

  &__tags {
    padding-left: 22px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__footer {
    margin-top: 24px;
    padding: 10px 14px;
    background: var(--el-fill-color-lighter);
    border-radius: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);

    code {
      padding: 2px 6px;
      background: var(--el-fill-color);
      border-radius: 3px;
      font-family: monospace;
      color: var(--el-text-color-regular);
    }
  }
}
</style>
