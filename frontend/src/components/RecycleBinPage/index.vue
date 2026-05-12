<template>
  <div :class="recycleType + '-recycle-bin'">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ config.title }}</span>
          <div>
            <el-button type="primary" :icon="Refresh" @click="loadData" :loading="loading">
              刷新
            </el-button>
            <el-button type="info" :icon="Select" @click="toggleSelectAll">
              {{ isAllSelected ? '取消全选' : '全选' }}
            </el-button>
            <el-button type="danger" :icon="Delete" @click="handleClearAll" :disabled="!tableData.length">
              清空回收站
            </el-button>
          </div>
        </div>
      </template>

      <!-- 搜索表单 -->
      <el-form :model="queryParams" :inline="true" class="search-form">
        <!-- 选品 -->
        <template v-if="recycleType === 'selection'">
          <el-form-item label="产品ASIN">
            <el-input v-model="queryParams.asin" placeholder="请输入产品ASIN" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="商品标题">
            <el-input v-model="queryParams.productTitle" placeholder="请输入商品标题" clearable style="width: 200px" />
          </el-form-item>
          <el-form-item label="产品类型">
            <el-select v-model="queryParams.productType" placeholder="请选择产品类型" clearable style="width: 120px">
              <el-option label="新品榜" value="new" />
              <el-option label="竞品店铺" value="reference" />
            </el-select>
          </el-form-item>
          <el-form-item label="店铺名称">
            <el-input v-model="queryParams.storeName" placeholder="请输入店铺名称" clearable style="width: 150px" />
          </el-form-item>
        </template>

        <!-- 产品 -->
        <template v-if="recycleType === 'product'">
          <el-form-item label="SKU">
            <el-input v-model="queryParams.sku" placeholder="请输入产品SKU" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="标题">
            <el-input v-model="queryParams.title" placeholder="请输入产品标题" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="分类">
            <el-input v-model="queryParams.category" placeholder="请输入分类" clearable style="width: 150px" />
          </el-form-item>
        </template>

        <!-- 定稿 -->
        <template v-if="recycleType === 'finalDraft'">
          <el-form-item label="SKU">
            <el-input v-model="queryParams.sku" placeholder="请输入定稿SKU" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="批次">
            <el-input v-model="queryParams.batch" placeholder="请输入批次" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="开发人">
            <el-input v-model="queryParams.developer" placeholder="请输入开发人" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="载体">
            <el-input v-model="queryParams.carrier" placeholder="请输入载体" clearable style="width: 150px" />
          </el-form-item>
        </template>

        <!-- 载体 -->
        <template v-if="recycleType === 'carrier'">
          <el-form-item label="批次">
            <el-input v-model="queryParams.batch" placeholder="请输入批次" clearable style="width: 150px" />
          </el-form-item>
          <el-form-item label="载体">
            <el-input v-model="queryParams.carrier" placeholder="请输入载体" clearable style="width: 150px" />
          </el-form-item>
        </template>

        <el-form-item label="删除时间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 批量操作 -->
      <div v-if="selectedRows.length" class="batch-actions">
        <el-button type="primary" :icon="RefreshLeft" @click="handleBatchRestore">
          批量恢复 ({{ selectedRows.length }})
        </el-button>
        <el-button type="danger" :icon="Delete" @click="handleBatchDelete">
          批量彻底删除 ({{ selectedRows.length }})
        </el-button>
      </div>

      <!-- 卡片网格 -->
      <div v-loading="loading" class="product-grid-container">
        <div class="product-grid">
          <div
            v-for="item in tableData"
            :key="getId(item)"
            class="product-card"
            :class="{ selected: selectedRows.includes(item) }"
            @click="toggleItemSelection(item)"
          >
            <!-- 图片 -->
            <div class="product-image-container">
              <el-image
                v-if="getImageUrl(item)"
                :src="getImageUrl(item)"
                :alt="config.getTitle(item)"
                fit="cover"
                class="product-image"
                :preview="false"
                @click.stop="toggleItemSelection(item)"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                    <span>图片加载失败</span>
                  </div>
                </template>
                <template #placeholder>
                  <div class="image-loading">
                    <el-icon><Loading /></el-icon>
                    <span>加载中...</span>
                  </div>
                </template>
              </el-image>
              <div v-else class="no-image">
                <el-icon><Picture /></el-icon>
                <span>暂无图片</span>
              </div>

              <!-- 选择复选框 -->
              <div class="selection-checkbox">
                <el-checkbox
                  :model-value="selectedRows.includes(item)"
                  @click.stop="toggleItemSelection(item)"
                />
              </div>

              <!-- 状态标签 -->
              <div class="product-type-tag">
                <el-tag v-if="recycleType === 'selection'" :type="item.productType === 'new' ? 'success' : 'warning'" size="small">
                  {{ item.productType === 'new' ? '新品榜' : '竞品店铺' }}
                </el-tag>
                <el-tag v-else type="danger" size="small">已删除</el-tag>
              </div>
            </div>

            <!-- 信息区 -->
            <div class="product-info">
              <div class="product-title" :title="config.getTitle(item)">
                {{ config.getTitle(item) }}
              </div>
              <div v-if="recycleType === 'product' || recycleType === 'finalDraft' || recycleType === 'carrier'" class="product-subtitle" :title="config.getSubtitle(item) || ''">
                {{ config.getSubtitle(item) || '-' }}
              </div>

              <div class="product-details">
                <!-- 选品 -->
                <template v-if="recycleType === 'selection'">
                  <div class="detail-item"><span class="label">ASIN:</span><span class="value">{{ item.asin }}</span></div>
                  <div class="detail-item"><span class="label">价格:</span><span class="value price">{{ item.price ? `$${item.price}` : '-' }}</span></div>
                  <div class="detail-item"><span class="label">店铺:</span><span class="value">{{ item.storeName || '-' }}</span></div>
                  <div class="detail-item"><span class="label">分类:</span><span class="value">{{ item.category || '-' }}</span></div>
                </template>

                <!-- 产品 -->
                <template v-if="recycleType === 'product'">
                  <div class="detail-item"><span class="label">分类:</span><span class="value">{{ item.category || '-' }}</span></div>
                  <div class="detail-item"><span class="label">价格:</span><span class="value">{{ item.price || '-' }}</span></div>
                </template>

                <!-- 定稿 -->
                <template v-if="recycleType === 'finalDraft'">
                  <div class="detail-item"><span class="label">开发人:</span><span class="value">{{ item.developer || '-' }}</span></div>
                  <div class="detail-item"><span class="label">载体:</span><span class="value">{{ item.carrier || '-' }}</span></div>
                  <div class="detail-item"><span class="label">状态:</span><span class="value">{{ item.status || '-' }}</span></div>
                </template>

                <!-- 载体 -->
                <template v-if="recycleType === 'carrier'">
                  <div class="detail-item"><span class="label">载体名称:</span><span class="value">{{ item.carrier_name || '-' }}</span></div>
                  <div class="detail-item"><span class="label">载体:</span><span class="value">{{ item.carrier || '-' }}</span></div>
                </template>

                <div class="detail-item">
                  <span class="label">删除时间:</span>
                  <span class="value">{{ item.deletedAt || item.delete_time || '-' }}</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="product-actions">
                <el-button type="primary" size="small" :icon="RefreshLeft" @click.stop="handleRestore(item)">恢复</el-button>
                <el-button type="danger" size="small" :icon="Delete" @click.stop="handleDelete(item)">删除</el-button>
              </div>
            </div>
          </div>
        </div>

        <el-empty v-if="!loading && tableData.length === 0" description="回收站为空" :image-size="200" />
      </div>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="queryParams.page"
          v-model:page-size="queryParams.size"
          :page-sizes="[20, 50, 100, 200]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Search, Refresh, Delete, RefreshLeft, Picture, Loading, Select
} from '@element-plus/icons-vue'
import { selectionApi } from '@/api/selection'
import { productRecycleApi } from '@/api/product'
import { finalDraftApi } from '@/api/finalDraft'
import { carrierLibraryApi } from '@/api/carrierLibrary'

