import { ref, reactive, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { finalDraftApi } from '@/api/finalDraft'
import { useFinalDraftStore } from '@/stores/finalDraft'
import { useDraftFilter } from './useDraftFilter'
import { useDraftSearch } from './useDraftSearch'

interface Draft {
  id: number
  sku: string
  batch: string
  developer: string
  carrier: string
  element?: string
  modificationRequirement?: string
  infringementLabel?: string
  images: string[]
  reference_images: string[]
  referenceImages?: string[]
  createTime: string
  updateTime: string
  status: 'finalized' | 'optimizing' | 'concept'
}

interface Pagination {
  page: number
  size: number
  total: number
}

export function useDraftList() {
  // ── Sub-composables (circular-safe: function loadDrafts is hoisted) ──
  const filter = useDraftFilter(() => loadDrafts())
  const search = useDraftSearch(() => {
    pagination.page = 1
    loadDrafts()
  })

  // ── Loading, list, pagination ──
  const loading = ref(false)
  const draftList = ref<Draft[]>([])
  const pagination = reactive<Pagination>({
    page: 1,
    size: 20,
    total: 0,
  })

  async function loadDrafts(): Promise<void> {
    loading.value = true
    try {
      const apiParams = {
        search_type: search.queryParams.searchType,
        search_content: search.queryParams.searchContent,
        developer: filter.filterParams.developer,
        status: filter.filterParams.status,
        carrier: filter.filterParams.carrier,
        batch: filter.filterParams.batch,
        page: pagination.page,
        size: pagination.size,
      }

      console.log('发送到API的请求参数:', apiParams)
      const response = await finalDraftApi.getList(apiParams)

      console.log('API返回的数据:', response)
      console.log('list数组长度:', response.data?.list?.length)
      console.log('total字段值:', response.data?.total)

      if (response.code === 200) {
        const listData = response.data?.list
        let processedList: Draft[] = []
        if (Array.isArray(listData)) {
          processedList = listData.map((item: any) => ({
            ...item,
            reference_images: item.reference_images || [],
            referenceImages: item.reference_images || [],
          }))
          processedList.forEach((draft, index) => {
            console.log(
              `Draft ${index}: id=${draft.id}, sku=${draft.sku}, infringementLabel=${draft.infringementLabel}`
            )
          })
        } else {
          console.warn('API返回的list不是数组，已初始化为空数组')
        }

        draftList.value = processedList

        let totalCount = response.data?.total || 0
        if (totalCount === 0 && processedList.length > 0) {
          totalCount = processedList.length
          console.warn(
            'API返回total为0，但实际数据数量为',
            processedList.length,
            '已修正'
          )
        }

        pagination.total = totalCount
        pagination.page = response.data?.page || 1
        pagination.size = response.data?.size || 20

        console.log('最终分页信息:', {
          total: pagination.total,
          page: pagination.page,
          size: pagination.size,
          listLength: processedList.length,
        })

        await filter.fetchAllBatches()

        if (draftList.value.length === 0) {
          console.info('定稿列表为空')
        }

        const notFoundItems = (
          response.data as { not_found_items?: string[] }
        )?.not_found_items
        if (notFoundItems && notFoundItems.length > 0) {
          const searchTypeLabel =
            search.searchTypeOptions.find(
              (opt) => opt.value === search.queryParams.searchType
            )?.label || search.queryParams.searchType
          const notFoundMessage = `以下${searchTypeLabel}未找到：${notFoundItems.join(', ')}`
          ElMessage.warning({
            message: notFoundMessage,
            duration: 5000,
            showClose: true,
          })
        }
      } else {
        draftList.value = []
        ElMessage.error(response.message || '加载定稿数据失败')
        console.error('API返回错误:', response)
      }
    } catch (error: any) {
      draftList.value = []
      console.error('加载定稿数据失败:', error)
      ElMessage.error(error.message || '加载定稿数据失败')
    } finally {
      loading.value = false
    }
  }

  const handleSizeChange = (size: number): void => {
    pagination.size = size
    loadDrafts()
  }

  const handlePageChange = (page: number): void => {
    pagination.page = page
    loadDrafts()
  }

  const finalDraftStore = useFinalDraftStore()
  watch(() => finalDraftStore.needRefresh, (newValue) => {
    if (newValue) {
      console.log('[FinalDraft] 收到刷新通知，开始刷新数据')
      loadDrafts()
      finalDraftStore.resetRefreshStatus()
    }
  })

  onMounted(() => {
    loadDrafts()
  })

  return {
    // list & pagination
    loading,
    draftList,
    pagination,
    loadDrafts,
    handleSizeChange,
    handlePageChange,

    // filter
    ...filter,

    // search
    ...search,
  }
}
