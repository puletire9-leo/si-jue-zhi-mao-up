<template>
  <div class="import-export">
    <el-row :gutter="20">
      <el-col
        :xs="24"
        :lg="12"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>产品导入导出</span>
            </div>
          </template>

          <el-tabs v-model="productActiveTab">
            <el-tab-pane
              label="导入产品"
              name="import"
            >
              <el-upload
                class="upload-area"
                drag
                :auto-upload="false"
                :show-file-list="false"
                accept=".xlsx,.xls"
                @change="handleProductImportChange"
              >
                <el-icon class="upload-icon">
                  <UploadFilled />
                </el-icon>
                <div class="upload-text">
                  <p>拖拽Excel文件到此处，或点击上传</p>
                  <p class="upload-tip">
                    支持 .xlsx、.xls 格式
                  </p>
                </div>
              </el-upload>

              <div
                v-if="productImportFile"
                class="file-info"
              >
                <el-icon><Document /></el-icon>
                <span>{{ productImportFile.name }}</span>
                <el-button
                  link
                  type="danger"
                  @click="productImportFile = null"
                >
                  移除
                </el-button>
              </div>

              <el-button
                type="primary"
                :loading="productImporting"
                :disabled="!productImportFile"
                class="action-button"
                @click="handleProductImport"
              >
                {{ productImporting ? '导入中...' : '开始导入' }}
              </el-button>

              <el-divider />

              <div class="template-section">
                <h4>没有模板？</h4>
                <el-button
                  type="success"
                  @click="downloadProductTemplate"
                >
                  <el-icon><Download /></el-icon>
                  下载导入模板
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane
              label="导出产品"
              name="export"
            >
              <el-form
                :model="productExportForm"
                label-width="100px"
              >
                <el-form-item label="SKU">
                  <el-input
                    v-model="productExportForm.sku"
                    placeholder="请输入SKU（可选）"
                    clearable
                  />
                </el-form-item>
                <el-form-item label="产品名称">
                  <el-input
                    v-model="productExportForm.name"
                    placeholder="请输入产品名称（可选）"
                    clearable
                  />
                </el-form-item>
                <el-form-item label="产品类型">
                  <el-select
                    v-model="productExportForm.type"
                    placeholder="请选择（可选）"
                    clearable
                    style="width: 100%"
                  >
                    <el-option
                      label="全部"
                      value=""
                    />
                    <el-option
                      label="普通产品"
                      value="普通产品"
                    />
                    <el-option
                      label="组合产品"
                      value="组合产品"
                    />
                    <el-option
                      label="定制产品"
                      value="定制产品"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="productExporting"
                    @click="handleProductExport"
                  >
                    <el-icon><Download /></el-icon>
                    导出产品数据
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <el-col
        :xs="24"
        :lg="12"
      >
        <el-card>
          <template #header>
            <div class="card-header">
              <span>图片导入导出</span>
            </div>
          </template>

          <el-tabs v-model="imageActiveTab">
            <el-tab-pane
              label="导入图片"
              name="import"
            >
              <el-upload
                class="upload-area"
                drag
                :auto-upload="false"
                :show-file-list="false"
                accept=".xlsx,.xls"
                @change="handleImageImportChange"
              >
                <el-icon class="upload-icon">
                  <UploadFilled />
                </el-icon>
                <div class="upload-text">
                  <p>拖拽Excel文件到此处，或点击上传</p>
                  <p class="upload-tip">
                    支持 .xlsx、.xls 格式
                  </p>
                </div>
              </el-upload>

              <div
                v-if="imageImportFile"
                class="file-info"
              >
                <el-icon><Document /></el-icon>
                <span>{{ imageImportFile.name }}</span>
                <el-button
                  link
                  type="danger"
                  @click="imageImportFile = null"
                >
                  移除
                </el-button>
              </div>

              <el-button
                type="primary"
                :loading="imageImporting"
                :disabled="!imageImportFile"
                class="action-button"
                @click="handleImageImport"
              >
                {{ imageImporting ? '导入中...' : '开始导入' }}
              </el-button>

              <el-divider />

              <div class="template-section">
                <h4>没有模板？</h4>
                <el-button
                  type="success"
                  @click="downloadImageTemplate"
                >
                  <el-icon><Download /></el-icon>
                  下载导入模板
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane
              label="导出图片"
              name="export"
            >
              <el-form
                :model="imageExportForm"
                label-width="100px"
              >
                <el-form-item label="关键词">
                  <el-input
                    v-model="imageExportForm.keyword"
                    placeholder="请输入关键词（可选）"
                    clearable
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="imageExporting"
                    @click="handleImageExport"
                  >
                    <el-icon><Download /></el-icon>
                    导出图片数据
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>

    <el-row
      :gutter="20"
      style="margin-top: 20px"
    >
      <el-col :xs="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>统计数据导出</span>
            </div>
          </template>

          <el-row :gutter="20">
            <el-col
              :xs="24"
              :sm="8"
            >
              <div class="export-item">
                <el-icon
                  class="export-icon"
                  color="#409eff"
                >
                  <DataAnalysis />
                </el-icon>
                <h4>仪表板统计</h4>
                <p>导出系统整体统计数据</p>
                <el-button
                  type="primary"
                  @click="handleStatisticsExport"
                >
                  导出
                </el-button>
              </div>
            </el-col>
            <el-col
              :xs="24"
              :sm="8"
            >
              <div class="export-item">
                <el-icon
                  class="export-icon"
                  color="#67c23a"
                >
                  <TrendCharts />
                </el-icon>
                <h4>趋势数据</h4>
                <p>导出产品和图片趋势</p>
                <el-button
                  type="success"
                  @click="handleTrendExport"
                >
                  导出
                </el-button>
              </div>
            </el-col>
            <el-col
              :xs="24"
              :sm="8"
            >
              <div class="export-item">
                <el-icon
                  class="export-icon"
                  color="#e6a23c"
                >
                  <FolderOpened />
                </el-icon>
                <h4>存储统计</h4>
                <p>导出存储空间使用情况</p>
                <el-button
                  type="warning"
                  @click="handleStorageExport"
                >
                  导出
                </el-button>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="importResultVisible"
      title="导入结果"
      width="600px"
    >
      <el-alert
        :title="`导入完成：成功 ${importResult.success} 条，失败 ${importResult.error} 条`"
        :type="importResult.error > 0 ? 'warning' : 'success'"
        :closable="false"
        style="margin-bottom: 20px"
      />

      <el-table
        v-if="importResult.errors && importResult.errors.length > 0"
        :data="importResult.errors"
        style="width: 100%"
        max-height="300"
      >
        <el-table-column
          prop="row"
          label="行号"
          width="80"
        />
        <el-table-column
          prop="sku"
          label="SKU"
          width="120"
        />
        <el-table-column
          prop="error"
          label="错误信息"
          show-overflow-tooltip
        />
      </el-table>

      <template #footer>
        <el-button @click="importResultVisible = false">
          关闭
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import {
  UploadFilled,
  Download,
  Document,
  DataAnalysis,
  TrendCharts,
  FolderOpened
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { importExportApi } from '@/api/import_export'

const productActiveTab = ref('import')
const imageActiveTab = ref('import')

const productImportFile = ref(null)
const imageImportFile = ref(null)

const productImporting = ref(false)
const imageImporting = ref(false)
const productExporting = ref(false)
const imageExporting = ref(false)

const productExportForm = reactive({
  sku: '',
  name: '',
  type: ''
})

const imageExportForm = reactive({
  keyword: ''
})

const importResultVisible = ref(false)
const importResult = reactive({
  success: 0,
  error: 0,
  errors: []
})

const handleProductImportChange = (file) => {
  const rawFile = file.raw
  
  if (!rawFile) return
  
  const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
  if (!validTypes.includes(rawFile.type)) {
    ElMessage.error('请上传Excel文件')
    return
  }
  
  productImportFile.value = rawFile
}

const handleImageImportChange = (file) => {
  const rawFile = file.raw
  
  if (!rawFile) return
  
  const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
  if (!validTypes.includes(rawFile.type)) {
    ElMessage.error('请上传Excel文件')
    return
  }
  
  imageImportFile.value = rawFile
}

const handleProductImport = async () => {
  if (!productImportFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  productImporting.value = true
  
  try {
    const result = await importExportApi.importProducts(productImportFile.value)
    Object.assign(importResult, result)
    importResultVisible.value = true
    ElMessage.success(`导入完成：成功 ${result.success} 条，失败 ${result.error} 条`)
    productImportFile.value = null
  } catch (error) {
    ElMessage.error('导入失败: ' + (error.message || '未知错误'))
  } finally {
    productImporting.value = false
  }
}

const handleImageImport = async () => {
  if (!imageImportFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  imageImporting.value = true
  
  try {
    const result = await importExportApi.importImages(imageImportFile.value)
    Object.assign(importResult, result)
    importResultVisible.value = true
    ElMessage.success(`导入完成：成功 ${result.success} 条，失败 ${result.error} 条`)
    imageImportFile.value = null
  } catch (error) {
    ElMessage.error('导入失败: ' + (error.message || '未知错误'))
  } finally {
    imageImporting.value = false
  }
}

const handleProductExport = async () => {
  productExporting.value = true
  
  try {
    const blob = await importExportApi.exportProducts(productExportForm)
    downloadFile(blob, 'products.xlsx')
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  } finally {
    productExporting.value = false
  }
}

const handleImageExport = async () => {
  imageExporting.value = true
  
  try {
    const blob = await importExportApi.exportImages(imageExportForm)
    downloadFile(blob, 'images.xlsx')
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  } finally {
    imageExporting.value = false
  }
}

const handleStatisticsExport = async () => {
  try {
    const blob = await importExportApi.exportStatistics()
    downloadFile(blob, 'statistics.xlsx')
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  }
}

const handleTrendExport = async () => {
  await handleStatisticsExport()
}

const handleStorageExport = async () => {
  await handleStatisticsExport()
}

const downloadProductTemplate = async () => {
  try {
    const blob = await importExportApi.downloadProductTemplate()
    downloadFile(blob, 'product_import_template.xlsx')
    ElMessage.success('模板下载成功')
  } catch (error) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'))
  }
}

const downloadImageTemplate = async () => {
  try {
    const blob = await importExportApi.downloadImageTemplate()
    downloadFile(blob, 'image_import_template.xlsx')
    ElMessage.success('模板下载成功')
  } catch (error) {
    ElMessage.error('下载失败: ' + (error.message || '未知错误'))
  }
}

const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped lang="scss">
.import-export {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-area {
  margin-bottom: 20px;

  :deep(.el-upload-dragger) {
    padding: 40px 20px;
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    transition: border-color 0.3s;

    &:hover {
      border-color: #409eff;
    }
  }

  .upload-icon {
    font-size: 48px;
    color: #409eff;
    margin-bottom: 16px;
  }

  .upload-text {
    p {
      margin: 8px 0;
      color: #606266;

      &.upload-tip {
        font-size: 12px;
        color: #909399;
      }
    }
  }
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 16px;

  span {
    flex: 1;
    font-size: 14px;
    color: #303133;
  }
}

.action-button {
  width: 100%;
  margin-bottom: 16px;
}

.template-section {
  text-align: center;

  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #606266;
  }
}

.export-item {
  text-align: center;
  padding: 24px;
  background: #f5f7fa;
  border-radius: 8px;
  transition: all 0.3s;

  &:hover {
    background: #e8f4ff;
    transform: translateY(-4px);
  }

  .export-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
    color: #303133;
  }

  p {
    margin: 0 0 16px 0;
    font-size: 14px;
    color: #606266;
  }
}
</style>
