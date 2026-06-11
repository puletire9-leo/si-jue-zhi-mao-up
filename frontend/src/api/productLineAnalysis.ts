/**
 * 品线分析 SSE 触发 + 结果查询 API
 * 选品 Agent 独立服务（端口 8011），前端通过 /selection-api 代理访问
 */
import request from '@/utils/request'

// ── SSE 事件类型 ──
export type SSEEventType =
  | 'start'
  | 'data_ready'
  | 'sub_start'
  | 'progress'
  | 'node_error'
  | 'sub_complete'
  | 'heartbeat'
  | 'writeback'
  | 'complete'
  | 'error'

export interface SSEEvent {
  event: SSEEventType
  data: Record<string, unknown>
}

// ── 分析结果摘要 ──
export interface AnalysisResultItem {
  nodeId: string
  bsrId: string
  nodeName: string
  recommendLevel: string
  opportunityScore: number
  analysisReport: Record<string, unknown>
  confidence: number
  errors: string[]
}

// ── 完成事件 ──
export interface AnalysisCompleteEvent {
  batch_id: string
  total_sub_categories: number
  total_elapsed_ms: number
  errors_count: number
  writeback_ok: boolean
  processing_time_ms: number
  results_summary: Array<{
    nodeName: string
    recommendLevel: string
    opportunityScore: number
  }>
}

// ── SSE 事件类型列表 ──
const SSE_EVENT_TYPES: SSEEventType[] = [
  'start', 'data_ready', 'sub_start', 'progress',
  'node_error', 'sub_complete', 'heartbeat', 'writeback',
  'complete', 'error'
]

/**
 * 启动品线分析（SSE 流式）
 *
 * @param batchId    批次ID
 * @param marketplace 站点 UK/DE/US
 * @param onEvent    每次收到 SSE 事件的回调
 * @param onError    SSE 连接出错回调
 * @param onComplete 完成或出错后关闭回调
 * @returns EventSource 实例（可手动 close）
 */
export function startProductLineAnalysis(
  batchId: string,
  marketplace: string = 'UK',
  onEvent: (event: SSEEventType, data: Record<string, unknown>) => void,
  onError?: (error: Event) => void,
  onComplete?: () => void,
): EventSource {
  const url =
    `/selection-api/selection/analyze?batch_id=${encodeURIComponent(batchId)}` +
    `&marketplace=${encodeURIComponent(marketplace)}`

  const evtSource = new EventSource(url)

  SSE_EVENT_TYPES.forEach((type) => {
    evtSource.addEventListener(type, (e: MessageEvent) => {
      let data: Record<string, unknown> = {}
      try {
        data = JSON.parse((e as MessageEvent).data)
      } catch {
        data = { raw: (e as MessageEvent).data }
      }
      onEvent(type, data)
      if (type === 'complete' || type === 'error') {
        evtSource.close()
        onComplete?.()
      }
    })
  })

  evtSource.onerror = (e) => {
    onError?.(e)
    evtSource.close()
  }

  return evtSource
}

/**
 * 查询已有分析结果（走 Java 后端）
 */
export function getAnalysisGuidance(params?: {
  batchId?: string
  bsrId?: string
  marketplace?: string
}) {
  return request.get('/api/v1/product-line/guidance', { params })
}
