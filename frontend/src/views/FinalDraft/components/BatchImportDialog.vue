<template>
  <el-dialog
    v-model="dialogVisible"
    title="批量导入设计稿"
    width="800px"
    :before-close="handleClose"
  >
    <div class="batch-import-dialog">
      <!-- 上传区域 -->
      <div class="upload-section">
        <!-- 设计稿上传 -->
        <div class="upload-item">
          <h4>设计稿上传</h4>
          <el-upload
            ref="uploadRef"
            :file-list="fileList"
            @update:file-list="handleFileListUpdate"
            action="#"
            list-type="text"
            :auto-upload="false"
            :multiple="true"
            :limit="100"
            :on-exceed="handleExceed"
            :on-change="handleChange"
            :on-remove="handleRemove"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            class="upload-component"
            :drag="true"
          >
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，最大{{ imageSettings.maxImageSize }}MB</div>
          </el-upload>
        </div>
        
        <!-- 效果图上传 -->
        <div class="upload-item">
          <h4>效果图上传</h4>
          <el-upload
            ref="referenceUploadRef"
            :file-list="referenceFileList"
            @update:file-list="handleReferenceFileListUpdate"
            action="#"
            list-type="text"
            :auto-upload="false"
            :multiple="true"
            :limit="100"
            :on-exceed="handleExceed"
            :on-change="handleReferenceChange"
            :on-remove="handleReferenceRemove"
            :before-upload="beforeUpload"
            :http-request="handleUpload"
            class="upload-component"
            :drag="true"
          >
            <el-icon class="upload-icon"><Plus /></el-icon>
            <div class="el-upload__text">拖拽图片到此处或 <em>点击上传</em></div>
            <div class="el-upload__tip">支持JPG、PNG格式，最大{{ imageSettings.maxImageSize }}MB。系统将通过文件名匹配对应的设计稿</div>
          </el-upload>
        </div>
      </div>
      
      <!-- 导入设置 -->
      <div class="settings-section">
        <el-form-item label="批次" prop="batch">
          <el-date-picker
            v-model="settings.batch"
            type="date"
            placeholder="选择批次日期"
            format="YYYYMMDD"
            value-format="YYYYMMDD"
            class="date-picker"
            @change="handleDateChange"
          />
        </el-form-item>
        
        <el-form-item label="开发人" prop="developer">
          <div class="developer-input-wrapper">
            <el-input
              v-model="settings.developer"
              placeholder="请输入开发人"
              clearable
              class="developer-input"
            />
            <el-button
              type="primary"
              :icon="User"
              circle
              size="small"
              class="developer-select-btn"
              @click="handleDeveloperSelect"
            />
          </div>
        </el-form-item>
        
        <el-form-item label="载体" prop="carrier">
          <div class="carrier-select-wrapper">
            <span class="carrier-display">{{ settings.carrier || '请选择载体' }}</span>
            <el-button
              type="primary"
              :icon="Van"
              circle
              size="small"
              class="carrier-select-btn"
              @click="handleCarrierSelect"
            />
          </div>
        </el-form-item>
        
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="settings.status">
            <el-radio label="concept">构思</el-radio>
            <el-radio label="optimizing">未完成在优化</el-radio>
            <el-radio label="finalized">已定稿</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
      
      <!-- 预览列表 -->
      <div v-if="importList.length > 0" class="preview-section">
        <h3>导入预览 ({{ importList.length }})</h3>
        <el-table :data="importList" stripe style="width: 100%">
          <el-table-column prop="designImage" label="设计稿" width="100" fixed="left">
            <template #default="{ row }">
              <el-image
                v-if="row.designImage && fileList[row.index]?.raw"
                :src="createObjectURL(fileList[row.index].raw)"

                fit="cover"
                style="width: 60px; height: 60px; border-radius: 4px; cursor: pointer;"
              >
                <template #error>
                  <div class="image-error">
                    <el-icon><Picture /></el-icon>
                  </div>
                </template>
              </el-image>
              <div v-else class="image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>暂无图片</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="referenceImage" label="效果图" width="150" fixed="left">
            <template #default="{ row }">
              <div class="image-container">
                <div 
                  class="image-wrapper" 
                  @click="handleReferenceImageClick(row.index)"
                  style="cursor: pointer;"
                >
                  <el-image
                    v-if="row.referenceImage"
                    :src="row.referenceImage.url"
    
                    fit="cover"
                    style="width: 60px; height: 60px; border-radius: 4px;"
                  >
                    <template #error>
                      <div class="image-error">
                        <el-icon><Picture /></el-icon>
                      </div>
                    </template>
                  </el-image>
                  <div v-else class="image-placeholder">
                    <el-icon><Picture /></el-icon>
                    <span>暂无效果图</span>
                  </div>
                </div>
                <el-button 
                  v-if="row.referenceImage" 
                  type="danger" 
                  size="small" 
                  circle 
                  class="remove-reference-btn"
                  @click.stop="removeReferenceImage(row.index)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="sku" label="SKU" width="200">
            <template #default="{ row }">
              <el-input
                v-model="row.sku"
                placeholder="请输入SKU"
                size="small"
                @input="(value) => handleSkuInput(row, value)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="infringementLabel" label="侵权标注" width="180">
            <template #default="{ row }">
              <el-input
                v-model="row.infringementLabel"
                placeholder="请输入侵权标注"
                size="small"
                @input="(value) => handleInfringementLabelInput(row, value)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="developer" label="开发人" width="150" />
          <el-table-column prop="carrier" label="载体" width="200">
            <template #default="{ row }">
              <div class="carrier-input-wrapper">
                <el-button
                  type="primary"
                  :icon="Van"
                  circle
                  size="small"
                  class="carrier-select-btn"
                  @click="handleCarrierSelect(row.index)"
                />
                <el-input
                  v-model="row.carrier"
                  placeholder="请输入载体"
                  size="small"
                  @input="(value) => handleCarrierInput(row, value)"
                />
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="element" label="元素" width="150">
            <template #default="{ row }">
              <el-input
                v-model="row.element"
                placeholder="请输入元素"
                size="small"
                @input="(value) => handleElementInput(row, value)"
              />
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态">
            <template #default="{ row }">
              {{ statusMap[row.status] }}
            </template>
          </el-table-column>
          <el-table-column prop="batch" label="批次" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="removeImportItem(row.index)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      
      <!-- 导入进度 -->
      <el-progress 
        v-if="showProgress" 
        :percentage="importProgress" 
        :status="importStatus" 
        :text-inside="true" 
        :stroke-width="20" 
        class="import-progress"
      >
        <template #format>
          {{ importProgress }}% {{ progressText }}
        </template>
      </el-progress>
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button 
          type="primary" 
          @click="handleImport" 
          :loading="submitting" 
          :disabled="fileList.length === 0"
        >
          {{ submitting ? '导入中...' : '开始导入' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
  
  <!-- 开发人选择对话框 -->
  <el-dialog
    v-model="developerDialogVisible"
    title="选择开发人"
    width="400px"
    :before-close="handleDeveloperDialogClose"
  >
    <div class="developer-list">
      <div
        v-for="developer in developerList"
        :key="developer"
        class="developer-item"
        :class="{ selected: selectedDeveloper === developer }"
        @click="selectDeveloper(developer)"
      >
        <div class="developer-info">
          <span class="developer-name">{{ developer }}</span>
        </div>
        <el-icon v-if="selectedDeveloper === developer" class="check-icon">
          <Check />
        </el-icon>
      </div>
      
      <el-empty
        v-if="developerList.length === 0"
        description="暂无开发人数据"
        :image-size="100"
      />
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleDeveloperDialogClose">取消</el-button>
        <el-button type="primary" @click="confirmDeveloperSelection" :disabled="!selectedDeveloper">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
  
  <!-- 载体选择对话框 -->
  <el-dialog
    v-model="carrierDialogVisible"
    title="选择载体"
    width="700px"
    :before-close="handleCarrierDialogClose"
  >
    <div class="carrier-list">
      <div
        v-for="carrier in carrierList"
        :key="carrier.value"
        class="carrier-item"
        :class="{ selected: selectedCarrier === carrier.value }"
        @click="selectCarrier(carrier)"
      >
        <div class="carrier-info">
          <span class="carrier-name">{{ carrier.name }}</span>
          <span class="carrier-description">{{ carrier.description }}</span>
        </div>
        <el-icon v-if="selectedCarrier === carrier.value" class="check-icon">
          <Check />
        </el-icon>
      </div>
      
      <el-empty
        v-if="carrierList.length === 0"
        description="暂无载体数据"
        :image-size="100"
      />
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleCarrierDialogClose">取消</el-button>
        <el-button type="primary" @click="confirmCarrierSelection" :disabled="!selectedCarrier">
          确定
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, type UploadProps, type UploadUserFile, type FormInstance } from 'element-plus'
import { UploadFilled, Delete, Picture, Plus, Check, User, Van } from '@element-plus/icons-vue'
// 导入API
import { finalDraftApi } from '@/api/finalDraft'
import { imageApi } from '@/api/image'
import { systemConfigApi } from '@/api/systemConfig'
// 导入用户存储
import { useUserStore } from '@/stores/user'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()

// 定义Emits
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  success: []
}>()

