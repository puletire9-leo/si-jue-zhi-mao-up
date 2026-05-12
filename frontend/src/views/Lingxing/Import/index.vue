<template>
  <div class="lingxing-import-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">导入领星</h2>
      <p class="page-desc">从领星系统导入产品数据到本平台</p>
    </div>

    <!-- 主要内容区域 -->
    <el-card class="import-card">
      <template #header>
        <div class="card-header">
          <span>数据导入</span>
          <el-button type="primary" link @click="handleDownloadTemplate">
            <el-icon><Download /></el-icon>
            下载模板
          </el-button>
        </div>
      </template>

      <!-- 导入步骤 -->
      <el-steps :active="activeStep" finish-status="success" class="import-steps">
        <el-step title="选择文件" description="上传领星数据文件" />
        <el-step title="数据预览" description="预览并编辑导入数据" />
        <el-step title="生成文件" description="生成领星导入文件" />
      </el-steps>

      <!-- 步骤1：文件上传 -->
      <div v-if="activeStep === 0" class="step-content">
        <el-upload
          class="upload-area"
          drag
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :file-list="fileList"
          accept=".xlsx,.xls,.csv"
        >
          <el-icon class="upload-icon"><Upload /></el-icon>
          <div class="upload-text">
            <em>点击上传</em> 或拖拽文件到此处
          </div>
          <template #tip>
            <div class="upload-tip">
              支持 Excel (.xlsx, .xls) 或 CSV 格式文件<br>
              必需字段：SKU、产品名称
            </div>
          </template>
        </el-upload>

        <div class="step-actions">
          <el-button
            type="primary"
            :disabled="fileList.length === 0 || parsing"
            :loading="parsing"
            @click="handleNextStep"
          >
            {{ parsing ? '解析中...' : '下一步' }}
          </el-button>
        </div>
      </div>

      <!-- 步骤2：数据预览 -->
      <div v-if="activeStep === 1" class="step-content">
        <el-alert
          title="数据预览"
          description="请确认以下数据是否正确，点击单元格可直接编辑，确认后将导入系统"
          type="info"
          show-icon
          :closable="false"
          class="preview-alert"
        />

        <!-- 开发人选择区域 -->
        <div class="developer-select-area">
          <el-button type="primary" @click="openDeveloperDialog">
            <el-icon><User /></el-icon>
            选择开发人
          </el-button>
          <span v-if="selectedDeveloper" class="selected-developer">
            当前开发人：<el-tag type="success">{{ selectedDeveloper }}</el-tag>
          </span>
        </div>

        <!-- 导入日志显示区域 -->
        <div v-if="importLogs.length > 0" class="import-logs">
          <div class="logs-header">
            <span>导入过程日志</span>
            <el-button type="primary" link size="small" @click="clearLogs">清除</el-button>
          </div>
          <div class="logs-content">
            <div v-for="(log, index) in importLogs" :key="index" class="log-item" :class="log.type">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>

        <!-- 产品列表表格 -->
        <ProductTable
          ref="productTableRef"
          v-model:data="previewData"
          :loading="false"
          @delete="handleRowDelete"
          @image-upload="handleImageUpload"
        />

        <div class="step-actions">
          <el-button @click="handlePrevStep">上一步</el-button>
          <el-button type="primary" @click="handleNextStep">下一步</el-button>
        </div>
      </div>

      <!-- 步骤3：生成导入文件 -->
      <div v-if="activeStep === 2" class="step-content">
        <div v-if="importStatus === 'success'" class="result-success">
          <el-icon class="result-icon"><CircleCheck /></el-icon>
          <h3>生成成功</h3>
          <p>已成功生成领星导入文件，共 {{ importResult.successCount }} 条数据</p>
        </div>

        <div v-else-if="importStatus === 'error'" class="result-error">
          <el-icon class="result-icon"><CircleClose /></el-icon>
          <h3>生成失败</h3>
          <p>{{ importResult.errorMessage }}</p>
        </div>

        <div v-else class="result-importing">
          <el-icon class="loading-icon"><Loading /></el-icon>
          <h3>正在生成导入文件...</h3>
          <p>请稍候，正在生成领星导入文件</p>
        </div>

        <div class="step-actions">
          <el-button @click="handleReset">重新生成</el-button>
          <el-button type="primary" @click="handleFinish">完成</el-button>
        </div>
      </div>
    </el-card>

    <!-- 导入记录 -->
    <el-card class="history-card">
      <template #header>
        <div class="card-header">
          <span>导入记录</span>
          <el-button type="primary" link @click="loadImportHistory">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </template>

      <el-table :data="importHistory" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="fileName" label="文件名" min-width="200" />
        <el-table-column prop="recordCount" label="记录数" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="导入时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleViewDetail(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 选择开发人对话框 -->
    <el-dialog
      v-model="showDeveloperDialog"
      title="选择开发人"
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="developer-list">
        <div
          v-for="dev in developerList"
          :key="dev"
          class="developer-item"
          :class="{ active: selectedDeveloper === dev }"
          @click="selectedDeveloper = dev"
        >
          <div class="developer-info">
            <span class="developer-name">{{ dev }}</span>
          </div>
          <el-icon v-if="selectedDeveloper === dev" class="check-icon"><Check /></el-icon>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showDeveloperDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmDeveloper" :disabled="!selectedDeveloper">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 领星导入页面组件
 * 提供领星数据导入功能，支持Excel文件上传、解析、数据预览和导入记录查看
 */
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload,
  CircleCheck,
  CircleClose,
  Loading,
  Refresh,
  Download,
  User,
  Check
} from '@element-plus/icons-vue'
import type { UploadFile, UploadFiles } from 'element-plus'
import * as XLSX from 'xlsx'
import ProductTable from './components/ProductTable.vue'
import { uploadLingxingImage } from '@/api/lingxing'
import { extractImagesFromExcel, uint8ArrayToFile } from './utils/excelImageExtractor'

