<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    :before-close="handleClose"
  >
    <el-form 
      ref="formRef" 
      :model="formData" 
      :rules="formRules" 
      label-width="80px"
      :validate-on-rule-change="false"
    >
      <!-- 元素输入 -->
      <el-form-item label="元素" prop="element">
        <el-input
          v-model="formData.element"
          placeholder="请输入元素"
          clearable
        />
      </el-form-item>

      <!-- 批次输入 -->
      <el-form-item label="批次" prop="batch">
        <el-input
          v-model="formData.batch"
          placeholder="请输入批次"
          clearable
        />
      </el-form-item>

      <!-- 日期选择 -->
      <el-form-item label="日期" prop="date">
        <el-date-picker
          v-model="formData.date"
          type="date"
          placeholder="选择日期"
          format="YYYYMMDD"
          value-format="YYYYMMDD"
          class="date-picker"
          @change="handleDateChange"
        />
      </el-form-item>

      <!-- 开发人输入 -->
      <el-form-item label="开发人" prop="developer">
        <div class="developer-input-wrapper">
          <el-input
            v-model="formData.developer"
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

      <!-- 载体选择 -->
      <el-form-item label="载体" prop="carrier">
        <div class="carrier-select-wrapper">
          <span class="carrier-display">{{ formData.carrier || '请选择载体' }}</span>
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

      <!-- 修改要求 -->
      <el-form-item label="修改要求" prop="modificationRequirement">
        <el-input
          v-model="formData.modificationRequirement"
          placeholder="请输入修改要求"
          type="textarea"
          :rows="3"
          clearable
        />
      </el-form-item>

      <!-- 状态选择 -->
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="formData.status">
          <el-radio label="concept">构思</el-radio>
          <el-radio label="optimizing">未完成在优化</el-radio>
          <el-radio label="finalized">已定稿</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          确定
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
import { ref, reactive, computed } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { User, Van, Check } from '@element-plus/icons-vue'
// 导入API
import { finalDraftApi } from '@/api/finalDraft'
import { systemConfigApi } from '@/api/systemConfig'

interface Props {
  modelValue: boolean
  selectedIds: number[]
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

const formRef = ref<FormInstance>()
const submitting = ref(false)

// 表单数据
const formData = reactive({
  element: '',
  batch: '',
  date: '',
  developer: '',
  carrier: '',
  modificationRequirement: '',
  status: '' as 'finalized' | 'optimizing' | 'concept' | ''
})

// 开发人选择相关数据
const developerDialogVisible = ref(false)
const selectedDeveloper = ref<string>('')
const developerList = ref<string[]>([])

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

// 载体选择相关数据
const carrierDialogVisible = ref(false)
const selectedCarrier = ref<string>('')
const carrierList = ref<{value: string, name: string, description: string}[]>([])

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

// 表单验证规则
const formRules = {
  // 批量修改时，所有字段都是可选的
}

// 计算属性
const dialogTitle = computed(() => {
  return `批量修改 (共 ${props.selectedIds.length} 个产品)`
})

// 方法
const resetForm = (): void => {
  formData.element = ''
  formData.batch = ''
  formData.date = ''
  formData.developer = ''
  formData.carrier = ''
  formData.modificationRequirement = ''
  formData.status = ''
}

const handleClose = (): void => {
  dialogVisible.value = false
  resetForm()
  // 清除表单验证状态，确保下次打开时没有残留的错误提示
  if (formRef.value) {
    formRef.value.clearValidate()
  }
}

// 开发人选择相关方法
const handleDeveloperSelect = (): void => {
  developerDialogVisible.value = true
  selectedDeveloper.value = formData.developer
}

const handleDeveloperDialogClose = (): void => {
  developerDialogVisible.value = false
  selectedDeveloper.value = ''
}

const selectDeveloper = (developer: string): void => {
  selectedDeveloper.value = developer
}

const confirmDeveloperSelection = (): void => {
  formData.developer = selectedDeveloper.value
  developerDialogVisible.value = false
}

// 载体选择相关方法
const handleCarrierSelect = (): void => {
  carrierDialogVisible.value = true
  selectedCarrier.value = formData.carrier
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
    formData.carrier = selectedCarrierObj.name
  }
  carrierDialogVisible.value = false
}

// 处理日期变化，自动同步到批次字段
const handleDateChange = (date: string): void => {
  if (date) {
    formData.batch = date
  }
}

const handleSubmit = async (): Promise<void> => {
  if (!formRef.value) return

  try {
    // 验证至少有一个字段被修改
    const hasChangedFields = Object.values(formData).some(value => value !== '')
    if (!hasChangedFields) {
      ElMessage.warning('请至少修改一个字段')
      return
    }

    submitting.value = true
    
    // 准备API请求数据，只包含非空字段
    const apiData: any = {
      ids: props.selectedIds
    }
    
    // 只添加非空字段到请求数据中，排除date字段
    if (formData.element) {
      apiData.element = formData.element
    }
    
    if (formData.batch) {
      apiData.batch = formData.batch
    }
    
    if (formData.developer) {
      apiData.developer = formData.developer
    }
    
    if (formData.carrier) {
      apiData.carrier = formData.carrier
    }
    
    if (formData.modificationRequirement) {
      apiData.modification_requirement = formData.modificationRequirement
    }
    
    if (formData.status) {
      apiData.status = formData.status
    }
    
    console.log('批量修改API请求数据:', apiData)
    
    // 调用批量更新API
    const response = await finalDraftApi.batchUpdate(apiData)
    
    if (response.code === 200) {
      ElMessage.success({
        message: `批量修改成功，共修改 ${props.selectedIds.length} 个产品`,
        duration: 2000
      })
      emit('success')
      handleClose()
    } else {
      ElMessage.error({
        message: response.message || '操作失败',
        duration: 5000
      })
    }
  } catch (error: any) {
    console.error('批量修改失败:', error)
    const errorMessage = error.response?.data?.message || error.message || '操作失败'
    ElMessage.error({
      message: `批量修改失败: ${errorMessage}`,
      duration: 5000
    })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
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
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  
  .developer-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
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
    
    .developer-info {
      display: flex;
      align-items: center;
      
      .developer-name {
        font-size: 15px;
        font-weight: 600;
        color: #303133;
      }
    }
    
    .check-icon {
      color: #409eff;
      font-size: 18px;
      transition: all 0.3s ease;
    }
  }
}

/* 载体选择相关样式 */
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
</style>