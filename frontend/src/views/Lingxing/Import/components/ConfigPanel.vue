<template>
  <div class="config-panel">
    <el-card class="config-card" :body-style="{ padding: '15px' }">
      <template #header>
        <div class="config-header" @click="isExpanded = !isExpanded">
          <div class="header-left">
            <el-icon class="expand-icon" :class="{ 'is-expanded': isExpanded }">
              <ArrowDown />
            </el-icon>
            <span class="header-title">固定值配置</span>
            <el-tag size="small" type="info" class="config-count">{{ filledCount }}/{{ totalCount }}</el-tag>
          </div>
          <el-button 
            v-if="isExpanded" 
            type="primary" 
            size="small" 
            @click.stop="saveConfig"
            :loading="saving"
          >
            保存配置
          </el-button>
        </div>
      </template>
      
      <el-collapse-transition>
        <div v-show="isExpanded" class="config-content">
          <el-row :gutter="20">
            <el-col :span="8" v-for="(value, key) in config" :key="key">
              <el-form-item :label="configLabels[key]" class="config-item">
                <el-input
                  v-model="config[key]"
                  :placeholder="`请输入${configLabels[key]}`"
                  size="small"
                  clearable
                />
              </el-form-item>
            </el-col>
          </el-row>
          
          <el-divider />
          
          <div class="config-actions">
            <el-button type="danger" size="small" @click="resetConfig">重置默认</el-button>
            <el-button type="info" size="small" @click="clearConfig">清空配置</el-button>
          </div>
        </div>
      </el-collapse-transition>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'

// 配置项标签
const configLabels: Record<string, string> = {
  developer: '开发人',
  productManager: '产品负责人',
  purchaser: '采购员',
  purchaseLeadTime: '采购交期',
  auxiliarySku: '辅料SKU',
  auxiliaryRatioMain: '辅料比例(主料)',
  auxiliaryRatioAux: '辅料比例(辅料)'
}

// 默认配置
const defaultConfig = {
  developer: '刘淼',
  productManager: '唐若,张亚芳,阳姣,尹心如,蒋舒,张奋奋',
  purchaser: '王亚成',
  purchaseLeadTime: '7',
  auxiliarySku: '2270356',
  auxiliaryRatioMain: '1',
  auxiliaryRatioAux: '1'
}

// 本地存储键名
const STORAGE_KEY = 'lingxing_import_config'

// 响应式数据
const isExpanded = ref(false)
const saving = ref(false)
const config = reactive<Record<string, string>>({ ...defaultConfig })

// 计算属性
const totalCount = computed(() => Object.keys(configLabels).length)
const filledCount = computed(() => {
  return Object.entries(config).filter(([_, value]) => value && value.trim() !== '').length
})

// 方法
const loadConfig = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      Object.assign(config, parsed)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

const saveConfig = () => {
  saving.value = true
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    ElMessage.success('配置保存成功')
    isExpanded.value = false
  } catch (error) {
    ElMessage.error('配置保存失败')
    console.error(error)
  } finally {
    saving.value = false
  }
}

const resetConfig = () => {
  Object.assign(config, defaultConfig)
  ElMessage.success('已重置为默认配置')
}

const clearConfig = () => {
  Object.keys(config).forEach(key => {
    config[key] = ''
  })
  ElMessage.success('已清空配置')
}

// 获取配置（供父组件使用）
const getConfig = () => {
  return {
    developer: config.developer,
    productManager: config.productManager,
    purchaser: config.purchaser,
    purchaseLeadTime: parseInt(config.purchaseLeadTime) || 7,
    auxiliarySku: config.auxiliarySku,
    auxiliaryRatioMain: parseInt(config.auxiliaryRatioMain) || 1,
    auxiliaryRatioAux: parseInt(config.auxiliaryRatioAux) || 1
  }
}

// 暴露方法给父组件
defineExpose({
  getConfig
})

// 生命周期
onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.config-panel {
  margin-bottom: 20px;
}

.config-card {
  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    user-select: none;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      
      .expand-icon {
        transition: transform 0.3s;
        
        &.is-expanded {
          transform: rotate(180deg);
        }
      }
      
      .header-title {
        font-weight: 600;
        font-size: 14px;
      }
      
      .config-count {
        margin-left: 5px;
      }
    }
  }
  
  .config-content {
    padding-top: 15px;
    
    .config-item {
      margin-bottom: 15px;
      
      :deep(.el-form-item__label) {
        font-size: 12px;
        padding-bottom: 4px;
      }
    }
    
    .config-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  }
}
</style>