// 路由实例
const router = useRouter()

// 当前步骤
const activeStep = ref(0)

// 文件列表
const fileList = ref<UploadFile[]>([])

// 解析状态
const parsing = ref(false)

// 预览数据
const previewData = ref<any[]>([])

// 产品表格引用
const productTableRef = ref<InstanceType<typeof ProductTable> | null>(null)

// 导入状态
const importStatus = ref<'idle' | 'importing' | 'success' | 'error'>('idle')
const importResult = reactive({
  successCount: 0,
  errorMessage: ''
})

// 导入历史记录
const importHistory = ref<any[]>([])

// 导入日志
interface ImportLog {
  time: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}
const importLogs = ref<ImportLog[]>([])

/**
 * 添加导入日志
 * @param message 日志消息
 * @param type 日志类型
 */
const addLog = (message: string, type: ImportLog['type'] = 'info') => {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
  importLogs.value.push({ time, message, type })
}

/**
 * 清除日志
 */
const clearLogs = () => {
  importLogs.value = []
}

// 分页配置
const pagination = reactive({
  page: 1,
  pageSize: 10,
  total: 0
})

// 开发人选择
const showDeveloperDialog = ref(false)
const selectedDeveloper = ref('')
const developerList = ref<string[]>([])

/**
 * 获取开发人列表
 */
const fetchDeveloperList = async () => {
  try {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/v1/system-config/developer-list', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (response.ok) {
      const result = await response.json()
      if (result.code === 200 && result.data) {
        developerList.value = result.data.developerList || []
      }
    }
  } catch (error) {
    console.error('获取开发人列表失败:', error)
  }
}

/**
 * Excel字段映射配置
 * 支持多种可能的列名变体
 */
