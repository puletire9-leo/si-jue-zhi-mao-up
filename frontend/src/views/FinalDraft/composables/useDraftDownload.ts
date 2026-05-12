import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { formatFilename } from '@/utils/download'
import { ImageUrlUtil } from '@/utils/imageUrlUtil'

export interface Draft {
  id: number
  sku: string
  images: string[]
  reference_images: string[]
  infringementLabel?: string
  status: 'finalized' | 'optimizing' | 'concept'
}

// Shared progress state across download operations
export const showProgress = ref(false)
export const downloadProgress = ref(0)
export const downloadStatus = ref<'success' | 'exception' | 'warning'>()
export const progressText = ref('')

// File naming state
export const fileNameDialogVisible = ref(false)
export const isBatchDownload = ref(false)
export const currentDownloadDraft = ref<Draft | null>(null)
export const currentDownloadDrafts = ref<Draft[]>([])

/**
 * Collect download file entries from a draft's images and reference_images
 */
export function collectFilesFromDraft(
  draft: Draft,
  includeInfringementLabel = false,
): Array<{ url: string; filename: string }> {
  const files: Array<{ url: string; filename: string }> = []
  const infringementPart = includeInfringementLabel && draft.infringementLabel
    ? `-${draft.infringementLabel}`
    : ''

  if (draft.images) {
    draft.images.forEach((img, i) => {
      const indexSuffix = i > 0 ? `-${i + 1}` : ''
      files.push({
        url: ImageUrlUtil.getOriginalUrl(img),
        filename: formatFilename(`设计稿-${draft.sku}${infringementPart}${indexSuffix}.jpg`),
      })
    })
  }

  if (draft.reference_images) {
    draft.reference_images.forEach((img, i) => {
      const indexSuffix = i > 0 ? `-${i + 1}` : ''
      files.push({
        url: ImageUrlUtil.getOriginalUrl(img),
        filename: formatFilename(`效果图-${draft.sku}${infringementPart}${indexSuffix}.jpg`),
      })
    })
  }

  return files
}

/**
 * Make the ZIP download request and handle progress/results
 */
export async function requestZipDownload(files: Array<{ url: string; filename: string }>, zipFilename: string): Promise<void> {
  showProgress.value = true
  downloadProgress.value = 0
  downloadStatus.value = undefined
  progressText.value = '准备下载...'

  const token = localStorage.getItem('token')

  const response = await fetch('/api/v1/final-drafts/download-zip', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify({ files, filename: zipFilename }),
  })

  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const result = await response.json()
  if (!result.success) throw new Error(result.message || '下载失败')

  const failedCount = result.data?.failed_count || 0
  const failedFiles = result.data?.failed_files || []

  downloadProgress.value = 100
  downloadStatus.value = failedCount > 0 ? 'warning' : 'success'
  progressText.value = failedCount > 0 ? '任务已创建，部分文件失败' : '任务创建成功'

  setTimeout(() => { showProgress.value = false }, 2000)

  if (failedCount > 0) {
    const failedSkuList = [...new Set(
      failedFiles.map((f: { filename: string }) => {
        const m = f.filename.match(/(?:设计稿|效果图)-(.*?)[.-]/)
        return m?.[1] ?? '?'
      })
    )].join(', ')
    ElMessage.warning(`部分SKU下载失败: ${failedSkuList}。请前往下载中心查看详情。`)
  } else {
    ElMessage.success('下载任务已创建，请前往下载中心查看')
  }
}
