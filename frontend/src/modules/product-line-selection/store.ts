// 品线选品 Pinia Store — Amber Classic
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface FilterCondition {
  id: string
  type: 'element' | 'carrier' | 'price' | 'keyword' | 'combo'
  label: string
  value: string
  source: string
}

export const useProductLineSelectionStore = defineStore('productLineSelection', () => {
  // ---- 状态 ----
  const marketplace = ref('US')
  const month = ref('2026-05')
  const batchVersion = ref('v3')
  const selectedNodeId = ref('')
  const selectedNodeName = ref('')
  const selectedNodeHealth = ref<string>('healthy')

  const activeFilters = ref<FilterCondition[]>([])
  const resultsVisible = ref(false)
  const resultsLoading = ref(false)
  const modelLoading = ref(false)

  // ---- 计算 ----
  const filterCount = computed(() => activeFilters.value.length)
  const hasFilters = computed(() => activeFilters.value.length > 0)

  // ---- 方法 ----
  let _filterSeq = 0
  function addFilter(type: FilterCondition['type'], label: string, value: string, source: string) {
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

  function selectNode(nodeId: string, name: string, health: string) {
    selectedNodeId.value = nodeId
    selectedNodeName.value = name
    selectedNodeHealth.value = health
    clearFilters()
    closeResults()
    modelLoading.value = true
    // 模拟加载
    setTimeout(() => { modelLoading.value = false }, 400)
  }

  function openResults() { resultsVisible.value = true }
  function closeResults() { resultsVisible.value = false }

  function setMarketplace(val: string) { marketplace.value = val }
  function setMonth(val: string) { month.value = val }
  function setVersion(val: string) { batchVersion.value = val }

  return {
    marketplace, month, batchVersion,
    selectedNodeId, selectedNodeName, selectedNodeHealth,
    activeFilters, filterCount, hasFilters,
    resultsVisible, resultsLoading, modelLoading,
    addFilter, removeFilter, removeFilterByLabel, clearFilters,
    selectNode, openResults, closeResults,
    setMarketplace, setMonth, setVersion
  }
})