const fieldMapping: Record<string, string[]> = {
  sku: ['SKU', 'sku', 'Sku', '产品SKU', '产品编码'],
  productName: ['产品名称', '名称', 'name', 'Name', '产品名', '商品名称'],
  length: ['长cm', '长(cm)', '长', '长度', 'length', 'Length', '长(CM)'],
  width: ['宽cm', '宽(cm)', '宽', '宽度', 'width', 'Width', '宽(CM)'],
  height: ['高cm', '高(cm)', '高', '高度', 'height', 'Height', '高(CM)'],
  weight: ['毛重（kg）', '毛重(kg)', '毛重', '重量', 'weight', 'Weight', 'kg'],
  purchaseCost: ['采购费用', '采购价', '成本', 'cost', 'Cost', '采购成本'],
  supplierLink: ['供应商链接', '链接', 'link', 'Link', '采购链接'],
  supplier: ['供应商', '供货方', 'supplier', 'Supplier'],
  ukCustomsCode: ['英国海关编码', '海关编码', 'customsCode', 'HS编码'],
  cnDeclarationName: ['中文报关名', '中文品名', 'cnName'],
  enDeclarationName: ['英文报关名', '英文品名', 'enName'],
  imageUrl: ['图片url', '图片URL', '图片地址', 'imageUrl', '图片', '图片链接']
}

/**
 * 必需字段列表
 */
const requiredFields = ['sku', 'productName']

/**
 * 确认选择开发人
 */
const confirmDeveloper = () => {
  if (selectedDeveloper.value) {
    showDeveloperDialog.value = false
    ElMessage.success(`已选择开发人: ${selectedDeveloper.value}`)
  }
}

/**
 * 打开开发人选择对话框
 */
const openDeveloperDialog = async () => {
  await fetchDeveloperList()
  showDeveloperDialog.value = true
}

/**
 * 处理文件选择变化
 * @param uploadFile 上传的文件
 * @param uploadFiles 文件列表
 */
const handleFileChange = (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  fileList.value = uploadFiles
  ElMessage.success(`已选择文件: ${uploadFile.name}`)
}

/**
 * 处理文件移除
 * @param uploadFile 被移除的文件
 * @param uploadFiles 剩余文件列表
 */
const handleFileRemove = (uploadFile: UploadFile, uploadFiles: UploadFiles) => {
  fileList.value = uploadFiles
}

/**
 * 进入下一步
 */
const handleNextStep = async () => {
  if (activeStep.value === 0) {
    await parseExcelFile()
    if (!parsing.value && previewData.value.length > 0) {
      activeStep.value++
    }
  } else if (activeStep.value === 1) {
    await executeImport()
  }
}

/**
 * 返回上一步
 */
const handlePrevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value--
    if (activeStep.value === 0) {
      previewData.value = []
    }
  }
}

/**
 * 将Excel表头映射到字段
 * @param headers Excel表头数组
 * @returns 字段映射对象
 */
const mapHeadersToFields = (headers: string[]): Record<string, string> => {
  const fieldMap: Record<string, string> = {}

  headers.forEach((header, index) => {
    const headerStr = String(header).trim()

    for (const [field, possibleNames] of Object.entries(fieldMapping)) {
      if (possibleNames.some(name => name.toLowerCase() === headerStr.toLowerCase())) {
        fieldMap[index] = field
        break
      }
    }
  })

  return fieldMap
}

/**
 * 检查必需字段是否存在
 * @param fieldMap 字段映射对象
 * @returns 缺失的字段列表
 */
const checkRequiredFields = (fieldMap: Record<string, string>): string[] => {
  const mappedFields = Object.values(fieldMap)
  return requiredFields.filter(field => !mappedFields.includes(field))
}

/**
 * 解析数值
 * @param value 原始值
 * @param precision 小数精度
 * @returns 解析后的数值
 */
const parseNumericValue = (value: any, precision: number): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  const num = parseFloat(String(value))
  if (isNaN(num)) {
    return undefined
  }

  return parseFloat(num.toFixed(precision))
}

/**
 * 解析数据行
 * @param rows 数据行数组
 * @param fieldMap 字段映射对象
 * @returns 解析后的数据数组
 */