defineOptions({ name: 'RecycleBinPage' })

const route = useRoute()

// 根据路由自动检测类型
const recycleType = computed<'selection' | 'product' | 'finalDraft' | 'carrier'>(() => {
  const map: Record<string, 'selection' | 'product' | 'finalDraft' | 'carrier'> = {
    '/selection-recycle-bin': 'selection',
    '/product-recycle-bin': 'product',
    '/final-draft-recycle-bin': 'finalDraft',
    '/carrier-library-recycle-bin': 'carrier',
  }
  return map[route.path] || 'selection'
})

// 类型配置
const config = computed(() => {
  const configs = {
    selection: {
      title: '选品回收站',
      itemName: '选品',
      getTitle: (item: any) => item.productTitle || '',
      getSubtitle: (item: any) => '',
      getId: (item: any) => item.asin,
      getImageUrl: (item: any) => item.imageUrl || item.thumbPath || '',
      api: {
        getList: (params: any) => selectionApi.getRecycleBinList(params),
        restore: (item: any) => selectionApi.restoreFromRecycleBin([item.asin]).then(r => r.data ? null : r),
        permanentlyDelete: (item: any) => selectionApi.deleteFromRecycleBin([item.asin]),
        batchRestore: (items: any[]) => selectionApi.restoreFromRecycleBin(items.map(i => i.asin)),
        batchDelete: (items: any[]) => selectionApi.deleteFromRecycleBin(items.map(i => i.asin)),
        clearAll: () => selectionApi.clearRecycleBin(),
      },
      resetKeys: ['asin', 'productTitle', 'productType', 'storeName', 'category'],
    },
    product: {
      title: '产品回收站',
      itemName: '产品',
      getTitle: (item: any) => item.sku || '',
      getSubtitle: (item: any) => item.name || '',
      getId: (item: any) => item.id,
      getImageUrl: (item: any) => item.image || '',
      api: {
        getList: (params: any) => productRecycleApi.getRecycledProducts(params),
        restore: (item: any) => productRecycleApi.restoreProduct(item.sku),
        permanentlyDelete: (item: any) => productRecycleApi.permanentlyDeleteProduct(item.sku),
        batchRestore: (items: any[]) => productRecycleApi.batchRestoreProducts({ skus: items.map(i => i.sku) }),
        batchDelete: (items: any[]) => productRecycleApi.batchPermanentlyDeleteProducts({ skus: items.map(i => i.sku) }),
        clearAll: () => productRecycleApi.clearExpiredProducts(0),
      },
      resetKeys: ['sku', 'title', 'category'],
    },
    finalDraft: {
      title: '定稿回收站',
      itemName: '定稿',
      getTitle: (item: any) => item.sku || '',
      getSubtitle: (item: any) => item.batch || '',
      getId: (item: any) => item.id,
      getImageUrl: (item: any) => (item.images && item.images.length > 0) ? item.images[0] : '',
      api: {
        getList: (params: any) => finalDraftApi.getRecycleBin(params),
        restore: (item: any) => finalDraftApi.restore(item.sku),
        permanentlyDelete: (item: any) => finalDraftApi.permanentlyDeleteById(item.id),
        batchRestore: (items: any[]) => finalDraftApi.batchRestore({ ids: items.map(i => i.id) }),
        batchDelete: (items: any[]) => finalDraftApi.batchPermanentlyDelete({ ids: items.map(i => i.id) }),
        clearAll: () => finalDraftApi.clearRecycleBin(),
      },
      resetKeys: ['sku', 'batch', 'developer', 'carrier'],
    },
    carrier: {
      title: '载体回收站',
      itemName: '载体',
      getTitle: (item: any) => item.carrier_name || '未命名载体',
      getSubtitle: (item: any) => item.batch || '',
      getId: (item: any) => item.id,
      getImageUrl: (item: any) => (item.images && item.images.length > 0) ? item.images[0] : '',
      api: {
        getList: (params: any) => carrierLibraryApi.getRecycleBin(params),
        restore: (item: any) => carrierLibraryApi.restore(item.sku),
        permanentlyDelete: (item: any) => carrierLibraryApi.permanentlyDeleteById(item.id),
        batchRestore: (items: any[]) => carrierLibraryApi.batchRestore({ ids: items.map(i => i.id) }),
        batchDelete: (items: any[]) => carrierLibraryApi.batchPermanentlyDelete({ ids: items.map(i => i.id) }),
        clearAll: () => carrierLibraryApi.clearRecycleBin(),
      },
      resetKeys: ['batch', 'carrier'],
    },
  }
  return configs[recycleType.value]
})