// 响应式数据
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 用户存储实例
const userStore = useUserStore()

const uploadRef = ref()
const referenceUploadRef = ref()
const submitting = ref(false)
const fileList = ref<UploadUserFile[]>([])
const referenceFileList = ref<UploadUserFile[]>([])
const importList = ref<Array<{ uid: string; index: number; sku: string; filename: string; infringementLabel: string; status: 'concept' | 'optimizing' | 'finalized'; batch: string; developer: string; carrier: string; element: string; designImage?: { filename: string; url?: string; uid?: string }; referenceImage?: { filename: string; url?: string; uid?: string } }>>([])

// 状态映射
const statusMap = {
  concept: '构思',
  optimizing: '未完成在优化',
  finalized: '已定稿'
}

// 图片设置
const imageSettings = reactive({
  maxImageSize: 10 // 默认10MB
})

// 导入设置
const settings = reactive({
  batch: new Date().toISOString().slice(0, 10).replace(/-/g, ''), // 默认当前日期
  developer: '',
  carrier: '',
  element: '',
  status: 'concept' as 'finalized' | 'optimizing' | 'concept'
})

// 添加createObjectURL辅助函数，确保跨环境兼容
const createObjectURL = (file: File | Blob): string => {
  // 确保在所有环境中都能正确访问URL对象
  const urlApi = window.URL || window.webkitURL || (window as any).mozURL || (window as any).msURL;
  if (urlApi && typeof urlApi.createObjectURL === 'function') {
    return urlApi.createObjectURL(file);
  }
  // 如果所有方法都失败，返回一个默认的占位符URL
  return '';
};

// 导入进度相关
const showProgress = ref(false)
const importProgress = ref(0)
const importStatus = ref<'success' | 'exception' | 'warning'>()
const progressText = ref('')

// 开发人选择相关数据
const developerDialogVisible = ref(false)
const selectedDeveloper = ref<string>('')
const developerList = ref<string[]>([])

// 载体选择相关数据
const carrierDialogVisible = ref(false)
const selectedCarrier = ref<string>('')
const carrierList = ref<{value: string, name: string, description: string}[]>([])
// 当前正在编辑载体的产品行索引
const editingCarrierIndex = ref<number | null>(null)

// 当前正在编辑效果图的索引
const editingReferenceIndex = ref<number | null>(null)

// 自动填写开发人
const autoFillDeveloper = (): void => {
  console.log('[BatchImport] 开始执行自动填写开发人')
  const currentUser = userStore.userInfo
  console.log('[BatchImport] 当前用户信息:', currentUser)
  
  if (currentUser) {
    console.log('[BatchImport] 用户角色:', currentUser.role)
    console.log('[BatchImport] 用户名:', currentUser.username)
    
    // 检查用户是否为开发角色（支持多种角色名称格式）
    const isDeveloperRole = ['开发', 'developer'].includes(currentUser.role)
    console.log('[BatchImport] 是否为开发角色:', isDeveloperRole)
    
    // 如果是开发角色，尝试自动填写开发人
    if (isDeveloperRole) {
      // 用户名到开发名的映射
      const usernameToDeveloperMap: Record<string, string> = {
        'liumiao': '刘淼'
        // 可以添加更多映射
      }
      
      // 首先检查当前用户对象中的 developer 字段
      if ((currentUser as any).developer) {
        settings.developer = (currentUser as any).developer
        console.log('[BatchImport] 从用户对象的 developer 字段获取开发人:', (currentUser as any).developer)
      }
      // 其次使用硬编码映射
      else if (usernameToDeveloperMap[currentUser.username]) {
        settings.developer = usernameToDeveloperMap[currentUser.username]
        console.log('[BatchImport] 从硬编码映射获取开发人:', settings.developer)
      }
      // 最后使用用户名作为 fallback
      else {
        settings.developer = currentUser.username
        console.log('[BatchImport] 使用用户名作为开发人:', currentUser.username)
      }
      
      console.log('[BatchImport] 最终填写的开发人:', settings.developer)
    } else {
      console.log('[BatchImport] 用户不是开发角色，跳过自动填写')
    }
  } else {
    console.log('[BatchImport] 用户信息为空，跳过自动填写')
  }
}