const parseDataRows = (rows: any[][], fieldMap: Record<string, string>): any[] => {
  const result: any[] = []

  rows.forEach((row, rowIndex) => {
    const rowData: Record<string, any> = {}

    Object.entries(fieldMap).forEach(([colIndex, field]) => {
      const value = row[parseInt(colIndex)]

      switch (field) {
        case 'length':
        case 'width':
        case 'height':
          rowData[field] = parseNumericValue(value, 2)
          break
        case 'weight':
          rowData[field] = parseNumericValue(value, 3)
          break
        case 'purchaseCost':
          rowData[field] = parseNumericValue(value, 2)
          break
        default:
          rowData[field] = value !== undefined ? String(value).trim() : ''
      }
    })

    // 只添加有SKU和产品名称的行
    if (rowData.sku || rowData.productName) {
      result.push(rowData)
    }
  })

  return result
}

/**
 * 解析Excel文件
 */
const parseExcelFile = async () => {
  if (fileList.value.length === 0) {
    ElMessage.warning('请先选择文件')
    return
  }

  parsing.value = true
  const file = fileList.value[0].raw

  if (!file) {
    ElMessage.error('文件读取失败')
    parsing.value = false
    return
  }

  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })

    // 获取第一个工作表
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]

    // 转换为JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (jsonData.length < 2) {
      ElMessage.error('Excel文件数据不足，至少需要包含表头和一行数据')
      parsing.value = false
      return
    }

    // 解析表头
    const headers = jsonData[0] as string[]
    const fieldMap = mapHeadersToFields(headers)

    // 检查必需字段
    const missingFields = checkRequiredFields(fieldMap)
    if (missingFields.length > 0) {
      ElMessage.error(`缺少必需字段: ${missingFields.join(', ')}`)
      parsing.value = false
      return
    }

    // 解析数据行
    const parsedData = parseDataRows(jsonData.slice(1), fieldMap)

    if (parsedData.length === 0) {
      ElMessage.error('未能解析到有效数据')
      parsing.value = false
      return
    }

    // 先设置预览数据
    previewData.value = parsedData
    ElMessage.success(`成功解析 ${parsedData.length} 条数据`)

    // 尝试从Excel中提取嵌入的图片
    await extractAndUploadImagesFromExcel(data, parsedData)
  } catch (error) {
    console.error('Excel解析错误:', error)
    ElMessage.error('Excel文件解析失败，请检查文件格式是否正确')
    throw error
  } finally {
    parsing.value = false
  }
}

/**
 * 从Excel中提取图片并上传
 * 使用SKU进行匹配，确保图片与正确的数据行对应
 * @param arrayBuffer Excel文件数据
 * @param parsedData 解析后的数据行
 */