// 响应式数据
const loading = ref(false)
const tableData = ref<any[]>([])
const selectedRows = ref<any[]>([])
const total = ref(0)
const dateRange = ref<string[]>([])

// 通用查询参数
const queryParams = reactive<Record<string, any>>({
  page: 1,
  size: 20,
  asin: '',
  productTitle: '',
  productType: '',
  storeName: '',
  category: '',
  sku: '',
  title: '',
  batch: '',
  developer: '',
  carrier: '',
  startDate: '',
  endDate: '',
})

// 构建查询参数
const processedQueryParams = computed(() => {
  const params: Record<string, any> = { page: queryParams.page, size: queryParams.size }
  for (const key of config.value.resetKeys) {
    if (queryParams[key]) params[key] = queryParams[key]
  }
  if (dateRange.value && dateRange.value.length === 2) {
    params.startDate = dateRange.value[0]
    params.endDate = dateRange.value[1]
  }
  return params
})

const isAllSelected = computed(() => {
  return selectedRows.value.length === tableData.value.length && tableData.value.length > 0
})

const toggleSelectAll = () => {
  selectedRows.value = isAllSelected.value ? [] : [...tableData.value]
}

const getId = (item: any) => config.value.getId(item)
const getImageUrl = (item: any) => config.value.getImageUrl(item)

