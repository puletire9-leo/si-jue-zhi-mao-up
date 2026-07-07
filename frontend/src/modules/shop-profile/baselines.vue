<template>
  <div class="sp-baselines">
    <!-- 面包屑 -->
    <div class="sp-head">
      <nav class="crumb">
        <a @click="goList">店铺画像</a>
        <span class="sep">/</span>
        <span class="cur">基线与定位</span>
      </nav>
      <span class="dim">共 <span class="mono">{{ baselines.length }}</span> 条基线</span>
    </div>

    <!-- 基线工具条 -->
    <el-card shadow="never" body-style="padding:12px 16px;">
      <div class="tb-row">
        <el-button type="primary" size="small" @click="openCreate">创建基线</el-button>
        <div class="divider" />
        <el-select v-model="typeFilter" placeholder="全部类型" size="small" clearable style="width: 120px" @change="loadBaselines">
          <el-option label="ZHENG" value="ZHENG" />
          <el-option label="CUSTOM" value="CUSTOM" />
          <el-option label="LEGACY" value="LEGACY" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="全部状态" size="small" clearable style="width: 120px" @change="loadBaselines">
          <el-option label="ACTIVE" value="ACTIVE" />
          <el-option label="INACTIVE" value="INACTIVE" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索名称/编码" size="small" clearable style="width: 200px" />
        <div class="tb-row__spacer" />
        <el-button size="small" :loading="loading" @click="loadBaselines">刷新</el-button>
      </div>
    </el-card>

    <!-- 基线表 -->
    <el-card shadow="never" body-style="padding:0;">
      <el-table :data="filteredBaselines" v-loading="loading" border stripe size="small">
        <el-table-column label="基线编码" min-width="180">
          <template #default="{ row }"><span class="mono">{{ row.baselineCode }}</span></template>
        </el-table-column>
        <el-table-column prop="baselineName" label="基线名称" min-width="170" show-overflow-tooltip />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.baselineType" size="small" :type="typeTagType(row.baselineType)" effect="light">
              {{ row.baselineType }}
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="适用市场" width="130">
          <template #default="{ row }">
            <span
              v-for="m in splitScope(row.marketplaceScope)"
              :key="m"
              class="badge-market"
              :style="marketBadgeStyle(m)"
            >{{ m }}</span>
            <span v-if="!splitScope(row.marketplaceScope).length">—</span>
          </template>
        </el-table-column>
        <el-table-column label="店铺数" width="80" align="right">
          <template #default="{ row }"><span class="mono">{{ row.shopCount ?? '—' }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status || 'ACTIVE' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openMembers(row)">查看成员</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="selectForPositioning(row)">定位</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无基线，点左上角「创建基线」。若报错请先执行 create_analysis_baseline_tables.sql" />
        </template>
      </el-table>
    </el-card>

    <!-- 定位面板 -->
    <el-card shadow="never" class="pos-panel" body-style="padding:0;">
      <div class="pos-panel__head">
        <span class="pos-panel__title">基线定位</span>
        <template v-if="activeBaseline">
          <span class="pos-panel__name">— {{ activeBaseline.baselineName }}</span>
          <span class="mono dim">{{ activeBaseline.baselineCode }}</span>
        </template>
        <span v-else class="dim">— 请在上方点「定位」选择一条基线</span>
      </div>

      <div class="pos-panel__filter" v-if="activeBaseline">
        <span class="lbl">市场</span>
        <el-radio-group v-model="posMarket" size="small" @change="loadPositioning">
          <el-radio-button v-for="m in MARKETPLACES" :key="m" :value="m">{{ m }}</el-radio-button>
        </el-radio-group>
        <span class="lbl">批次</span>
        <el-date-picker
          v-model="posBatch"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="空=最新"
          size="small"
          style="width: 150px"
          clearable
          @change="loadPositioning"
        />
        <span class="lbl">limit</span>
        <el-input-number v-model="posLimit" :min="1" :max="500" :controls="false" size="small" style="width: 80px" />
        <el-input
          v-model="posSeller"
          placeholder="搜索店铺"
          size="small"
          clearable
          style="width: 160px"
          @keyup.enter="loadPositioning"
          @clear="loadPositioning"
        />
        <div class="tb-row__spacer" />
        <el-button size="small" :loading="posLoading" @click="loadPositioning">查询</el-button>
        <el-button type="primary" size="small" :loading="posComputing" @click="handleComputePositioning">
          物化定位
        </el-button>
      </div>

      <div class="pos-panel__body" v-if="activeBaseline">
        <PositioningResultTable :rows="posRows" :loading="posLoading" @view="goDetail" />
      </div>
    </el-card>

    <!-- 创建/编辑基线弹窗 -->
    <el-dialog v-model="baselineDialog" :title="editingId ? '编辑基线' : '创建基线'" width="560px">
      <el-form :model="baselineForm" :rules="baselineRules" ref="baselineFormRef" label-width="110px" size="small">
        <el-form-item label="基线编码" prop="baselineCode">
          <el-input v-model="baselineForm.baselineCode" placeholder="如 ZHENG_UK_DE" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="基线名称" prop="baselineName">
          <el-input v-model="baselineForm.baselineName" placeholder="如 郑总 UK/DE 精铺基线" />
        </el-form-item>
        <el-form-item label="类型" prop="baselineType">
          <el-select v-model="baselineForm.baselineType" style="width: 100%">
            <el-option label="ZHENG" value="ZHENG" />
            <el-option label="CUSTOM" value="CUSTOM" />
            <el-option label="LEGACY" value="LEGACY" />
          </el-select>
        </el-form-item>
        <el-form-item label="适用市场" prop="marketplaceScopeArr">
          <el-select v-model="baselineForm.marketplaceScopeArr" multiple style="width: 100%" placeholder="UK / DE / US">
            <el-option v-for="m in MARKETPLACES" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="baselineForm.status">
            <el-radio value="ACTIVE">ACTIVE</el-radio>
            <el-radio value="INACTIVE">INACTIVE</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baselineDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBaseline">保存</el-button>
      </template>
    </el-dialog>

    <!-- 成员弹窗 -->
    <BaselineMemberDialog
      v-model="memberDialog"
      :baseline-code="memberBaseline?.baselineCode || ''"
      :baseline="memberBaseline"
      @changed="loadBaselines"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { shopProfileApi, shopProfileBaselineApi } from '@/api/shopProfile'