const extractAndUploadImagesFromExcel = async (arrayBuffer: ArrayBuffer, parsedData: any[]) => {
  try {
    clearLogs()
    addLog('开始提取Excel中的图片（按视觉顺序）...', 'info')

    // 提取图片（SKU列索引为4，即E列）
    const images = await extractImagesFromExcel(arrayBuffer, 4)

    if (images.length === 0) {
      addLog('Excel中没有找到嵌入的图片', 'warning')
      return
    }

    addLog(`找到 ${images.length} 张图片，开始处理...`, 'info')

    // 显示提取的图片信息（按视觉顺序）
    images.forEach((img, idx) => {
      addLog(`视觉顺序${img.visualOrder}: Excel第${img.row + 1}行, SKU=${img.sku || '无'}, 文件名=${img.filename}`, 'info')
    })

    // 关键修改：按视觉顺序直接匹配到对应的数据行索引
    // 第1个视觉图片 -> 第0行数据（第1行数据）
    // 第2个视觉图片 -> 第1行数据（第2行数据）
    // 以此类推...

    addLog('按视觉顺序匹配图片到数据行...', 'info')

    // 上传每张图片
    let successCount = 0
    let skipCount = 0

    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      // 按视觉顺序直接匹配：第i个图片对应第i行数据
      const rowIndex = i
      const visualOrder = image.visualOrder || (i + 1)

      if (rowIndex >= parsedData.length) {
        skipCount++
        addLog(`[跳过] 视觉顺序${visualOrder} 超出数据行范围`, 'warning')
        continue
      }

      const targetSku = parsedData[rowIndex]?.sku
      addLog(`[匹配] 视觉顺序${visualOrder} -> 数据行${rowIndex}, 图片SKU:${image.sku}, 目标SKU:${targetSku}`, 'success')

      try {
        // 将图片数据转换为File对象
        const file = uint8ArrayToFile(image.imageData, image.filename, image.mimeType)

        // 上传图片
        addLog(`[上传] 视觉顺序${visualOrder} 开始上传...`, 'info')
        const response = await uploadLingxingImage(file)

        if (response.code === 200 && response.data?.url) {
          // 更新对应行的图片信息
          const newData = JSON.parse(JSON.stringify(previewData.value))
          if (newData[rowIndex]) {
            newData[rowIndex] = {
              ...newData[rowIndex],
              imageUrl: response.data.url,
              cosImageUrl: response.data.url,
              fileCode: response.data.object_key
            }
            previewData.value = newData
            successCount++
            addLog(`[上传成功] 数据行 ${rowIndex} (视觉顺序${visualOrder})`, 'success')
          }
        } else {
          addLog(`[上传失败] 视觉顺序${visualOrder}, 响应码: ${response.code}`, 'error')
        }
      } catch (error) {
        addLog(`[上传错误] 视觉顺序${visualOrder}: ${error}`, 'error')
      }
    }

    addLog(`[统计] 总图片: ${images.length}, 跳过: ${skipCount}, 上传成功: ${successCount}`, 'info')

    if (successCount > 0) {
      ElMessage.success(`成功上传 ${successCount} 张图片`)
    }
  } catch (error) {
    addLog('提取并上传图片失败', 'error')
    ElMessage.error('提取Excel图片失败')
  }
}

/**
 * 执行数据导入 - 调用后端生成领星导入文件
 */
const executeImport = async () => {
  importStatus.value = 'importing'

  // 检查是否选择了开发人
  if (!selectedDeveloper.value) {
    ElMessage.warning('请先选择开发人')
    importStatus.value = 'idle'
    showDeveloperDialog.value = true
    return
  }

  try {
    const token = localStorage.getItem('token')

    // 转换数据格式为Python脚本期望的列名
    const fieldMapping: Record<string, string> = {
      'sku': 'SKU',
      'productName': '产品名称',
      'length': '长cm',
      'width': '宽cm',
      'height': '高cm',
      'weight': '毛重（kg）',
      'purchaseCost': '采购费用',
      'supplierLink': '供应商链接',
      'supplier': '供应商',
      'ukCustomsCode': '英国海关编码',
      'cnDeclarationName': '中文报关名',
      'enDeclarationName': '英文报关名',
      'imageUrl': '图片url'
    }

    const convertedData = previewData.value.map(row => {
      const newRow: Record<string, any> = {}
      for (const [key, value] of Object.entries(row)) {
        const newKey = fieldMapping[key] || key
        newRow[newKey] = value
      }
      return newRow
    })

    const requestBody = {
      developer: selectedDeveloper.value,
      file_data: convertedData
    }

    const response = await fetch('/api/v1/lingxing/generate-import-file', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: '生成文件失败' }))
      if (response.status === 401) {
        ElMessage.error('登录已过期，请重新登录')
        importStatus.value = 'error'
        importResult.errorMessage = '登录已过期'
        return
      }
      throw new Error(errorData.detail || '生成文件失败')
    }

    // 获取文件名
    const contentDisposition = response.headers.get('content-disposition')
    let filename = '导入领星表.xlsx'
    if (contentDisposition) {
      const utf8Matches = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/)
      if (utf8Matches) {
        filename = decodeURIComponent(utf8Matches[1])
      } else {
        const matches = contentDisposition.match(/filename="(.+?)"/)
        if (matches) {
          filename = matches[1]
        }
      }
    }

    // 获取文件blob并下载
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    importStatus.value = 'success'
    importResult.successCount = previewData.value.length
    ElMessage.success('领星导入文件生成成功')

    activeStep.value++
  } catch (error: any) {
    console.error('生成文件失败:', error)
    importStatus.value = 'error'
    importResult.errorMessage = error.message || '生成文件过程中发生错误'
    ElMessage.error(error.message || '生成文件失败')
  }
}