// 方法
const resetForm = (): void => {
  fileList.value = []
  referenceFileList.value = []
  importList.value = []
  settings.batch = new Date().toISOString().slice(0, 10).replace(/-/g, '') // 默认当前日期
  // 保留自动填写的开发人信息
  settings.carrier = '' // 载体，允许为空
  settings.element = '' // 元素，允许为空
  settings.status = 'concept' // 默认状态为构思
  showProgress.value = false
  importProgress.value = 0
  importStatus.value = undefined
  progressText.value = ''
  editingReferenceIndex.value = null // 重置正在编辑的效果图索引
}

// 加载开发人列表
const loadDeveloperList = async () => {
  try {
    const response = await systemConfigApi.getDeveloperList()
    if (response.code === 200 && response.data && Array.isArray(response.data.developerList)) {
      developerList.value = response.data.developerList
    } else {
      // 默认开发人列表
      developerList.value = ['admin', 'user1', 'user2']
    }
  } catch (error) {
    console.error('加载开发人列表失败:', error)
    developerList.value = ['admin', 'user1', 'user2']
  }
}

// 加载载体列表
const loadCarrierList = async () => {
  try {
    const response = await systemConfigApi.getCarrierList()
    if (response.code === 200 && response.data && Array.isArray(response.data.carrierList)) {
      // 将获取到的载体列表转换为组件需要的格式
      carrierList.value = response.data.carrierList.map(carrier => ({
        value: carrier,
        name: carrier,
        description: `${carrier}载体`
      }))
    } else {
      // 默认载体列表
      carrierList.value = []
    }
  } catch (error) {
    console.error('加载载体列表失败:', error)
    carrierList.value = []
  }
}

// 初始化加载开发人列表和载体列表
loadDeveloperList()
loadCarrierList()

// 监听用户信息变化，当用户信息加载完成后执行自动填写
watch(
  () => userStore.userInfo,
  (newUserInfo) => {
    if (newUserInfo) {
      console.log('[BatchImport] 用户信息变化，执行自动填写开发人')
      autoFillDeveloper()
    }
  },
  { deep: true }
)

// 从文件名提取SKU（去除文件扩展名）
const extractSkuFromFilename = (filename: string): string => {
  // 去除文件扩展名
  const lastDotIndex = filename.lastIndexOf('.')
  if (lastDotIndex > 0) {
    return filename.substring(0, lastDotIndex)
  }
  return filename
}

// 更新导入列表
const updateImportList = (): void => {
  // 保存原有的导入列表到临时变量，避免在map过程中访问正在修改的数组
  const originalImportList = [...importList.value]
  
  importList.value = fileList.value.map((file, index) => {
    const filename = file.name || `image_${index}`
    const uid = String(file.uid || `uid_${Date.now()}_${index}`)
    
    // 查找是否已存在该文件的导入项，保留用户修改过的SKU
    // 使用uid作为唯一标识符，确保文件关联正确
    const existingItem = originalImportList.find(item => 
      item.uid === uid
    )
    
    return {
      uid,
      index,
      sku: existingItem?.sku || extractSkuFromFilename(filename), // 保留用户修改的SKU
      filename,
      infringementLabel: existingItem?.infringementLabel || '', // 保留用户修改的侵权标注
      status: settings.status,
      batch: settings.batch,
      developer: settings.developer, // 添加当前选择的开发人
      carrier: existingItem?.carrier || settings.carrier, // 保留用户修改的载体
      element: existingItem?.element || settings.element, // 保留用户修改的元素
      designImage: {
        filename,
        url: createObjectURL(file.raw || new Blob()) // 创建临时URL用于预览
      },
      referenceImage: existingItem?.referenceImage // 保留已关联的参考图
    }
  })
  
  // 触发参考图匹配
  matchReferenceImages()
}

// 处理文件列表更新
const handleFileListUpdate = (newFileList: UploadUserFile[]) => {
  fileList.value = newFileList
  updateImportList()
}

const handleChange: UploadProps['onChange'] = (file, files) => {
  fileList.value = [...files]
  updateImportList()
}

const handleRemove: UploadProps['onRemove'] = (file, files) => {
  fileList.value = [...files]
  updateImportList()
}

// 处理参考图文件列表更新
const handleReferenceFileListUpdate = (newFileList: UploadUserFile[]) => {
  referenceFileList.value = newFileList
  matchReferenceImages()
}

// 处理效果图文件变化
const handleReferenceChange: UploadProps['onChange'] = (file, files) => {
  referenceFileList.value = [...files]
  
  // 如果有正在编辑的效果图索引，直接将新上传的图片关联到对应的设计稿行
  if (editingReferenceIndex.value !== null && file.status === 'ready') {
    const index = editingReferenceIndex.value
    if (importList.value[index]) {
      importList.value[index].referenceImage = {
        filename: file.name || '',
        url: createObjectURL(file.raw || new Blob()),
        uid: String(file.uid)
      }
      // 重置正在编辑的索引
      editingReferenceIndex.value = null
      return
    }
  }
  
  // 否则，使用正常的匹配机制
  matchReferenceImages()
}

// 处理效果图文件移除
const handleReferenceRemove: UploadProps['onRemove'] = (file, files) => {
  referenceFileList.value = [...files]
  matchReferenceImages()
}

// 效果图匹配逻辑 - 实现模糊匹配
const matchReferenceImages = () => {
  if (importList.value.length === 0 || referenceFileList.value.length === 0) {
    return
  }
  
  // 创建一个已匹配的效果图文件集合，避免重复匹配
  const matchedFiles = new Set<string>()
  
  // 遍历设计稿，匹配对应的效果图
  importList.value = importList.value.map(item => {
    // 1. 先尝试完全匹配，确保匹配的准确性
    let matchingReference = referenceFileList.value.find(refFile => {
      const refFilename = refFile.name || ''
      const refSku = extractSkuFromFilename(refFilename)
      return refSku === item.sku && !matchedFiles.has(String(refFile.uid))
    })
    
    // 2. 如果没有完全匹配的，再尝试模糊匹配
    if (!matchingReference) {
      matchingReference = referenceFileList.value.find(refFile => {
        const refFilename = refFile.name || ''
        const refSku = extractSkuFromFilename(refFilename)
        // 双向包含匹配，忽略大小写
        const lowerCaseRefSku = refSku.toLowerCase()
        const lowerCaseItemSku = item.sku.toLowerCase()
        return (lowerCaseRefSku.includes(lowerCaseItemSku) || lowerCaseItemSku.includes(lowerCaseRefSku)) && !matchedFiles.has(String(refFile.uid))
      })
    }
    
    if (matchingReference) {
      // 标记该效果图文件已匹配
      matchedFiles.add(String(matchingReference.uid))
      return {
        ...item,
        referenceImage: {
          filename: matchingReference.name || '',
          url: createObjectURL(matchingReference.raw || new Blob()), // 创建临时URL用于预览
          uid: String(matchingReference.uid) // 保存效果图文件的uid，用于后续删除操作
        }
      }
    }
    
    // 如果没有匹配到效果图，则保留当前状态（如果是undefined，说明用户明确删除了）
    return item
  })
}

