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

  const batchLoading = ref(false)
  const exportLoading = ref(false)

  const modelData = ref<ProductLineModelData | null>(null)
  const elementsData = ref<unknown[] | null>(null)
  const competitorResults = ref<CompetitorProductRaw[]>([])
  const competitorTotal = ref(0)
  const competitorPage = ref(1)
  const competitorPageSize = ref(60)

  const treeData = ref<TreeGroup[]>([])
  const batches = ref<BatchInfo[]>([])

  // ---- 基础筛选状态（L1/L2 通用） ----
  const searchKeyword = ref('')
  const searchSellerName = ref('')
  const searchBrand = ref('')
  const searchPriceMin = ref<number | null>(null)
  const searchPriceMax = ref<number | null>(null)
  const selectedProducts = ref(new Set<string>())
  const sortBy = ref('')

  // ---- 计算 ----
  const filterCount = computed(() => activeFilters.value.length)
  const hasFilters = computed(() => activeFilters.value.length > 0)
  const selectedBatchInfo = computed(() =>
    batches.value.find(b => b.batchId === selectedBatchId.value) ?? null
  )

  const selectedProductList = computed(() => Array.from(selectedProducts.value))
  const selectedCount = computed(() => selectedProducts.value.size)

  // 当前选中 L1 的子类列表（供右侧 L2 面板使用）
  const currentSubCategories = computed(() => {
    if (!selectedBsrId.value) return []
    const group = treeData.value.find(g => g.id === selectedBsrId.value)
    return group?.children ?? []
  })

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
      ElMessage.error('品线树加载失败，请检查网络或刷新重试')
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
      ElMessage.error('批次列表加载失败')
    }
  }

  // ---- 筛选方法 ----
  let _filterSeq = 0
  let _productsReqId = 0 // R3.2: loadProducts 请求去重
  function addFilter(type: FilterType, label: string, value: string, source: string) {
    const exists = activeFilters.value.find(f => f.value === value && f.type === type && f.source === source)
    if (exists) return
    activeFilters.value.push({ id: `f-${++_filterSeq}`, type, label, value, source })
    searchCompetitors()
  }

  function removeFilter(id: string) {
    activeFilters.value = activeFilters.value.filter(f => f.id !== id)
    if (selectedNodeId.value || selectedBsrId.value) searchCompetitors()
  }

  function removeFilterByLabel(label: string) {
    activeFilters.value = activeFilters.value.filter(f => !f.label.startsWith(label))
    if (selectedNodeId.value || selectedBsrId.value) searchCompetitors()
  }

  function clearFilters() {
    activeFilters.value = []
  }

  // ---- 筛选标签常量（R6.3: 去魔法字符串）----
  const FILTER_LABEL = {
    carrier: (name: string) => `载体:${name}`,
    element: (name: string) => name,
    comboItem: (name: string) => `组合:${name}`,
  }

  function clearBasicFilters() {
    searchSellerName.value = ''
    searchBrand.value = ''
    searchPriceMin.value = null
    searchPriceMax.value = null
  }

  // ---- 通用商品加载 ----
  async function loadProducts(filter: { bsrId?: string; nodeId?: number }) {
    const reqId = ++_productsReqId // R3.2: 请求去重
    competitorLoading.value = true
    resultsVisible.value = true
    try {
      const params: Record<string, any> = {
        marketplace: marketplace.value,
        month: month.value.replace('-', ''),  // FIXED: MED-8 — 'YYYY-MM' → 'YYYYMM' 匹配数据库格式
        page: competitorPage.value,
        size: competitorPageSize.value,
      }
      // BUG-1 FIX: 拆分排序值 "bsr_asc" → sortBy="bsr" + sortOrder="asc"
      if (sortBy.value) {
        const [sortField, sortDir] = sortBy.value.split('_')
        if (sortField) params.sortBy = sortField
        if (sortDir) params.sortOrder = sortDir
      }
      if (filter.bsrId) params.bsrId = filter.bsrId
      if (filter.nodeId) params.nodeId = filter.nodeId
      if (searchKeyword.value) params.title = searchKeyword.value
      if (searchSellerName.value) params.sellerName = searchSellerName.value
      if (searchBrand.value) params.brand = searchBrand.value
      if (searchPriceMin.value != null) params.priceMin = searchPriceMin.value
      if (searchPriceMax.value != null) params.priceMax = searchPriceMax.value

      // 模型筛选条件（仅 L2 时有 modelData，仅在用户未手动输入时作为默认值）
      const model = modelData.value
      if (model?.priceBand?.sweet_spot_min != null && searchPriceMin.value == null) params.priceMin = model.priceBand.sweet_spot_min
      if (model?.priceBand?.sweet_spot_max != null && searchPriceMax.value == null) params.priceMax = model.priceBand.sweet_spot_max
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
      if (reqId !== _productsReqId) return // R3.2: 过时请求丢弃
      competitorResults.value = (res?.data?.list ?? []) as CompetitorProductRaw[]
      competitorTotal.value = res?.data?.total ?? 0
    } catch (err) {
      if (reqId !== _productsReqId) return // R3.2: 过时请求不弹错
      ElMessage.error('商品数据加载失败，请重试')
    } finally {
      if (reqId === _productsReqId) competitorLoading.value = false // R3.2: 仅最新请求控制 loading
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
    clearBasicFilters()
    closeResults()
    competitorPage.value = 1
    sortBy.value = ''
    searchKeyword.value = ''
    selectedProducts.value = new Set()
    modelData.value = null
    modelLoading.value = false
    await loadProducts({ bsrId })
    if (competitorResults.value.length === 0) {
      ElMessage.info('该大类下暂无商品数据')
    }
  }

  // ---- L2 小类点击（取代 selectNode） ----
  let _modelReqId: string | null = null // FIXED: HIGH-4 — request dedup ID (counter-based, non-secure
  async function selectSubCategory(nodeId: number, name: string, bsrId: string, health?: string) {
    selectedBsrId.value = bsrId
    selectedNodeId.value = String(nodeId)
    selectedNodeName.value = name
    selectedNodeHealth.value = health || 'healthy'
    clearFilters()
    clearBasicFilters()
    closeResults()
    competitorPage.value = 1
    sortBy.value = ''
    searchKeyword.value = ''
    selectedProducts.value = new Set()

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openResults() { resultsVisible.value = true }
  function closeResults() { resultsVisible.value = false }

  // ---- 排序 ----
  function setSortBy(val: string) {
    sortBy.value = val
    if (selectedNodeId.value || selectedBsrId.value) {
      loadProducts({
        nodeId: selectedNodeId.value ? Number(selectedNodeId.value) : undefined,
        bsrId: selectedBsrId.value || undefined,
      })
    }
  }

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
    if (batchLoading.value) return
    batchLoading.value = true
    const products = Array.from(selectedProducts.value)
    if (products.length === 0) { batchLoading.value = false; return }

    try {
      await selectionApi.create({
        products,
        marketplace: marketplace.value,
        nodeId: selectedNodeId.value || undefined,
        bsrId: selectedBsrId.value || undefined,
      })
      // 清空已选中
      selectedProducts.value = new Set()
      ElMessage.success(`已加入 ${products.length} 件商品到选品库`)
    } catch (err) {
      ElMessage.error('批量加入选品失败，请重试')
    } finally {
      batchLoading.value = false
    }
  }

  /**
   * 关键词搜索：设置 searchKeyword 并触发搜索
   */
  async function searchByKeyword(keyword: string) {
    await searchCompetitors(keyword)
  }

  /**
   * 应用基础筛选（卖家/品牌/价格）并重新搜索
   */
  async function applyBasicFilters() {
    competitorPage.value = 1
    await searchCompetitors()
  }

  /**
   * 导出选中 ASIN 列表到 Excel
   */
  async function exportSelectedExcel() {
    if (exportLoading.value) return
    exportLoading.value = true
    const products = Array.from(selectedProducts.value)
    if (products.length === 0) { exportLoading.value = false; return }

    try {
      const blob = await selectionApi.exportSelectedAsins(products)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selected-asins-${Date.now()}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      ElMessage.success(`已导出 ${products.length} 条 ASIN`)
    } catch (err) {
      ElMessage.error('导出 Excel 失败，请重试')
    } finally {
      exportLoading.value = false
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
    modelData, elementsData, treeData, batches, currentSubCategories,
    competitorResults, competitorTotal, competitorPage, competitorPageSize, goToPage,
    batchLoading, exportLoading,
    addFilter, removeFilter, removeFilterByLabel, clearFilters,
    selectCategory, selectSubCategory, fetchElements, openResults, closeResults,
    searchCompetitors, initData, fetchTree, fetchBatchesList, loadProducts,
    FILTER_LABEL,
    setMarketplace, setMonth, setVersion,
    // ---- 新增状态 ----
    searchKeyword,
    searchSellerName,
    searchBrand,
    searchPriceMin,
    searchPriceMax,
    selectedProducts,
    selectedProductList,
    selectedCount,
    sortBy,
    setSortBy,
    // ---- 新增方法 ----
    toggleProductSelection,
    selectAllOnPage,
    clearSelection,
    batchAddToSelection,
    searchByKeyword,
    exportSelectedExcel,
    clearBasicFilters,
    applyBasicFilters,
  }
})
