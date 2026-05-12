import { ref, reactive } from 'vue'

interface QueryParams {
  searchType: string
  searchContent: string
}

export function useDraftSearch(onSearch: () => void) {
  // 搜索类型选项
  const searchTypeOptions = [
    { label: 'SKU', value: 'sku' },
    { label: '批次', value: 'batch' },
    { label: '开发人', value: 'developer' },
    { label: '载体', value: 'carrier' },
    { label: '状态', value: 'status' },
    { label: '元素', value: 'element' }
  ]

  const queryParams = reactive<QueryParams>({
    searchType: 'sku',
    searchContent: ''
  })

  // 搜索弹窗相关
  const searchDialogVisible = ref(false)
  // 多项精确搜索专用状态，避免与普通搜索混淆
  const advancedSearchContent = ref('')

  const handleSearch = (): void => {
    onSearch()
  }

  const handleReset = (): void => {
    Object.assign(queryParams, {
      searchType: 'sku',
      searchContent: ''
    })
    onSearch()
  }

  // 搜索弹窗相关方法
  const openSearchDialog = (): void => {
    advancedSearchContent.value = ''
    searchDialogVisible.value = true
  }

  const closeSearchDialog = (): void => {
    advancedSearchContent.value = ''
    searchDialogVisible.value = false
  }

  const clearSearchContent = (): void => {
    queryParams.searchContent = ''
  }

  const clearAdvancedSearchContent = (): void => {
    advancedSearchContent.value = ''
  }

  const preprocessSearchContent = (content: string): string => {
    if (!content) return ''
    let processed = content.replace(/[\r\n]+/g, ' ')
    processed = processed.replace(/,+/g, ' ')
    processed = processed.replace(/\s+/g, ' ')
    return processed.trim()
  }

  const handleAdvancedSearch = (): void => {
    const processedContent = preprocessSearchContent(advancedSearchContent.value)
    queryParams.searchContent = processedContent
    searchDialogVisible.value = false
    onSearch()
  }

  return {
    searchTypeOptions,
    queryParams,
    searchDialogVisible,
    advancedSearchContent,
    handleSearch,
    handleReset,
    openSearchDialog,
    closeSearchDialog,
    clearSearchContent,
    clearAdvancedSearchContent,
    preprocessSearchContent,
    handleAdvancedSearch,
  }
}