// 检查导入列表中是否存在重复SKU
const checkDuplicateSkuInImportList = (): string[] => {
  const skuMap = new Map<string, string[]>()
  const duplicates: string[] = []
  
  importList.value.forEach(item => {
    if (item.sku) {
      if (skuMap.has(item.sku)) {
        skuMap.get(item.sku)?.push(item.filename)
      } else {
        skuMap.set(item.sku, [item.filename])
      }
    }
  })
  
  // 找出重复的SKU
  skuMap.forEach((files, sku) => {
    if (files.length > 1) {
      duplicates.push(sku)
    }
  })
  
  return duplicates
}

// 处理日期变化
const handleDateChange = (dateValue: string): void => {
  if (dateValue) {
    // 无论批次字段是否为空，都自动填充为日期值
    settings.batch = dateValue
    updateImportList()
  }
}

// 处理SKU输入变化
const handleSkuInput = (row: { uid: string; index: number; sku: string; filename: string; status: string; batch: string; developer: string; carrier: string; element: string }, value: string) => {
  // 确保SKU更新被Vue检测到
  // 直接更新整个importList数组，确保Vue能够检测到变化
  importList.value = importList.value.map(item => {
    if (item.uid === row.uid) {
      return { ...item, sku: value }
    }
    return item
  })
  console.log(`SKU已更新: ${value} 对于文件: ${row.filename}`)
}

// 处理载体输入变化
const handleCarrierInput = (row: { uid: string; index: number; sku: string; filename: string; status: string; batch: string; developer: string; carrier: string; element: string }, value: string) => {
  // 确保载体更新被Vue检测到
  // 直接更新整个importList数组，确保Vue能够检测到变化
  importList.value = importList.value.map(item => {
    if (item.uid === row.uid) {
      return { ...item, carrier: value }
    }
    return item
  })
  console.log(`载体已更新: ${value} 对于文件: ${row.filename}`)
}

// 处理元素输入变化
const handleElementInput = (row: { uid: string; index: number; sku: string; filename: string; status: string; batch: string; developer: string; carrier: string; element: string }, value: string) => {
  // 确保元素更新被Vue检测到
  // 直接更新整个importList数组，确保Vue能够检测到变化
  importList.value = importList.value.map(item => {
    if (item.uid === row.uid) {
      return { ...item, element: value }
    }
    return item
  })
  console.log(`元素已更新: ${value} 对于文件: ${row.filename}`)
}

// 处理侵权标注输入变化
const handleInfringementLabelInput = (row: { uid: string; index: number; sku: string; filename: string; infringementLabel: string; status: string; batch: string; developer: string; carrier: string; element: string }, value: string) => {
  // 确保侵权标注更新被Vue检测到
  // 直接更新整个importList数组，确保Vue能够检测到变化
  importList.value = importList.value.map(item => {
    if (item.uid === row.uid) {
      return { ...item, infringementLabel: value }
    }
    return item
  })
  console.log(`侵权标注已更新: ${value} 对于文件: ${row.filename}`)
}

// 监听状态变化，实时更新预览列表
watch(() => settings.status, () => {
  updateImportList()
})

// 监听开发人变化，实时更新预览列表中的开发人信息
watch(() => settings.developer, (newDeveloper) => {
  importList.value = importList.value.map(item => ({
    ...item,
    developer: newDeveloper
  }))
})

// 移除载体变化的全局监听，避免覆盖用户单独编辑的载体值
// 用户编辑的载体值将通过handleCarrierInput函数处理，新添加的文件将从settings.carrier获取默认值

const handleExceed: UploadProps['onExceed'] = () => {
  ElMessage.warning('最多只能上传100张图片')
}

// 验证图片类型的函数
const validateImageType = (file: File): boolean => {
  const isJPGOrPNG = file.type === 'image/jpeg' || file.type === 'image/png'
  
  if (!isJPGOrPNG) {
    ElMessage.error('上传图片只能是 JPG/PNG 格式!')
    return false
  }
  return true
}

// 验证图片大小的函数
const validateImageSize = (file: File): boolean => {
  const isLtMaxSize = file.size / 1024 / 1024 < imageSettings.maxImageSize
  
  if (!isLtMaxSize) {
    ElMessage.error(`上传图片大小不能超过 ${imageSettings.maxImageSize}MB!`)
    return false
  }
  return true
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  return validateImageType(file) && validateImageSize(file)
}

// 自定义上传逻辑（这里只是模拟，实际上传在导入时处理）
const handleUpload: UploadProps['httpRequest'] = async (options) => {
  // 模拟上传过程
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const result = {
    url: URL.createObjectURL(options.file),
    name: options.file.name
  }
  
  options.onSuccess(result)
}

// 移除导入项
const removeImportItem = (index: number) => {
  fileList.value.splice(index, 1)
  updateImportList()
}

// 移除效果图
const removeReferenceImage = (index: number) => {
  // 从导入列表中移除对应项的效果图
  if (importList.value[index]) {
    const referenceImage = importList.value[index].referenceImage
    // 从referenceFileList中移除对应的文件
    if (referenceImage?.uid) {
      const fileIndex = referenceFileList.value.findIndex(file => String(file.uid) === referenceImage.uid)
      if (fileIndex > -1) {
        referenceFileList.value.splice(fileIndex, 1)
      }
    }
    // 移除导入列表中的效果图引用
    importList.value[index].referenceImage = undefined
    // 重新匹配效果图
    matchReferenceImages()
    ElMessage.success('效果图已删除')
  }
}

// 开发人选择相关方法
const handleDeveloperSelect = (): void => {
  developerDialogVisible.value = true
  selectedDeveloper.value = settings.developer
}

// 点击效果图，触发上传新图
const handleReferenceImageClick = (index: number) => {
  // 设置当前正在编辑的效果图索引
  editingReferenceIndex.value = index
  // 触发效果图上传组件的文件选择对话框
  if (referenceUploadRef.value) {
    (referenceUploadRef.value as any).$el.querySelector('.el-upload__input')?.click()
  }
}

const handleDeveloperDialogClose = (): void => {
  developerDialogVisible.value = false
  selectedDeveloper.value = ''
}

const selectDeveloper = (developer: string): void => {
  selectedDeveloper.value = developer
}

const confirmDeveloperSelection = (): void => {
  settings.developer = selectedDeveloper.value
  developerDialogVisible.value = false
}

// 载体选择相关方法
const handleCarrierSelect = (rowIndex?: number | MouseEvent): void => {
  carrierDialogVisible.value = true
  
  // 检查参数类型
  if (typeof rowIndex === 'number') {
    // 单行编辑模式
    editingCarrierIndex.value = rowIndex
    // 设置默认值为当前行的载体值
    const currentRow = importList.value[rowIndex]
    selectedCarrier.value = currentRow?.carrier || ''
  } else {
    // 全局编辑模式或事件对象
    editingCarrierIndex.value = null
    // 设置默认值为全局设置的载体值
    selectedCarrier.value = settings.carrier
  }
}