/**
 * 重置导入流程
 */
const handleReset = () => {
  activeStep.value = 0
  fileList.value = []
  previewData.value = []
  importStatus.value = 'idle'
}

/**
 * 完成导入
 */
const handleFinish = () => {
  handleReset()
  loadImportHistory()
}

/**
 * 加载导入历史记录
 */
const loadImportHistory = async () => {
  try {
    importHistory.value = [
      {
        id: 1,
        fileName: '领星数据_20240301.xlsx',
        recordCount: 150,
        status: 'success',
        createTime: '2024-03-01 10:30:00'
      },
      {
        id: 2,
        fileName: '领星数据_20240228.xlsx',
        recordCount: 89,
        status: 'success',
        createTime: '2024-02-28 15:20:00'
      }
    ]
    pagination.total = importHistory.value.length
  } catch (error) {
    ElMessage.error('加载导入记录失败')
  }
}

/**
 * 获取状态标签类型
 * @param status 状态值
 * @returns 标签类型
 */
const getStatusType = (status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const typeMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    success: 'success',
    error: 'danger',
    pending: 'warning'
  }
  return typeMap[status] || 'info'
}

/**
 * 获取状态显示文本
 * @param status 状态值
 * @returns 状态文本
 */
const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    success: '成功',
    error: '失败',
    pending: '处理中'
  }
  return textMap[status] || status
}

/**
 * 查看导入详情
 * @param row 导入记录行数据
 */
const handleViewDetail = (row: any) => {
  ElMessageBox.alert(
    `文件名: ${row.fileName}\n记录数: ${row.recordCount}\n状态: ${getStatusText(row.status)}\n导入时间: ${row.createTime}`,
    '导入详情',
    { confirmButtonText: '确定' }
  )
}

/**
 * 处理分页大小变化
 * @param size 每页条数
 */
const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  loadImportHistory()
}

/**
 * 处理页码变化
 * @param page 当前页码
 */
const handlePageChange = (page: number) => {
  pagination.page = page
  loadImportHistory()
}

/**
 * 处理下载模板
 */
