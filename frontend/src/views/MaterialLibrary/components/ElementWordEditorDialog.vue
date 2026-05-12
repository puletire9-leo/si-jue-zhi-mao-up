<template>
  <el-dialog
    v-model="dialogVisible"
    title="元素词编辑"
    width="600px"
    destroy-on-close
  >
    <div class="element-word-editor">
      <!-- 元素词列表 -->
      <div class="element-list">
        <div
          v-for="(element, index) in elements"
          :key="index"
          class="element-item"
        >
          <el-input
            v-model="element.value"
            placeholder="输入元素词"
            class="element-input"
            @keyup.enter="addElement"
            @keyup.delete="handleDeleteElement(index)"
          >
            <template #append>
              <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                @click="deleteElement(index)"
                class="delete-btn"
              />
            </template>
          </el-input>
        </div>
      </div>
      
      <!-- 添加元素词按钮 -->
      <el-button
        type="primary"
        :icon="Plus"
        @click="addElement"
        class="add-element-btn"
      >
        添加元素词
      </el-button>
      
      <!-- 提示信息 -->
      <el-alert
        v-if="elements.length === 0"
        title="请添加元素词"
        type="info"
        :closable="false"
        show-icon
        class="empty-alert"
      />
    </div>
    
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { materialLibraryApi } from '@/api/materialLibrary'

// Props
const props = defineProps<{
  modelValue: boolean
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success'): void
}>()

// 响应式数据
const dialogVisible = ref(props.modelValue)
const elements = ref<{ value: string }[]>([])
const saving = ref(false)

// 监听props变化
watch(() => props.modelValue, (newValue) => {
  dialogVisible.value = newValue
  if (newValue) {
    loadElements()
  }
})

// 监听dialogVisible变化，更新父组件
watch(dialogVisible, (newValue) => {
  emit('update:modelValue', newValue)
})

// 加载元素词列表
const loadElements = async () => {
  try {
    const response = await materialLibraryApi.getElements()
    if (response.code === 200 && Array.isArray(response.data)) {
      elements.value = response.data.map((element: string) => ({ value: element }))
    } else {
      elements.value = []
    }
  } catch (error) {
    console.error('加载元素词失败:', error)
    ElMessage.error('加载元素词失败')
    elements.value = []
  }
}

// 添加元素词
const addElement = () => {
  elements.value.push({ value: '' })
  // 自动聚焦到新添加的输入框
  setTimeout(() => {
    const inputs = document.querySelectorAll('.element-input input') as NodeListOf<HTMLInputElement>
    if (inputs.length > 0) {
      inputs[inputs.length - 1].focus()
    }
  }, 100)
}

// 删除元素词
const deleteElement = (index: number) => {
  elements.value.splice(index, 1)
}

// 处理键盘删除事件
const handleDeleteElement = (index: number) => {
  if (elements.value[index].value === '' && elements.value.length > 0) {
    elements.value.splice(index, 1)
  }
}

// 保存元素词
const save = async () => {
  // 过滤空值并去重
  const filteredElements = elements.value
    .map(item => item.value.trim())
    .filter(item => item !== '')
  
  // 去重
  const uniqueElements = [...new Set(filteredElements)]
  
  if (uniqueElements.length === 0) {
    ElMessage.warning('请至少添加一个元素词')
    return
  }
  
  saving.value = true
  try {
    const response = await materialLibraryApi.updateElements(uniqueElements)
    if (response.code === 200) {
      ElMessage.success('保存成功')
      dialogVisible.value = false
      emit('success')
    } else {
      ElMessage.error(response.message || '保存失败')
    }
  } catch (error) {
    console.error('保存元素词失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 取消
const cancel = () => {
  dialogVisible.value = false
}

// 组件挂载时加载元素词
onMounted(() => {
  if (dialogVisible.value) {
    loadElements()
  }
})
</script>

<style scoped lang="scss">
.element-word-editor {
  padding: 10px 0;
}

.element-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
  padding: 10px;
}

.element-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background-color: #f9f9f9;
}

.element-input {
  flex: 1;
}

.delete-btn {
  flex-shrink: 0;
}

.add-element-btn {
  width: 100%;
  margin-bottom: 10px;
}

.empty-alert {
  margin-top: 10px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>