const handleCarrierDialogClose = (): void => {
  carrierDialogVisible.value = false
  selectedCarrier.value = ''
}

const selectCarrier = (carrier: {value: string, name: string, description: string}): void => {
  selectedCarrier.value = carrier.value
}

const confirmCarrierSelection = (): void => {
  const selectedCarrierObj = carrierList.value.find(item => item.value === selectedCarrier.value)
  if (selectedCarrierObj) {
    if (editingCarrierIndex.value !== null) {
      // 单行编辑模式，只更新特定行的载体值
      const index = editingCarrierIndex.value
      if (importList.value[index]) {
        importList.value[index].carrier = selectedCarrierObj.name
      }
      editingCarrierIndex.value = null
    } else {
      // 全局编辑模式，更新settings.carrier并应用到所有行
      settings.carrier = selectedCarrierObj.name
      // 更新导入列表中的载体值，确保所有已添加的文件都使用新选择的载体
      importList.value = importList.value.map(item => ({
        ...item,
        carrier: settings.carrier
      }))
    }
  }
  carrierDialogVisible.value = false
}

// 单个文件上传
const uploadSingleImage = async (file: File, sku: string): Promise<{ filename: string; url: string }> => {
  try {
    console.log(`开始上传单个图片: ${file.name}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB, SKU: ${sku}`)
    // 调用图片上传API，指定category为final，并传递sku参数
    const response = await imageApi.upload(file, 'final', sku)
    
    console.log(`图片上传API响应 (${file.name}):`, response)
    
    // 统一成功响应的判断标准
    let success = false
    let url = ''
    let message = ''
    
    // 标准响应格式：{ code: 200, data: { url: 'xxx' } }
    if (response.code === 200) {
      // 检查data中的url
      if (response.data?.url) {
        success = true
        url = response.data.url
        message = response.message || '图片上传成功'
      }
      // 检查data中的cos_url
      else if ((response.data as any)?.cos_url) {
        success = true
        url = (response.data as any).cos_url
        message = response.message || '图片上传成功'
      }
      // 检查data中的filepath
      else if ((response.data as any)?.filepath) {
        success = true
        url = (response.data as any).filepath
        message = response.message || '图片上传成功'
      }
    }
    // 其他可能的成功响应格式
    else if ((response as any).success === true && ((response as any).url || (response.data as any)?.url)) {
      success = true
      url = (response as any).url || (response.data as any).url
      message = response.message || '图片上传成功'
    }
    
    if (success) {
      console.log(`图片上传成功 (${file.name}): ${message}, URL: ${url}`)
      return { filename: file.name, url }
    } else {
      // 构建准确的错误信息
      const errorMsg = response.message || '图片上传失败'
      console.error(`图片上传失败 (${file.name}): ${errorMsg}`)
      throw new Error(errorMsg)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '图片上传异常'
    console.error(`图片上传异常 (${file.name}):`, error)
    throw error
  }
}

// 定义文件-SKU映射类型
interface FileWithSku {
  file: File
  sku: string
}

// 批量上传图片 - 并发上传优化
const uploadImages = async (fileSkuPairs: FileWithSku[]): Promise<{ filename: string; url: string }[]> => {
  try {
    console.log(`开始批量上传图片，共 ${fileSkuPairs.length} 个文件`)
    ElMessage.info({ message: '开始上传图片，请稍候...', duration: 2000 })
    
    // 并发上传配置
    const CONCURRENCY = 5
    const results: { filename: string; url: string }[] = []
    const errors: string[] = []
    
    // 分割文件数组为多个批次
    const batches = []
    for (let i = 0; i < fileSkuPairs.length; i += CONCURRENCY) {
      batches.push(fileSkuPairs.slice(i, i + CONCURRENCY))
    }
    
    console.log(`批量上传图片批次划分: 共 ${batches.length} 个批次，每批次 ${CONCURRENCY} 个文件`)
    
    // 逐个批次上传
    let batchIndex = 1
    for (const batch of batches) {
      console.log(`开始上传批次 ${batchIndex}/${batches.length}，共 ${batch.length} 个文件`)
      
      // 并行上传当前批次的文件，传递对应的SKU
      const batchResults = await Promise.allSettled(
        batch.map(({ file, sku }) => uploadSingleImage(file, sku))
      )
      
      // 处理当前批次的结果
      batchResults.forEach((result, index) => {
        const { file, sku } = batch[index]
        const fileName = file.name
        if (result.status === 'fulfilled') {
          // 检查返回值是否有效
          if (result.value && typeof result.value === 'object') {
            // 检查是否有有效的URL
            const url = result.value.url || result.value.cos_url || result.value.filepath
            if (url) {
              results.push({ filename: fileName, url })
              console.log(`批次 ${batchIndex} 文件 ${index + 1} 上传成功: ${fileName}，SKU: ${sku}，URL: ${url}`)
            } else {
              errors.push(fileName)
              console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, SKU: ${sku}, 原因: 返回结果中没有有效的URL`)
            }
          } else {
            errors.push(fileName)
            console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, SKU: ${sku}, 原因: 返回结果无效`)
          }
        } else {
          errors.push(fileName)
          console.error(`批次 ${batchIndex} 文件 ${index + 1} 上传失败: ${fileName}, SKU: ${sku}, 错误:`, result.reason)
        }
      })
      
      batchIndex++
      
      // 更新进度
      const uploadedCount = results.length + errors.length
      const progress = Math.round((uploadedCount / fileSkuPairs.length) * 100)
      importProgress.value = Math.min(30, Math.round(progress * 0.3))
      progressText.value = `正在上传图片... ${uploadedCount}/${fileSkuPairs.length}`
      console.log(`批量上传进度: ${uploadedCount}/${fileSkuPairs.length} (${progress}%)`)
    }
    
    console.log(`批量上传完成: 成功 ${results.length} 个，失败 ${errors.length} 个`)
    
    // 检查是否有成功上传的文件
    if (results.length === 0) {
      console.error('批量上传失败: 没有文件上传成功')
      throw new Error(`批量上传失败: 没有文件上传成功，失败文件: ${errors.join(', ')}`)
    }
    
    // 显示上传结果
    if (errors.length > 0) {
      console.log(`批量上传结果: 部分成功，成功 ${results.length} 个，失败 ${errors.length} 个，失败文件:`, errors)
      ElMessage.warning(`图片上传完成: 成功 ${results.length} 个，失败 ${errors.length} 个`)
    } else {
      console.log(`批量上传结果: 全部成功，共 ${results.length} 个文件`)
      ElMessage.success(`图片上传成功: ${results.length} 个`)
    }
    
    return results
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '批量上传失败'
    console.error('批量上传图片异常:', error)
    ElMessage.error({ message: `图片上传失败: ${errorMsg}`, duration: 5000 })
    throw error
  }
}

// 开始导入
const handleImport = async (): Promise<void> => {
  console.log('开始执行批量导入操作')
  
  if (fileList.value.length === 0) {
    console.log('批量导入取消：未选择图片')
    ElMessage.warning('请先选择要导入的图片')
    return
  }
  
  try {
    console.log(`开始批量导入，共 ${fileList.value.length} 个设计稿文件`)
    submitting.value = true
    
    // 初始化进度条
    showProgress.value = true
    importProgress.value = 0
    importStatus.value = undefined
    progressText.value = '准备导入...'
    
    // 检查导入列表中是否存在重复SKU
    console.log('检查导入列表中是否存在重复SKU')
    const duplicateSkus = checkDuplicateSkuInImportList()
    if (duplicateSkus.length > 0) {
      console.error('导入列表中存在重复SKU:', duplicateSkus)
      throw new Error(`导入列表中存在重复SKU：${duplicateSkus.join(', ')}`)
    }
    
    // 分离已上传的文件和待上传的文件
    console.log('分离需要上传的设计稿文件')
    const designFileSkuPairs: { file: File; sku: string }[] = []
    for (const file of fileList.value) {
      if (file.raw) {
        // 查找对应文件的SKU信息
        const importItem = importList.value.find(item => item.filename === file.name)
        const sku = importItem?.sku || extractSkuFromFilename(file.name)
        designFileSkuPairs.push({ file: file.raw, sku })
        console.log(`添加设计稿文件到上传列表: ${file.name}，SKU: ${sku}`)
      } else {
        console.warn(`设计稿文件缺少raw数据: ${file.name}`)
      }
    }
    
    console.log(`设计稿文件分离完成，共 ${designFileSkuPairs.length} 个文件需要上传`)
    
    if (designFileSkuPairs.length === 0) {
      console.error('没有需要上传的设计稿文件')
      ElMessage.warning('没有需要上传的文件')
      submitting.value = false
      return
    }
    
    // 分离需要上传的效果图文件
    console.log('分离需要上传的效果图文件')
    const referenceFileSkuPairs: { file: File; sku: string }[] = []
    let referenceMatchCount = 0
    let referenceFailCount = 0
    
    for (const item of importList.value) {
      if (item.referenceImage) {
        // 使用uid进行更可靠的匹配，而不是仅依赖文件名
        const matchingReferenceFile = referenceFileList.value.find(refFile => 
          String(refFile.uid) === String(item.referenceImage?.uid)
        )
        if (matchingReferenceFile && matchingReferenceFile.raw) {
          referenceFileSkuPairs.push({ file: matchingReferenceFile.raw, sku: item.sku })
          referenceMatchCount++
          console.log(`效果图匹配成功（通过uid）: ${item.referenceImage?.filename}，SKU: ${item.sku}`)
        } else {
          // 如果uid匹配失败，尝试使用文件名匹配作为备选方案
          const altMatchingFile = referenceFileList.value.find(refFile => 
            refFile.name === item.referenceImage?.filename
          )
          if (altMatchingFile && altMatchingFile.raw) {
            referenceFileSkuPairs.push({ file: altMatchingFile.raw, sku: item.sku })
            referenceMatchCount++
            console.log(`效果图匹配成功（通过文件名）: ${item.referenceImage?.filename}，SKU: ${item.sku}`)
          } else {
            referenceFailCount++
            console.warn(`效果图匹配失败: ${item.referenceImage?.filename}`)
          }
        }
      }
    }
    
    console.log(`效果图文件分离完成，共 ${referenceFileSkuPairs.length} 个文件需要上传，匹配成功 ${referenceMatchCount} 个，失败 ${referenceFailCount} 个`)
    
    // 定义上传结果类型
    interface UploadResult {
      filename: string
      url: string
    }
    
    let uploadedDesignUrls: UploadResult[] = []
    let uploadedReferenceUrls: UploadResult[] = []
    
    // 第一步：上传设计稿图片
    console.log(`开始上传设计稿图片，共 ${designFileSkuPairs.length} 个文件`)
    progressText.value = '正在上传设计稿...'
    uploadedDesignUrls = await uploadImages(designFileSkuPairs)
    console.log(`设计稿图片上传完成，成功 ${uploadedDesignUrls.length} 个，失败 ${designFileSkuPairs.length - uploadedDesignUrls.length} 个`)
    importProgress.value = 30
    
    // 第二步：上传参考图图片（如果有）
    if (referenceFileSkuPairs.length > 0) {
      console.log(`开始上传参考图图片，共 ${referenceFileSkuPairs.length} 个文件`)
      progressText.value = '正在上传参考图...'
      uploadedReferenceUrls = await uploadImages(referenceFileSkuPairs)
      console.log(`参考图图片上传完成，成功 ${uploadedReferenceUrls.length} 个，失败 ${referenceFileSkuPairs.length - uploadedReferenceUrls.length} 个`)
      importProgress.value = 50
    } else {
      console.log('无参考图需要上传')
    }
    
    // 第三步：批量创建定稿
    console.log('开始批量创建定稿')
    progressText.value = '正在创建定稿...'
    
    // 验证导入列表数据 - 只有SKU必填
    for (const item of importList.value) {
      if (!item.sku) {
        throw new Error(`SKU不能为空，文件：${item.filename}`)
      }
    }
    
    // 将上传结果转换为Map，使用文件名作为键，确保文件与URL正确对应
    const designUrlMap = new Map<string, string>()
    uploadedDesignUrls.forEach(result => {
      designUrlMap.set(result.filename, result.url)
    })
    
    // 准备参考图URL映射 - 使用设计稿文件名作为键，确保参考图与设计稿正确关联
    const referenceUrlMap = new Map<string, string>()
    let refIndex = 0
    for (const item of importList.value) {
      if (item.referenceImage && refIndex < uploadedReferenceUrls.length) {
        // 使用设计稿文件名作为键，确保参考图与设计稿正确关联
        referenceUrlMap.set(item.filename, uploadedReferenceUrls[refIndex].url)
        refIndex++
      }
    }
    
    // 准备批量创建请求数据 - 只处理上传成功的文件
    console.log('准备批量创建定稿数据')
    const draftDataList = importList.value
      .filter(item => designUrlMap.has(item.filename)) // 只处理上传成功的文件
      .map(item => {
        const designUrl = designUrlMap.get(item.filename)
        const referenceUrl = referenceUrlMap.get(item.filename)
        console.log(`添加定稿数据: SKU=${item.sku}, 文件名=${item.filename}, 设计稿URL=${designUrl}, 参考图URL=${referenceUrl || '无'}`)
        return {
          sku: item.sku, // 使用用户修改后的SKU值
          batch: item.batch || settings.batch || '', // 批次，使用当前选择的批次或空字符串
          developer: item.developer || settings.developer || '', // 开发人，使用当前选择的开发人或空字符串
          carrier: item.carrier || settings.carrier || '', // 载体，使用当前选择的载体或空字符串
          element: item.element || settings.element || '', // 元素，使用当前选择的元素或空字符串
          infringement_label: item.infringementLabel || '', // 侵权标注
          images: [designUrl!], // 从Map中获取对应的URL
          reference_images: referenceUrl ? [referenceUrl] : [], // 使用设计稿文件名获取参考图URL
          status: item.status || settings.status || 'concept' // 状态，使用当前选择的状态或默认值
        }
      })
    
    console.log(`定稿数据准备完成，共 ${draftDataList.length} 个定稿数据`)    
    
    // 如果没有可创建的数据，直接返回
    if (draftDataList.length === 0) {
      console.error('没有可创建的定稿数据，上传成功的文件数:', uploadedDesignUrls.length, '导入列表长度:', importList.value.length)
      throw new Error('没有可创建的定稿数据')
    }
    
    // 调用批量创建API - 添加进度更新
    importProgress.value = referenceFileSkuPairs.length > 0 ? 70 : 50
    progressText.value = '正在创建定稿... 70%'
    
    // 添加进度更新定时器
    const progressInterval = setInterval(() => {
      if (importProgress.value < 85) {
        importProgress.value += 5
        progressText.value = `正在创建定稿... ${importProgress.value}%`
      }
    }, 500)
    
    // 调用批量创建API
    console.log('调用批量创建定稿API，共提交', draftDataList.length, '个定稿数据')
    const createResponse = await finalDraftApi.batchCreate(draftDataList)
    console.log('批量创建定稿API响应:', createResponse)
    
    // 清除进度定时器
    clearInterval(progressInterval)
    
    // 更新进度到90%
    importProgress.value = 90
    progressText.value = '定稿创建完成，正在处理结果... 90%'
    
    if (createResponse.code === 200) {
      console.log('批量创建定稿API调用成功')
      // 更新进度到100%
      importProgress.value = 100
      progressText.value = '导入完成！100%'
      importStatus.value = 'success'
      
      // 解析错误信息，提取已存在的SKU
      const existingSkus: string[] = []
      if (createResponse.data?.errors && Array.isArray(createResponse.data.errors)) {
        createResponse.data.errors.forEach(error => {
          // 提取已存在的SKU信息（根据后端返回的错误信息格式）
          const skuMatch = error.match(/SKU\s+([^\s]+)\s+已存在/)
          if (skuMatch && skuMatch[1]) {
            existingSkus.push(skuMatch[1])
          } else {
            // 如果没有匹配到SKU，直接显示错误信息
            existingSkus.push(error)
          }
        })
      }
      
      // 根据导入结果显示不同的提示信息
      const successCount = createResponse.data?.success || 0
      const failedCount = createResponse.data?.failed || 0
      
      if (successCount === 0 && failedCount > 0) {
        // 全部导入失败
        if (existingSkus.length > 0) {
          ElMessage.error({
            message: `导入失败：${failedCount} 个定稿创建失败，原因：${existingSkus.join('; ')}，请修改后重新导入`,
            duration: 8000
          })
        } else {
          ElMessage.error({
            message: `批量导入失败，${failedCount} 个定稿创建失败，请修改后重新导入`,
            duration: 5000
          })
        }
        
        // 全部导入失败，不关闭对话框，留在页面供用户修改
        submitting.value = false
      } else if (successCount > 0 && failedCount > 0) {
        // 部分导入失败
        if (existingSkus.length > 0) {
          ElMessage.warning({
            message: `成功导入 ${successCount} 个定稿，${failedCount} 个创建失败（原因：${existingSkus.join('; ')}），请修改后重新导入`,
            duration: 8000
          })
        } else {
          ElMessage.warning({
            message: `成功导入 ${successCount} 个定稿，${failedCount} 个创建失败，请修改后重新导入`,
            duration: 5000
          })
        }
        
        // 部分导入失败，不关闭对话框，留在页面供用户修改
        submitting.value = false
      } else {
        // 全部导入成功
        ElMessage.success({
          message: `成功导入 ${successCount || 0} 个定稿`,
          duration: 5000
        })
        
        // 导入成功，设置submitting为false
        submitting.value = false
        
        // 3秒后关闭对话框
        setTimeout(() => {
          emit('success')
          handleClose()
        }, 3000)
      }
    } else {
      throw new Error(createResponse.message || '批量创建定稿失败')
    }
  } catch (error) {
    console.error('批量导入失败:', error)
    
    // 更新进度条状态为异常
    importStatus.value = 'exception'
    importProgress.value = 100
    progressText.value = '导入失败！'
    
    const errorMsg = error instanceof Error ? error.message : '导入失败'
    
    // 根据错误类型显示不同的提示信息
    let displayErrorMsg = errorMsg
    
    // 移除可能存在的重复前缀，确保错误信息清晰
    displayErrorMsg = displayErrorMsg.replace(/^图片上传失败: /g, '')
    displayErrorMsg = displayErrorMsg.replace(/^批量上传失败: /g, '')
    displayErrorMsg = displayErrorMsg.replace(/^导入失败: /g, '')
    
    // 统一错误信息显示逻辑
    let errorMessage = ''
    let duration = 5000
    
    if (displayErrorMsg.includes('重复SKU')) {
      // 重复SKU错误
      errorMessage = displayErrorMsg + '，请修改后重新导入'
      duration = 8000
    } else if (displayErrorMsg.includes('SKU不能为空')) {
      // SKU为空错误
      errorMessage = displayErrorMsg
    } else if (displayErrorMsg.includes('已存在')) {
      // 已存在的SKU错误
      errorMessage = displayErrorMsg + '，请修改SKU后重新导入'
      duration = 8000
    } else if (displayErrorMsg.includes('没有可创建的定稿数据')) {
      // 没有可创建的数据错误
      errorMessage = displayErrorMsg + '，请检查上传的文件是否有效'
    } else {
      // 其他错误
      errorMessage = `批量导入失败: ${displayErrorMsg}`
    }
    
    // 显示统一的错误信息
    ElMessage.error({
      message: errorMessage,
      duration: duration
    })
    
    // 3秒后隐藏进度条
    setTimeout(() => {
      showProgress.value = false
    }, 3000)
    
    submitting.value = false
  }
}

// 添加组件挂载状态标志
const isMounted = ref(true)

// 加载图片设置
const loadImageSettings = async () => {
  try {
    const response = await systemConfigApi.getImageSettings()
    if (response.code === 200 && response.data) {
      imageSettings.maxImageSize = response.data.maxImageSize
    }
  } catch (error) {
    console.error('加载图片设置失败:', error)
  }
}

// 组件挂载时设置标志并加载图片设置
onMounted(() => {
  isMounted.value = true
  loadImageSettings()
  // 自动填写开发人
  autoFillDeveloper()
})

// 组件卸载时清理资源
onUnmounted(() => {
  isMounted.value = false
})

const handleClose = (done?: any): void => {
  // 1. 首先确保对话框能够关闭
  // 如果是从before-close调用，会传入done回调，需要调用它来允许对话框关闭
  if (typeof done === 'function') {
    done()
  } else {
    // 否则直接设置dialogVisible为false
    dialogVisible.value = false
  }
  
  // 2. 关闭后再执行重置操作，避免与关闭逻辑冲突
  resetForm()
}
</script>

<style scoped lang="scss">
.batch-import-dialog {
  .upload-section {
    margin-bottom: 20px;
    
    .upload-component {
      margin-bottom: 16px;
      
      :deep(.el-upload-list--picture-card) {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      
      :deep(.el-upload--picture-card) {
        margin: 0;
      }
    }
  }
  
  .settings-section {
    margin-bottom: 20px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    
    .date-picker {
      width: 100%;
    }
  }
  
  .preview-section {
    margin-bottom: 20px;
    
    h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 500;
      color: #303133;
    }
  }
  
  .import-progress {
    margin-top: 20px;
  }
}

.developer-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .developer-input {
    flex: 1;
  }
  
  .developer-select-btn {
    flex-shrink: 0;
  }
}