// 数据加载
const loadData = async () => {
  try {
    loading.value = true
    const response = await config.value.api.getList(processedQueryParams.value)
    if (response.code === 200) {
      tableData.value = response.data.list || response.data?.list || []
      total.value = response.data.total || response.data?.total || 0
    } else {
      ElMessage.error((response as any).message || '获取数据失败')
    }
  } catch (error) {
    ElMessage.error('获取数据失败')
    console.error(`获取${config.value.title}数据失败:`, error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => { queryParams.page = 1; loadData() }

const handleReset = () => {
  queryParams.page = 1
  for (const key of config.value.resetKeys) queryParams[key] = ''
  dateRange.value = []
  loadData()
}

const handleSizeChange = (size: number) => { queryParams.size = size; queryParams.page = 1; loadData() }
const handleCurrentChange = (page: number) => { queryParams.page = page; loadData() }

// 选择处理
const toggleItemSelection = (item: any) => {
  const id = getId(item)
  const index = selectedRows.value.findIndex((p: any) => getId(p) === id)
  if (index > -1) selectedRows.value.splice(index, 1)
  else selectedRows.value.push(item)
}

// 恢复
const handleRestore = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要恢复${config.value.itemName}"${config.value.getTitle(row)}"吗？`,
      '确认恢复',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await config.value.api.restore(row)
    if ((response as any).code === 200) {
      ElMessage.success('恢复成功')
      loadData()
    } else {
      ElMessage.error((response as any).message || '恢复失败')
    }
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('恢复失败')
  }
}

// 彻底删除
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确定要彻底删除${config.value.itemName}"${config.value.getTitle(row)}"吗？此操作不可恢复！`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'error' }
    )
    const response = await config.value.api.permanentlyDelete(row)
    if ((response as any).code === 200) {
      // 从本地列表中移除
      const id = getId(row)
      tableData.value = tableData.value.filter((item: any) => getId(item) !== id)
      total.value--
      ElMessage.success('删除成功')
      if (tableData.value.length === 0) loadData()
    } else {
      ElMessage.error((response as any).message || '删除失败')
      loadData()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error((error as any)?.response?.data?.message || '删除失败')
      loadData()
    }
  }
}