import type {
  Marketplace,
  ShopProfileBaseline,
  ShopProfilePositioningResult
} from '@/types/shopProfile'
import { MARKETPLACES, num, marketColor } from './utils'
import BaselineMemberDialog from './components/BaselineMemberDialog.vue'
import PositioningResultTable from './components/PositioningResultTable.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const baselines = ref<ShopProfileBaseline[]>([])
const typeFilter = ref('')
const statusFilter = ref('')
const keyword = ref('')

const filteredBaselines = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return baselines.value
  return baselines.value.filter(
    (b) =>
      b.baselineCode.toLowerCase().includes(kw) || (b.baselineName || '').toLowerCase().includes(kw)
  )
})

function typeTagType(t: string): 'primary' | 'success' | 'warning' | 'info' {
  if (t === 'ZHENG') return 'warning'
  if (t === 'CUSTOM') return 'primary'
  return 'info'
}
function splitScope(scope?: string | null): string[] {
  if (!scope) return []
  return scope.split(',').map((s) => s.trim()).filter(Boolean)
}
function marketBadgeStyle(m: string) {
  const c = marketColor(m)
  return { background: c.bg, color: c.fg, marginRight: '4px' }
}

async function loadBaselines() {
  loading.value = true
  try {
    baselines.value = await shopProfileBaselineApi.list({
      baselineType: typeFilter.value || undefined,
      status: statusFilter.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载基线失败')
  } finally {
    loading.value = false
  }
}

/* ---------- 创建 / 编辑 ---------- */
const baselineDialog = ref(false)
const saving = ref(false)
const editingId = ref<number | null>(null)
const baselineFormRef = ref<FormInstance>()
const baselineForm = reactive<ShopProfileBaseline & { marketplaceScopeArr: string[] }>({
  baselineCode: '',
  baselineName: '',
  baselineType: 'CUSTOM',
  marketplaceScope: '',
  marketplaceScopeArr: [],
  status: 'ACTIVE',
  createdBy: 'manual'
})

const baselineRules: FormRules = {
  baselineCode: [
    { required: true, message: '填写基线编码', trigger: 'blur' },
    { pattern: /^[A-Z0-9_]+$/, message: '仅大写字母/数字/下划线', trigger: 'blur' }
  ],
  baselineName: [{ required: true, message: '填写基线名称', trigger: 'blur' }],
  marketplaceScopeArr: [{ required: true, type: 'array', min: 1, message: '至少选一个市场', trigger: 'change' }]
}

function resetForm() {
  editingId.value = null
  baselineForm.baselineCode = ''
  baselineForm.baselineName = ''
  baselineForm.baselineType = 'CUSTOM'
  baselineForm.marketplaceScopeArr = []
  baselineForm.status = 'ACTIVE'
  baselineForm.createdBy = 'manual'
}

function openCreate() {
  resetForm()
  baselineDialog.value = true
}

function openEdit(row: ShopProfileBaseline) {
  editingId.value = row.id ?? null
  baselineForm.baselineCode = row.baselineCode
  baselineForm.baselineName = row.baselineName
  baselineForm.baselineType = row.baselineType || 'CUSTOM'
  baselineForm.marketplaceScopeArr = splitScope(row.marketplaceScope)
  baselineForm.status = row.status || 'ACTIVE'
  baselineForm.createdBy = row.createdBy || 'manual'
  baselineDialog.value = true
}

async function saveBaseline() {
  if (!baselineFormRef.value) return
  await baselineFormRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const payload: ShopProfileBaseline = {
        baselineCode: baselineForm.baselineCode.trim(),
        baselineName: baselineForm.baselineName.trim(),
        baselineType: baselineForm.baselineType,
        marketplaceScope: baselineForm.marketplaceScopeArr.join(','),
        status: baselineForm.status,
        createdBy: baselineForm.createdBy
      }
      if (editingId.value) {
        await shopProfileBaselineApi.update(editingId.value, payload)
        ElMessage.success('已更新基线')
      } else {
        await shopProfileBaselineApi.create(payload)
        ElMessage.success('已创建基线')
      }
      baselineDialog.value = false
      await loadBaselines()
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    } finally {
      saving.value = false
    }
  })
}