// 开发人选择对话框样式
.developer-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  display: grid !important;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
  gap: 12px !important;
  
  .developer-item {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 12px 16px !important;
    border: 2px solid transparent !important;
    border-radius: 8px !important;
    cursor: pointer !important;
    transition: all 0.3s ease !important;
    background-color: #fafafa !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05) !important;
    
    &:hover {
      border-color: #409eff !important;
      background-color: #ecf5ff !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
    }
    
    &.selected {
      border-color: #409eff !important;
      background-color: #ecf5ff !important;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15) !important;
    }
    
    .developer-info {
      display: flex !important;
      align-items: center !important;
      
      .developer-name {
        font-size: 15px !important;
        font-weight: 600 !important;
        color: #303133 !important;
      }
    }
    
    .check-icon {
      color: #409eff !important;
      font-size: 18px !important;
      transition: all 0.3s ease !important;
    }
  }
}

/* 载体选择相关样式 */
/* 表格中载体输入框和选择按钮的布局样式 */
.carrier-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .carrier-select-btn {
    flex-shrink: 0;
  }
  
  .el-input {
    flex: 1;
  }
}

.carrier-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;

  .carrier-display {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    background-color: #f5f7fa;
    color: #606266;
    min-height: 32px;
    display: flex;
    align-items: center;
  }

  .carrier-select-btn {
    flex-shrink: 0;
  }
}