// 批量恢复
const handleBatchRestore = async () => {
  if (!selectedRows.value.length) { ElMessage.warning(`请选择要恢复的${config.value.itemName}`); return }
  try {
    await ElMessageBox.confirm(
      `确定要恢复选中的${selectedRows.value.length}个${config.value.itemName}吗？`,
      '确认批量恢复',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    const response = await config.value.api.batchRestore(selectedRows.value)
    if ((response as any).code === 200) {
      const ids = selectedRows.value.map(i => getId(i))
      tableData.value = tableData.value.filter((item: any) => !ids.includes(getId(item)))
      total.value -= selectedRows.value.length
      ElMessage.success(`成功恢复${selectedRows.value.length}个${config.value.itemName}`)
      selectedRows.value = []
      if (tableData.value.length === 0) loadData()
    } else {
      ElMessage.error((response as any).message || '批量恢复失败')
    }
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('批量恢复失败')
  }
}

// 批量彻底删除
const handleBatchDelete = async () => {
  if (!selectedRows.value.length) { ElMessage.warning(`请选择要删除的${config.value.itemName}`); return }
  try {
    await ElMessageBox.confirm(
      `确定要彻底删除选中的${selectedRows.value.length}个${config.value.itemName}吗？此操作不可恢复！`,
      '确认批量删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'error' }
    )
    const response = await config.value.api.batchDelete(selectedRows.value)
    if ((response as any).code === 200) {
      const ids = selectedRows.value.map(i => getId(i))
      tableData.value = tableData.value.filter((item: any) => !ids.includes(getId(item)))
      total.value -= selectedRows.value.length
      ElMessage.success(`成功删除${selectedRows.value.length}个${config.value.itemName}`)
      selectedRows.value = []
      if (tableData.value.length === 0) loadData()
    } else {
      ElMessage.error((response as any).message || '批量删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('批量删除失败')
  }
}

// 清空回收站
const handleClearAll = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要清空整个${config.value.title}吗？此操作将删除所有回收站中的${config.value.itemName}，且不可恢复！`,
      '确认清空回收站',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'error' }
    )
    const response = await config.value.api.clearAll()
    if ((response as any).code === 200) {
      ElMessage.success('清空回收站成功')
      tableData.value = []
      total.value = 0
      selectedRows.value = []
      loadData()
    } else {
      ElMessage.error((response as any).message || '清空回收站失败')
    }
  } catch (error) {
    if (error !== 'cancel') ElMessage.error('清空回收站失败')
  }
}

onMounted(() => { loadData() })
</script>

<style scoped>
.selection-recycle-bin,
.product-recycle-bin,
.final-draft-recycle-bin,
.carrier-library-recycle-bin {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form { margin-bottom: 20px; }
.product-grid-container { min-height: 400px; }
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
  min-height: 400px;
}

.product-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.3s ease;
  cursor: pointer;
  height: 380px;
  display: flex;
  flex-direction: column;
}
.product-card:hover { box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); transform: translateY(-2px); }
.product-card.selected { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2); }

.product-image-container {
  position: relative;
  height: 200px;
  overflow: hidden;
  flex-shrink: 0;
}
.product-image { width: 100%; height: 100%; object-fit: cover; }
.image-error, .image-loading, .no-image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
}

.selection-checkbox {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}
.product-type-tag, .product-status-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

.product-info { padding: 12px; flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.product-title { font-weight: 600; font-size: 14px; color: #303133; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-subtitle { font-size: 12px; color: #909399; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.product-details { flex: 1; overflow-y: auto; margin-bottom: 8px; }
.detail-item { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
.detail-item .label { color: #909399; }
.detail-item .value { color: #303133; font-weight: 500; }
.detail-item .price { color: #e6a23c; }

.product-actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 8px; border-top: 1px solid #f0f0f0; }

.batch-actions { margin-bottom: 16px; padding: 12px; background: #f0f9ff; border: 1px solid #b3d8ff; border-radius: 8px; display: flex; gap: 8px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: center; }
</style>
