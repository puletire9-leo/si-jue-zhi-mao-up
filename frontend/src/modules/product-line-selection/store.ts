import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getProductLineModel, getProductLineElements, getBatches, getAggregatedData } from '@/api/product-line'
import { competitorApi } from '@/api/competitor'
import { selectionApi } from '@/api/selection'
import type { ProductLineGroup, BatchInfo, FilterCondition, FilterType, TreeGroup, TreeNode, ProductLineModelData } from '@/types/productLine'
import type { CompetitorProductRaw } from '@/api/competitor'

interface SubCategoryItem {
  nodeId: string | number
  nodeName?: string
  nodeFullPath?: string
  productCount?: number
}

export const useProductLineSelectionStore = defineStore('productLineSelection', () => {
  // ---- 状态 ----
  const marketplace = ref('UK')
  const month = ref('2026-05')
  const batchVersion = ref('v3')
  const selectedBatchId = ref('')
  const selectedNodeId = ref('')
  const selectedNodeName = ref('')
  const selectedNodeHealth = ref<string>('healthy')
  const selectedBsrId = ref('')      // L1 大类 ID
  const selectedBsrName = ref('')    // L1 大类名称（面包屑用）

  const activeFilters = ref<FilterCondition[]>([])
  const resultsVisible = ref(false)
  const modelLoading = ref(false)
  const treeLoading = ref(false)
  const competitorLoading = ref(false)

  const modelData = ref<ProductLineModelData | null>(null)
  const elementsData = ref<unknown[] | null>(null)
  const competitorResults = ref<CompetitorProductRaw[]>([])
  const competitorTotal = ref(0)
  const competitorPage = ref(1)
  const competitorPageSize = ref(60)

  const treeData = ref<TreeGroup[]>([])
  const batches = ref<BatchInfo[]>([])

  // ---- 新增状态 ----
  const searchKeyword = ref('')
  const selectedProducts = ref(new Set<string>())

  // ---- 计算 ----
  const filterCount = computed(() => activeFilters.value.length)
  const hasFilters = computed(() => activeFilters.value.length > 0)
  const selectedBatchInfo = computed(() =>
    batches.value.find(b => b.batchId === selectedBatchId.value) ?? null
  )

  const selectedProductList = computed(() => Array.from(selectedProducts.value))
  const selectedCount = computed(() => selectedProducts.value.size)

  // ---- 数据初始化 ----
  async function initData() {
    await Promise.all([fetchTree(), fetchBatchesList()])
  }

  async function fetchTree() {
    treeLoading.value = true
    try {
      const mkp = marketplace.value
      const mo = month.value.replace('-', '')
      const res = await getAggregatedData(mkp, mo)
      const raw = res?.data?.productLines as ProductLineGroup[] | undefined
      if (!raw) { treeData.value = []; return }

      treeData.value = raw.map((g: ProductLineGroup, idx: number) => {
        // bsrName 可能缺失，从第一个子类的 nodeFullPath 提取 L1 名称
        const l1Name = g.bsrName || (g.subCategories?.[0]?.nodeFullPath?.split(':')[0]) || g.bsrId
        return {
          id: g.bsrId,
          name: l1Name,
          icon: '📦',
          expanded: idx === 0,
          children: (g.subCategories || []).map((sc: SubCategoryItem) => ({
            id: `${g.bsrId}_${sc.nodeId}`,
            name: sc.nodeName,
            nodeId: Number(sc.nodeId),
            status: 'analyzed' as const,
            productCount: sc.productCount,
          }))
        }
      })
    } catch (err) {
      console.warn('[Store]', err)
    } finally {
      treeLoading.value = false
    }
  }

  async function fetchBatchesList() {
    try {
      const res = await getBatches(marketplace.value)
      const raw = res?.data?.batches as BatchInfo[] | undefined
      if (raw) {
        batches.value = raw
        if (raw.length > 0 && !selectedBatchId.value) {
          selectedBatchId.value = raw[0].batchId
        }
      }
    } catch (err) {
      console.warn('[Store]', err)
    }
  }

  // ---- 筛选方法 ----
  let _filterSeq = 0
  function addFilter(type: FilterType, label: string, value: string, source: string) {
    const exists = activeFilters.value.find(f => f.value === value && f.type === type)
    if (exists) return
    activeFilters.value.push({ id: `f-${++_filterSeq}`, type, label, value, source })
  }

  function removeFilter(id: string) {
    activeFilters.value = activeFilters.value.filter(f => f.id !== id)
  }

  function removeFilterByLabel(label: string) {
    activeFilters.value = activeFilters.value.filter(f => !f.label.startsWith(label))
  }

  function clearFilters() {
    activeFilters.value = []
  }

  // ---- 通用商品加载 ----
  async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
    competitorLoading.value = true
    resultsVisible.value = true
    try {
      const params: Record<string, any> = {
        marketplace: marketplace.value,
        month: month.value.replace('-', ''),  // FIXED: MED-8 — 'YYYY-MM' → 'YYYYMM' 匹配数据库格式
        page: competitorPage.value,
        size: competitorPageSize.value,
      }
      if (filter.bsrId) params.bsrId = filter.bsrId
      if (filter.nodeId) params.nodeId = filter.nodeId
      if (searchKeyword.value) params.title = searchKeyword.value

      // 模型筛选条件（仅 L2 时有 modelData）
      const model = modelData.value
      if (model?.priceBand?.sweet_spot_min != null) params.priceMin = model.priceBand.sweet_spot_min
      if (model?.priceBand?.sweet_spot_max != null) params.priceMax = model.priceBand.sweet_spot_max
      if (model?.qualityBenchmark?.bsr_p90 != null) params.bsrMax = model.qualityBenchmark.bsr_p90
      if (model?.qualityBenchmark?.rating_min != null) params.ratingMin = model.qualityBenchmark.rating_min
      if (model?.qualityBenchmark?.weight_g_max != null) params.weightMax = model.qualityBenchmark.weight_g_max

      // element/carrier/keyword/combo filters
      const elementFilters = activeFilters.value.filter(f => f.type === 'element')
      const carrierFilters = activeFilters.value.filter(f => f.type === 'carrier')
      const keywordFilters = activeFilters.value.filter(f => f.type === 'keyword')
      const comboFilters = activeFilters.value.filter(f => f.type === 'combo')
      let kw = ''
      if (elementFilters.length > 0) kw = elementFilters.map(f => f.value).join(' ')
      if (carrierFilters.length > 0) kw = kw ? `${kw} ${carrierFilters.map(f => f.value).join(' ')}` : carrierFilters.map(f => f.value).join(' ')
      if (keywordFilters.length > 0) {
        const kwStr = keywordFilters.map(f => f.value).join(' ')
        params.title = params.title ? `${params.title} ${kwStr}` : kwStr
      }
      if (comboFilters.length > 0) kw = kw ? `${kw} ${comboFilters.map(f => f.value).join(' ')}` : comboFilters.map(f => f.value).join(' ')
      if (kw) params.keywords = kw

      // 使用正确的 API: getDengZongShopList (调 /api/v1/deng-zong-shop/products)
      const res = await competitorApi.getDengZongShopList(params)
      competitorResults.value = (res?.data?.list ?? []) as CompetitorProductRaw[]
      competitorTotal.value = res?.data?.total ?? 0
    } catch (err) {
      console.warn('[Store]', err)
    } finally {
      competitorLoading.value = false
    }
  }

  // ---- L1 大类点击 ----
  async function selectCategory(bsrId: string, name: string) {
    selectedNodeId.value = ''
    selectedNodeName.value = ''
    selectedNodeHealth.value = 'healthy'
    selectedBsrId.value = bsrId
    selectedBsrName.value = name
    clearFilters()
    closeResults()
    competitorPage.value = 1
    selectedProducts.value = new Set()
    searchKeyword.value = ''
    modelData.value = null
    modelLoading.value = false
    await loadProducts({ bsrId })
  }

  // ---- L2 小类点击（取代 selectNode） ----
  let _modelReqId: string | null = null // FIXED: HIGH-4 — request dedup ID (counter-based, non-secure)
  async function selectSubCategory(nodeId: number, name: string, bsrId: string, health?: string) {
    selectedBsrId.value = bsrId
    selectedNodeId.value = String(nodeId)
    selectedNodeName.value = name
    selectedNodeHealth.value = health || 'healthy'
    clearFilters()
    closeResults()
    competitorPage.value = 1
    selectedProducts.value = new Set()
    searchKeyword.value = ''

    // 模型后台异步加载，不阻塞竞品展示
    const reqId = String(Date.now()) + String(Math.random()).slice(2) // FIXED: HIGH-4 — safe fallback for non-secure contexts
    _modelReqId = reqId
    modelLoading.value = true
    modelData.value = null
    getProductLineModel(nodeId, marketplace.value, selectedBatchId.value)
      .then(res => {
        if (reqId === _modelReqId) modelData.value = res?.data ?? null
      })
      .catch(() => {
        // FIXED: HIGH-1
        ElMessage.error(`品线模型加载失败`)
        if (reqId === _modelReqId) modelData.value = null
      })
      .finally(() => {
        if (reqId === _modelReqId) modelLoading.value = false
      })

    await loadProducts({ nodeId })
  }

  /**
 * fetchElements 当前未被任何组件直接调用，保留作为手动使用的导出接口
 */
  async function fetchElements(nodeId: number, mkp?: string, m?: string) {
    const mp = mkp ?? marketplace.value
    const mo = m ?? month.value
    elementsData.value = null
    modelLoading.value = true
    try {
      const res = await getProductLineElements(nodeId, mp, mo)
      elementsData.value = res?.data ?? null
    } catch (err) {
      console.warn('[Store]', err)
    } finally {
      modelLoading.value = false
    }
  }

  // ---- 竞品搜索 ----
  // 接受可选 keyword 参数避免 searchByKeyword 调用时对 searchKeyword ref 的隐式依赖
  async function searchCompetitors(keyword?: string) {
    if (keyword !== undefined) {
      searchKeyword.value = keyword
    }
    competitorPage.value = 1
    if (!hasFilters.value && !selectedNodeId.value && !selectedBsrId.value && !searchKeyword.value) return
    const filter: Record<string, any> = {}
    if (selectedNodeId.value) filter.nodeId = Number(selectedNodeId.value)
    else if (selectedBsrId.value) filter.bsrId = selectedBsrId.value
    else return
    await loadProducts(filter)
  }

  async function goToPage(page: number) {
    competitorPage.value = page
    const filter: Record<string, any> = {}
    if (selectedNodeId.value) filter.nodeId = Number(selectedNodeId.value)
    else if (selectedBsrId.value) filter.bsrId = selectedBsrId.value
    else return
    await loadProducts(filter)
  }

  function openResults() { resultsVisible.value = true }
  function closeResults() { resultsVisible.value = false }

  // ---- 选品操作 ----

  /**
   * 切换商品选中状态
   */
  function toggleProductSelection(asin: string, selected: boolean) {
    const set = selectedProducts.value
    if (selected) {
      set.add(asin)
    } else {
      set.delete(asin)
    }
    // 触发响应式更新
    selectedProducts.value = new Set(set)
  }

  /**
   * 全选当前页商品
   */
  function selectAllOnPage(products: CompetitorProductRaw[]) {
    const set = new Set(selectedProducts.value)
    for (const p of products) {
      if (p.asin) set.add(p.asin)
    }
    selectedProducts.value = set
  }

  /**
   * 清空所有选中商品
   */
  function clearSelection() {
    selectedProducts.value = new Set()
  }

  /**
   * 批量加入选品
   */
  async function batchAddToSelection() {
    const products = Array.from(selectedProducts.value)
    if (products.length === 0) return

    try {
      await selectionApi.create({
        products,
        marketplace: marketplace.value,
        nodeId: selectedNodeId.value || undefined,
        bsrId: selectedBsrId.value || undefined,
      })
      // 清空已选中
      selectedProducts.value = new Set()
    } catch (err) {
      console.warn('[Store]', err)
    }
  }

  /**
   * 关键词搜索：设置 searchKeyword 并触发搜索
   */
  async function searchByKeyword(keyword: string) {
    await searchCompetitors(keyword)
  }

  /**
   * 导出选中 ASIN 列表到 Excel
   */
  async function exportSelectedExcel() {
    const products = Array.from(selectedProducts.value)
    if (products.length === 0) return

    try {
      const blob = await selectionApi.exportSelectedAsins(products)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selected-asins-${Date.now()}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.warn('[Store]', err)
    }
  }

  function setMarketplace(val: string) { marketplace.value = val }
  function setMonth(val: string) { month.value = val }
  function setVersion(val: string) { batchVersion.value = val }

  return {
    marketplace, month, batchVersion,
    selectedNodeId, selectedNodeName, selectedNodeHealth,
    selectedBsrId, selectedBsrName,
    selectedBatchId, selectedBatchInfo,
    activeFilters, filterCount, hasFilters,
    resultsVisible, modelLoading, treeLoading, competitorLoading,
    modelData, elementsData, treeData, batches,
    competitorResults, competitorTotal, competitorPage, competitorPageSize, goToPage,
    addFilter, removeFilter, removeFilterByLabel, clearFilters,
    selectCategory, selectSubCategory, fetchElements, openResults, closeResults,
    searchCompetitors, initData, fetchTree, fetchBatchesList, loadProducts,
    setMarketplace, setMonth, setVersion,
    // ---- 新增状态 ----
    searchKeyword,
    selectedProducts,
    selectedProductList,
    selectedCount,
    // ---- 新增方法 ----
    toggleProductSelection,
    selectAllOnPage,
    clearSelection,
    batchAddToSelection,
    searchByKeyword,
    exportSelectedExcel,
  }
})