.carrier-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;

  .carrier-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 20px;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #fafafa;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    &:hover {
      border-color: #409eff;
      background-color: #ecf5ff;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    &.selected {
      border-color: #409eff;
      background-color: #ecf5ff;
      box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
    }

    .carrier-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;

      .carrier-name {
        font-size: 16px;
        font-weight: 600;
        color: #303133;
      }

      .carrier-description {
        font-size: 13px;
        color: #606266;
        opacity: 0.9;
      }
    }

    .check-icon {
      color: #409eff;
      font-size: 20px;
      transition: all 0.3s ease;
      align-self: flex-end;
      margin-top: 8px;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 图片预览相关样式 */
.image-placeholder,
.image-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background-color: #f5f7fa;
  color: #909399;
  font-size: 12px;
  gap: 4px;
}

/* 图片容器样式 */
.image-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 图片包装器样式 */
.image-wrapper {
  display: inline-block;
  position: relative;
}

/* 参考图删除按钮样式 */
.remove-reference-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 12px;
  background-color: #f56c6c;
  border-color: #f56c6c;
}

.remove-reference-btn:hover {
  background-color: #f78989;
  border-color: #f78989;
}

.image-placeholder .el-icon,
.image-error .el-icon {
  font-size: 18px;
}

/* 上传区域样式优化 */
.upload-item {
  margin-bottom: 20px;
  padding: 16px;
  border: 1px solid #ecf5ff;
  border-radius: 8px;
  background-color: #f0f9ff;
}

