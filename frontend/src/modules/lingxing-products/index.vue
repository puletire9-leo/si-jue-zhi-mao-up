<template>
  <div class="lingxing-products">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">领星本地产品</span>
            <span class="summary-text">
              手动同步领星「产品管理」本地产品到库（双写留底，按领星 ID 幂等，可重复同步）
            </span>
          </div>
          <div class="header-actions">
            <el-input
              v-model="skuKeyword"
              placeholder="按 SKU 模糊查询"
              clearable
              size="small"
              style="width: 200px"
              @keyup.enter="handleSearch"
              @clear="handleSearch"
            />
            <el-button size="small" @click="handleSearch">查询</el-button>
            <el-button size="small" type="success" @click="openCreate">新增产品</el-button>
            <el-button
              type="primary"
              size="small"
              :loading="syncing"
              @click="handleSync"
            >
              同步领星产品
            </el-button>
          </div>
        </div>
      </template>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        「同步领星产品」会分页拉取全部本地产品并落库，按领星产品 ID 幂等更新，
        可能耗时数分钟；完成后自动刷新列表。
      </el-alert>

      <el-table :data="rows" v-loading="loading" border stripe size="small">
        <el-table-column label="图片" width="70">
          <template #default="{ row }">
            <el-image
              v-if="row.picUrl"
              :src="row.picUrl"
              :preview-src-list="[row.picUrl]"
              fit="cover"
              style="width: 40px; height: 40px"
              preview-teleported
            />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="sku" label="SKU" width="140" show-overflow-tooltip />
        <el-table-column prop="productName" label="品名" min-width="180" show-overflow-tooltip />
        <el-table-column prop="categoryName" label="类别" width="120" show-overflow-tooltip />
        <el-table-column prop="brandName" label="品牌" width="110" show-overflow-tooltip />
        <el-table-column label="采购成本(￥)" width="110">
          <template #default="{ row }">
            <span>{{ row.cgPrice ?? '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ row.statusText || statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="productDeveloper" label="开发人" width="110" show-overflow-tooltip />
        <el-table-column prop="cgOptUsername" label="采购员" width="110" show-overflow-tooltip />
        <el-table-column prop="lxUpdateTime" label="领星更新时间" width="170" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button size="small" link type="primary" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && rows.length === 0" description="暂无数据，点右上角「同步领星产品」" />

      <div class="pager">
        <el-pagination
          v-model:current-page="current"
          v-model:page-size="size"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="fetchList"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <!-- 新增/编辑产品（写回领星）-->
    <el-dialog
      v-model="editVisible"
      :title="editMode === 'create' ? '新增本地产品' : '编辑本地产品'"
      width="560px"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        保存会直接写回领星生产数据（productSet），成功后自动回拉刷新本页。请谨慎操作。
      </el-alert>
      <el-form :model="form" label-width="96px">
        <el-form-item label="SKU" required>
          <el-input v-model="form.sku" :disabled="editMode === 'edit'" placeholder="本地产品 SKU" />
        </el-form-item>
        <el-form-item label="品名" :required="editMode === 'create'">
          <el-input v-model="form.product_name" placeholder="新增时必填" />
        </el-form-item>
        <el-form-item label="分类">
          <el-input v-model="form.category" placeholder="分类名称" />
        </el-form-item>
        <el-form-item label="品牌">
          <el-input v-model="form.brand" placeholder="品牌名称" />
        </el-form-item>
        <el-form-item label="型号">
          <el-input v-model="form.model" />
        </el-form-item>
        <el-form-item label="采购成本">
          <el-input v-model="form.cg_price" placeholder="RMB，如 10.00" />
        </el-form-item>
        <el-form-item label="采购备注">
          <el-input v-model="form.purchase_remark" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" placeholder="不改则留空" clearable style="width: 100%">
            <el-option label="停售" :value="0" />
            <el-option label="在售" :value="1" />
            <el-option label="开发中" :value="2" />
            <el-option label="清仓" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="主图 URL">
          <el-input v-model="form.primary_pic_url" placeholder="填写则作为主图写回" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存写回领星</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { lingxingProductApi, type LingxingLocalProduct } from '@/api/lingxingProduct'

const loading = ref(false)
const syncing = ref(false)
const rows = ref<LingxingLocalProduct[]>([])
const total = ref(0)
const current = ref(1)
const size = ref(20)
const skuKeyword = ref('')

// ── 新增/编辑（写回领星）──
const editVisible = ref(false)
const editMode = ref<'create' | 'edit'>('edit')
const saving = ref(false)
const form = reactive({
  sku: '',
  product_name: '',
  category: '',
  brand: '',
  model: '',
  cg_price: '',
  purchase_remark: '',
  status: undefined as number | undefined,
  primary_pic_url: ''
})

function resetForm() {
  form.sku = ''
  form.product_name = ''
  form.category = ''
  form.brand = ''
  form.model = ''
  form.cg_price = ''
  form.purchase_remark = ''
  form.status = undefined
  form.primary_pic_url = ''
}

function openCreate() {
  editMode.value = 'create'
  resetForm()
  editVisible.value = true
}

function openEdit(row: LingxingLocalProduct) {
  editMode.value = 'edit'
  resetForm()
  form.sku = row.sku ?? ''
  form.product_name = row.productName ?? ''
  form.category = row.categoryName ?? ''
  form.brand = row.brandName ?? ''
  form.cg_price = row.cgPrice ?? ''
  form.purchase_remark = row.purchaseRemark ?? ''
  form.status = row.status ?? undefined
  form.primary_pic_url = row.picUrl ?? ''
  editVisible.value = true
}

/** 组织领星 productSet body：只带填了的字段，避免误清空 */
function buildBody(): Record<string, any> {
  const body: Record<string, any> = { sku: form.sku.trim() }
  if (form.product_name.trim()) body.product_name = form.product_name.trim()
  if (form.category.trim()) body.category = form.category.trim()
  if (form.brand.trim()) body.brand = form.brand.trim()
  if (form.model.trim()) body.model = form.model.trim()
  if (form.cg_price.trim()) body.cg_price = form.cg_price.trim()
  if (form.purchase_remark.trim()) body.purchase_remark = form.purchase_remark.trim()
  if (form.status != null) body.status = form.status
  if (form.primary_pic_url.trim()) {
    body.picture_list = [{ pic_url: form.primary_pic_url.trim(), is_primary: 1 }]
  }
  return body
}

async function handleSave() {
  if (!form.sku.trim()) {
    ElMessage.warning('SKU 必填')
    return
  }
  if (editMode.value === 'create' && !form.product_name.trim()) {
    ElMessage.warning('新增产品时品名必填')
    return
  }
  saving.value = true
  try {
    const r = await lingxingProductApi.setLocalProduct(buildBody())
    ElMessage.success(`已写回领星（product_id=${r.product_id}），本地刷新 ${r.resynced} 条`)
    editVisible.value = false
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '写回失败')
  } finally {
    saving.value = false
  }
}

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

/** 状态：0-停售 1-在售 2-开发中 3-清仓 */
function statusLabel(status: number | null): string {
  const map: Record<number, string> = { 0: '停售', 1: '在售', 2: '开发中', 3: '清仓' }
  return status == null ? '—' : map[status] ?? String(status)
}

function statusTagType(status: number | null): TagType {
  const map: Record<number, TagType> = { 0: 'info', 1: 'success', 2: 'warning', 3: 'danger' }
  return status == null ? 'info' : map[status] ?? 'info'
}

async function fetchList() {
  loading.value = true
  try {
    const page = await lingxingProductApi.listLocalProducts(
      current.value,
      size.value,
      skuKeyword.value.trim() || undefined
    )
    rows.value = page.records ?? []
    total.value = page.total ?? 0
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  current.value = 1
  fetchList()
}

function handleSizeChange() {
  current.value = 1
  fetchList()
}

async function handleSync() {
  syncing.value = true
  try {
    const r = await lingxingProductApi.syncLocalProducts()
    ElMessage.success(`同步完成：${r.pages} 页 / 拉取 ${r.fetched} 条 / 落库 ${r.upserted} 条`)
    current.value = 1
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped lang="scss">
.lingxing-products {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .title {
      font-size: 16px;
      font-weight: 600;
    }
    .summary-text {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
.muted {
  color: var(--el-text-color-secondary);
}
</style>
