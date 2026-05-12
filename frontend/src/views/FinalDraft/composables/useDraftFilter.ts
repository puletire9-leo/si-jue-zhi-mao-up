import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { finalDraftApi } from '@/api/finalDraft'
import { systemConfigApi } from '@/api/systemConfig'

interface DraftLike {
  id: number
  batch: string
}

export function useDraftFilter(loadDrafts: () => void) {
  // 筛选对话框相关状态
  const filterDialogVisible = ref(false)
  const activeFilterPanels = ref<string[]>([])

  // 筛选相关状态 - 支持多选
  const filterParams = reactive({
    developer: [] as string[],
    status: [] as string[],
    carrier: [] as string[],
    batch: [] as string[]
  })

  // 临时筛选参数，用于在对话框中临时存储筛选条件
  const tempFilterParams = reactive({
    developer: [] as string[],
    status: [] as string[],
    carrier: [] as string[],
    batch: [] as string[]
  })

  // 选项列表
  const developerOptions = ref<string[]>([])
  const carrierOptions = ref<string[]>([])
  const batchOptions = ref<string[]>([])

  // 获取所有批次（不受分页限制）
  const fetchAllBatches = async (): Promise<void> => {
    try {
      const apiParams = {
        search_type: 'sku',
        search_content: '',
        page: 1,
        size: 100
      }

      const response = await finalDraftApi.getList(apiParams)
      if (response.code === 200 && response.data?.list) {
        const allDrafts: DraftLike[] = response.data.list
        const uniqueBatches = [...new Set(
          allDrafts.map(draft => draft.batch).filter((batch): batch is string => !!batch)
        )]
        batchOptions.value = uniqueBatches.sort()
      }
    } catch (error) {
      console.error('获取批次列表失败:', error)
    }
  }

  // 打开筛选对话框
  const openFilterDialog = (): void => {
    Object.assign(tempFilterParams, {
      developer: [...filterParams.developer],
      status: [...filterParams.status],
      carrier: [...filterParams.carrier],
      batch: [...filterParams.batch]
    })
    filterDialogVisible.value = true
  }

  // 关闭筛选对话框
  const handleFilterDialogClose = (): void => {
    resetFilter()
    filterDialogVisible.value = false
  }

  // 重置筛选条件
  const resetFilter = (): void => {
    Object.assign(tempFilterParams, {
      developer: [],
      status: [],
      carrier: [],
      batch: []
    })
  }

  // 确认筛选条件
  const confirmFilter = (): void => {
    Object.assign(filterParams, {
      developer: [...tempFilterParams.developer],
      status: [...tempFilterParams.status],
      carrier: [...tempFilterParams.carrier],
      batch: [...tempFilterParams.batch]
    })
    filterDialogVisible.value = false
    loadDrafts()

    const filterCounts = {
      developer: filterParams.developer.length,
      status: filterParams.status.length,
      carrier: filterParams.carrier.length,
      batch: filterParams.batch.length
    }
    let message = '已应用筛选条件'
    if (filterCounts.developer > 0 || filterCounts.status > 0 || filterCounts.carrier > 0 || filterCounts.batch > 0) {
      message += `: 开发人(${filterCounts.developer})，状态(${filterCounts.status})，载体(${filterCounts.carrier})，批次(${filterCounts.batch})`
    }
    ElMessage.success(message)
  }

  // 加载系统配置（开发人列表和载体列表）
  const loadSystemConfigs = async () => {
    try {
      const developerResponse = await systemConfigApi.getDeveloperList()
      if (developerResponse.code === 200 && developerResponse.data && Array.isArray(developerResponse.data.developerList)) {
        developerOptions.value = developerResponse.data.developerList
      } else {
        developerOptions.value = ['admin', 'user1', 'user2']
      }

      const carrierResponse = await systemConfigApi.getCarrierList()
      if (carrierResponse.code === 200 && carrierResponse.data && Array.isArray(carrierResponse.data.carrierList)) {
        carrierOptions.value = carrierResponse.data.carrierList
      } else {
        carrierOptions.value = []
      }
    } catch (error) {
      console.error('加载系统配置失败:', error)
      developerOptions.value = ['admin', 'user1', 'user2']
      carrierOptions.value = []
    }
  }

  return {
    filterDialogVisible,
    activeFilterPanels,
    filterParams,
    tempFilterParams,
    developerOptions,
    carrierOptions,
    batchOptions,
    fetchAllBatches,
    openFilterDialog,
    handleFilterDialogClose,
    resetFilter,
    confirmFilter,
    loadSystemConfigs,
  }
}