.upload-item h4 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  color: #337ecc;
}

.upload-item .upload-component {
  margin-bottom: 0;
}

/* 文本列表样式优化 */
:deep(.el-upload-list--text) {
  margin-top: 8px;
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  background-color: #fff;
}

:deep(.el-upload-list--text .el-upload-list__item) {
  margin: 4px 0;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  transition: all 0.3s ease;
}

:deep(.el-upload-list--text .el-upload-list__item:hover) {
  background-color: #ecf5ff;
  transform: translateX(4px);
}

/* 解决拖拽上传和文本列表样式冲突问题 */
:deep(.el-upload--drag) {
  width: 100% !important;
  height: auto !important;
  border: 1px dashed #dcdfe6 !important;
  border-radius: 4px !important;
  background-color: #fafafa !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  margin: 0 !important;
  transition: border-color 0.3s ease !important;
}

:deep(.el-upload-dragger) {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 2px 8px !important;
  margin: 0 !important;
  min-height: 40px !important;
  max-height: 60px !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

:deep(.el-upload__text) {
  font-size: 11px !important;
  margin: 1px 0 !important;
  line-height: 1.2 !important;
}

:deep(.el-upload__tip) {
  font-size: 9px !important;
  margin-top: 1px !important;
  line-height: 1.2 !important;
}

/* 调整上传图标大小 */
:deep(.upload-icon) {
  font-size: 14px !important;
  margin-bottom: 1px !important;
  margin-top: 1px !important;
}

/* 优化上传区域的间距 */
.upload-item {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #ecf5ff;
  border-radius: 8px;
  background-color: #f0f9ff;
}

.upload-item h4 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #337ecc;
}

:deep(.el-upload--drag:hover) {
  border-color: #409eff !important;
}

:deep(.el-upload--drag.is-drag-over) {
  border-color: #409eff !important;
  background-color: rgba(64, 158, 255, 0.04) !important;
}

:deep(.el-upload--drag .el-upload__text) {
  display: block !important;
  color: #606266 !important;
  font-size: 14px !important;
  line-height: 1.5 !important;
  margin: 0 !important;
}

:deep(.el-upload--drag .el-upload__tip) {
  margin-top: 12px !important;
  font-size: 12px !important;
  color: #909399 !important;
}

/* 隐藏图片卡片样式 */
:deep(.el-upload-list--picture-card) {
  display: none !important;
}

/* 确保拖拽上传区域的文本列表显示正常 */
:deep(.el-upload--drag ~ .el-upload-list--text) {
  display: block !important;
}
</style>