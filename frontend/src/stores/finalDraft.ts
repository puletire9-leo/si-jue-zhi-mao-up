import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFinalDraftStore = defineStore('finalDraft', () => {
  // 是否需要刷新定稿列表的标记
  const needRefresh = ref<boolean>(false)

  /**
   * 设置需要刷新定稿列表
   * @param value 是否需要刷新
   */
  const setNeedRefresh = (value: boolean): void => {
    needRefresh.value = value
  }

  /**
   * 重置刷新状态
   */
  const resetRefreshStatus = (): void => {
    needRefresh.value = false
  }

  return {
    needRefresh,
    setNeedRefresh,
    resetRefreshStatus
  }
})