/* ---------- 成员 ---------- */
const memberDialog = ref(false)
const memberBaseline = ref<ShopProfileBaseline | null>(null)
function openMembers(row: ShopProfileBaseline) {
  memberBaseline.value = row
  memberDialog.value = true
}

/* ---------- 定位 ---------- */
const activeBaseline = ref<ShopProfileBaseline | null>(null)
const posMarket = ref<Marketplace>('UK')
const posBatch = ref('')
const posLimit = ref(50)
const posSeller = ref('')
const posLoading = ref(false)
const posComputing = ref(false)
const posRows = ref<ShopProfilePositioningResult[]>([])

function firstScopeMarket(b: ShopProfileBaseline): Marketplace {
  const arr = splitScope(b.marketplaceScope)
  const m = arr.find((x) => (MARKETPLACES as string[]).includes(x))
  return (m as Marketplace) || 'UK'
}

function supportsMarket(b: ShopProfileBaseline, marketplace: Marketplace): boolean {
  const arr = splitScope(b.marketplaceScope)
  return arr.length === 0 || arr.includes(marketplace)
}

function selectForPositioning(
  row: ShopProfileBaseline,
  options: { preserveSeller?: boolean; preserveMarket?: boolean } = {}
) {
  activeBaseline.value = row
  if (!options.preserveMarket) posMarket.value = firstScopeMarket(row)
  if (!options.preserveSeller) posSeller.value = ''
  loadPositioning()
}

