import request from '@/utils/request'

/** 八爪鱼周表原始行 */
export interface BazhuayuRawRow {
  id: number
  marketplace: string
  asin: string
  price: string | null
  reviews: string | null
  title: string | null
  weekTag: string
  lotNo: string | null
  scrapedAt: string
}

/** 分页响应（后端手动分页） */
export interface PageResp<T> {
  records: T[]
  total: number
  size: number
  current: number
}

/** 自动初筛任务（asin_import_tasks 的子集） */
export interface BazhuayuTask {
  id: number
  marketplace: string
  importType: string
  taskStatus: string
  totalCount: number
  passCount: number
  priceFailCount: number
  reviewFailCount: number
  duplicateCount: number
  skipCount: number
  batchTotal: number
  batchCurrent: number
  apiSuccess: number
  apiFail: number
  dataMonth: string | null
  createdAt: string
}

export const bazhuayuApi = {
  /** 手动触发一次采集+初筛（异步） */
  trigger(marketplace?: string): Promise<{ status: string; marketplace: string }> {
    return request({
      url: '/api/v1/modules/bazhuayu/trigger',
      method: 'post',
      params: marketplace ? { marketplace } : {}
    })
  },

  /** 分页查询本周原始采集数据 */
  weeklyRaw(page = 1, size = 50, marketplace?: string): Promise<PageResp<BazhuayuRawRow>> {
    return request({
      url: '/api/v1/modules/bazhuayu/weekly-raw',
      method: 'get',
      params: { page, size, marketplace }
    })
  },

  /** 本周自动初筛任务列表 */
  latestTasks(): Promise<BazhuayuTask[]> {
    return request({ url: '/api/v1/modules/bazhuayu/latest-tasks', method: 'get' })
  },

  /** 更新任务组→站点→任务ID 映射 */
  updateMapping(mapping: Record<string, Record<string, string>>): Promise<void> {
    return request({
      url: '/api/v1/modules/bazhuayu/config/mapping',
      method: 'put',
      data: { mapping }
    })
  }
}