const handleDownloadTemplate = async () => {
  try {
    const token = localStorage.getItem('token')

    const response = await fetch('/api/v1/lingxing/download-template', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      if (response.status === 401) {
        ElMessage.error('登录已过期，请重新登录')
        return
      }
      throw new Error('下载模板失败')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '产品汇总表-模版.xlsx'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('模板下载成功')
  } catch (error) {
    console.error('下载模板失败:', error)
    ElMessage.error('模板下载失败，请重试')
  }
}

/**
 * 处理行删除
 * @param index 行索引
 */
const handleRowDelete = (index: number) => {
  console.log('删除行:', index)
}

/**
 * 处理图片上传
 * @param file 上传的文件
 * @param index 行索引
 */
const handleImageUpload = async (file: UploadFile, index: number) => {
  if (!file.raw) {
    ElMessage.error('文件不存在')
    return
  }

  try {
    ElMessage.info('正在上传图片...')

    const response = await uploadLingxingImage(file.raw)

    if (response.code === 200 && response.data?.url) {
      const newData = [...previewData.value]
      newData[index] = {
        ...newData[index],
        imageUrl: response.data.url,
        cosImageUrl: response.data.url,
        fileCode: response.data.object_key
      }
      previewData.value = newData
      ElMessage.success('图片上传成功')
    } else {
      ElMessage.error(response.message || '图片上传失败')
    }
  } catch (error) {
    console.error('图片上传失败:', error)
    ElMessage.error('图片上传失败，请重试')
  }
}

// 组件挂载时加载导入历史
onMounted(() => {
  loadImportHistory()
  fetchDeveloperList()
})
</script>

<style scoped lang="scss">
.lingxing-import-page {
  padding: 20px;

  .page-header {
    margin-bottom: 20px;

    .page-title {
      font-size: 24px;
      font-weight: 600;
      color: #303133;
      margin: 0 0 8px 0;
    }

    .page-desc {
      font-size: 14px;
      color: #909399;
      margin: 0;
    }
  }

  .import-card {
    margin-bottom: 20px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .import-steps {
      margin: 30px 0;
    }

    .step-content {
      padding: 20px 0;

      .upload-area {
        width: 100%;

        :deep(.el-upload-dragger) {
          width: 100%;
          height: 200px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .upload-icon {
          font-size: 48px;
          color: #409eff;
          margin-bottom: 16px;
        }

        .upload-text {
          font-size: 16px;
          color: #606266;

          em {
            color: #409eff;
            font-style: normal;
          }
        }

        .upload-tip {
          margin-top: 16px;
          font-size: 12px;
          color: #909399;
          text-align: center;
          line-height: 1.6;
        }
      }

      .preview-alert {
        margin-bottom: 20px;
      }

      .result-success,
      .result-error,
      .result-importing {
        text-align: center;
        padding: 40px 0;

        .result-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }

        .loading-icon {
          font-size: 64px;
          margin-bottom: 16px;
          animation: rotating 2s linear infinite;
        }

        h3 {
          font-size: 20px;
          margin: 0 0 8px 0;
        }

        p {
          color: #909399;
          margin: 0;
        }
      }

      .result-success .result-icon {
        color: #67c23a;
      }

      .result-error .result-icon {
        color: #f56c6c;
      }

      .result-importing .loading-icon {
        color: #409eff;
      }

      @keyframes rotating {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    }

    .step-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ebeef5;
    }

    .developer-select-area {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 16px;
      background-color: #f5f7fa;
      border-radius: 8px;

      .selected-developer {
        font-size: 14px;
        color: #606266;
      }
    }

    .import-logs {
      margin-bottom: 20px;
      border: 1px solid #ebeef5;
      border-radius: 8px;
      background-color: #fafafa;
      max-height: 300px;
      overflow: hidden;

      .logs-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background-color: #f5f7fa;
        border-bottom: 1px solid #ebeef5;
        font-weight: 600;
        font-size: 14px;
        color: #606266;
      }

      .logs-content {
        max-height: 250px;
        overflow-y: auto;
        padding: 8px 0;

        .log-item {
          display: flex;
          padding: 4px 16px;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          line-height: 1.5;

          &:hover {
            background-color: #f0f0f0;
          }

          .log-time {
            color: #909399;
            margin-right: 12px;
            min-width: 85px;
          }

          .log-message {
            flex: 1;
            word-break: break-all;
          }

          &.info {
            color: #606266;
          }

          &.success {
            color: #67c23a;
          }

          &.warning {
            color: #e6a23c;
          }

          &.error {
            color: #f56c6c;
          }
        }
      }
    }
  }

  .history-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .pagination-wrapper {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
  }
}

// 开发人选择对话框样式
:deep(.developer-list) {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: 12px;
  padding: 10px 0;

  .developer-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border: 2px solid #e4e7ed;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: #409eff;
      background-color: #f5f7fa;
    }

    &.active {
      border-color: #409eff;
      background-color: #ecf5ff;
    }

    .developer-info {
      .developer-name {
        font-size: 16px;
        font-weight: 500;
        color: #303133;
      }
    }

    .check-icon {
      color: #409eff;
      font-size: 20px;
    }
  }
}

:deep(.dialog-footer) {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