async function loadPositioning() {
  if (!activeBaseline.value) return
  posLoading.value = true
  try {
    posRows.value = await shopProfileApi.positioning({
      baselineCode: activeBaseline.value.baselineCode,
      marketplace: posMarket.value,
      batchDate: posBatch.value || undefined,
      sellerName: posSeller.value || undefined,
      limit: posLimit.value
    })
  } catch (e: any) {
    posRows.value = []
    ElMessage.error(e?.message || '定位查询失败')
  } finally {
    posLoading.value = false
  }
}

async function handleComputePositioning() {
  if (!activeBaseline.value) return
  try {
    await ElMessageBox.confirm(
      `将重新计算 ${posMarket.value} 对基线「${activeBaseline.value.baselineName}」的定位结果，确认继续？`,
      '物化基线定位',
      { type: 'warning', confirmButtonText: '确认物化', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  posComputing.value = true
  try {
    const r = await shopProfileApi.computePositioning({
      baselineCode: activeBaseline.value.baselineCode,
      marketplace: posMarket.value,
      batchDate: posBatch.value || undefined
    })
    if (r.requiresSqlMigration) {
      ElMessage.warning('缺少定位结果表，请先执行 create_analysis_baseline_tables.sql')
    } else {
      ElMessage.success(`物化完成：写入 ${r.insertedResults ?? 0} 条定位结果`)
      await loadPositioning()
    }
  } catch (e: any) {
    ElMessage.error(e?.message || '物化定位失败')
  } finally {
    posComputing.value = false
  }
}

function goDetail(row: ShopProfilePositioningResult) {
  const query: Record<string, string> = {}
  if (row.batchDate) query.batchDate = row.batchDate
  if (activeBaseline.value?.baselineCode) query.baselineCode = activeBaseline.value.baselineCode
  router.push({
    name: 'ShopProfileDetail',
    params: { marketplace: row.marketplace, sellerName: encodeURIComponent(row.sellerName) },
    query
  })
}

function goList() {
  router.push({ name: 'ShopProfileList' })
}

onMounted(async () => {
  await loadBaselines()
  // 支持从列表「查看定位」跳转带入 baselineCode / marketplace / sellerName
  const codeParam = route.params.baselineCode ? String(route.params.baselineCode) : ''
  const codeQuery = route.query.baselineCode ? String(route.query.baselineCode) : ''
  const code = codeParam || codeQuery
  if (route.query.marketplace) {
    const m = String(route.query.marketplace).toUpperCase()
    if ((MARKETPLACES as string[]).includes(m)) posMarket.value = m as Marketplace
  }
  if (route.query.sellerName) posSeller.value = String(route.query.sellerName)
  if (code) {
    const found = baselines.value.find((b) => b.baselineCode === code)
    if (found) selectForPositioning(found, { preserveSeller: true, preserveMarket: !!route.query.marketplace })
  } else if (route.query.marketplace || route.query.sellerName) {
    const found = baselines.value.find((b) => supportsMarket(b, posMarket.value)) || baselines.value[0]
    if (found) selectForPositioning(found, { preserveSeller: true, preserveMarket: true })
  }
})
</script>

<style scoped lang="scss">
.sp-baselines {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.crumb {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  a {
    cursor: pointer;
    color: #e8621c;
    &:hover {
      text-decoration: underline;
    }
  }
  .sep {
    margin: 0 6px;
    color: var(--el-text-color-placeholder);
  }
  .cur {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }
}
.tb-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  &__spacer {
    flex: 1;
  }
}
.divider {
  width: 1px;
  height: 22px;
  background: var(--el-border-color);
}
.badge-market {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.pos-panel {
  &__head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
  &__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  &__name {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }
  &__filter {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    .lbl {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  &__body {
    padding: 12px;
  }
}
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.dim {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
