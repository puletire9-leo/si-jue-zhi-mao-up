<template>
  <el-collapse v-model="activeCollapse" class="filter-config-panel">

    <!-- 初筛配置 -->
    <el-collapse-item name="initial">
      <template #title>
        <div class="panel-title">
          <span>初筛配置</span>
          <el-tag type="info" size="small" style="margin-left: 12px;">价格 + 评论数</el-tag>
          <span class="panel-hint">ASIN 导入时第一步筛选：价格区间 + 评论数上限</span>
        </div>
      </template>

      <div class="filter-config-body">
        <el-row :gutter="16">
          <el-col :span="8">
            <div class="config-item">
              <label>价格下限 (£)</label>
              <el-input-number
                v-model="initialConfig.priceMin"
                :min="0"
                :max="100"
                :precision="2"
                :step="0.5"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>价格上限 (£)</label>
              <el-input-number
                v-model="initialConfig.priceMax"
                :min="0"
                :max="200"
                :precision="2"
                :step="0.5"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>评论数上限</label>
              <el-input-number
                v-model="initialConfig.reviewMax"
                :min="0"
                :max="1000"
                :step="1"
                size="small"
                controls-position="right"
              />
              <div class="config-hint">评论数 ≤ 此值才进入下一步</div>
            </div>
          </el-col>
        </el-row>

        <div class="actions">
          <el-button type="primary" @click="handleSaveInitial" :loading="savingInitial">保存初筛配置</el-button>
          <el-button @click="handleLoadInitial">重置</el-button>
        </div>
      </div>
    </el-collapse-item>

    <!-- 精筛配置 -->
    <el-collapse-item name="filter">
      <template #title>
        <div class="panel-title">
          <span>精筛配置</span>
          <el-tag type="warning" size="small" style="margin-left: 12px;">
            模式一 / 模式二
          </el-tag>
          <span class="panel-hint">导入时自动判定 MODE1 / MODE2 / FAIL，改配置后自动重新筛选</span>
        </div>
      </template>

      <div class="filter-config-body">
        <el-row :gutter="16">
          <el-col :span="8">
            <div class="config-item">
              <label>价格下限 (£)</label>
              <el-input-number
                v-model="config.priceMin"
                :min="0"
                :max="100"
                :precision="2"
                :step="0.5"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>价格上限 (£)</label>
              <el-input-number
                v-model="config.priceMax"
                :min="0"
                :max="200"
                :precision="2"
                :step="0.5"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>最大上架天数</label>
              <el-input-number
                v-model="config.listingDaysMax"
                :min="1"
                :max="365"
                :step="5"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16" style="margin-top: 12px;">
          <el-col :span="8">
            <div class="config-item">
              <label>BSR 上限</label>
              <el-input-number
                v-model="config.bsrMax"
                :min="100"
                :max="200000"
                :step="1000"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>销量下限</label>
              <el-input-number
                v-model="config.salesMin"
                :min="0"
                :max="100"
                :step="1"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>销量上限</label>
              <el-input-number
                v-model="config.salesMax"
                :min="10"
                :max="2000"
                :step="10"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
        </el-row>

        <el-row :gutter="16" style="margin-top: 12px;">
          <el-col :span="8">
            <div class="config-item">
              <label>最大重量 (g)</label>
              <el-input-number
                v-model="config.weightMax"
                :min="50"
                :max="5000"
                :step="50"
                size="small"
                controls-position="right"
              />
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>无销量排名判定天数</label>
              <el-input-number
                v-model="config.deadDays"
                :min="7"
                :max="180"
                :step="5"
                size="small"
                controls-position="right"
              />
              <div class="config-hint">超过此天数且无销量无排名 → 淘汰</div>
            </div>
          </el-col>
        </el-row>

        <div class="section-divider">
          <span>模式二（满足其一即通过）</span>
        </div>
        <el-row :gutter="16">
          <el-col :span="8">
            <div class="config-item">
              <label>销量下限</label>
              <el-input-number
                v-model="config.mode2SalesMin"
                :min="10"
                :max="500"
                :step="10"
                size="small"
                controls-position="right"
              />
              <div class="config-hint">月销量 > 此值即通过</div>
            </div>
          </el-col>
          <el-col :span="8">
            <div class="config-item">
              <label>BSR 上限</label>
              <el-input-number
                v-model="config.mode2BsrMax"
                :min="500"
                :max="100000"
                :step="1000"
                size="small"
                controls-position="right"
              />
              <div class="config-hint">BSR < 此值即通过</div>
            </div>
          </el-col>
        </el-row>

        <div class="actions">
          <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
          <el-button :disabled="savingReapplying" @click="handleReapply" :loading="savingReapplying">重新筛选</el-button>
          <el-button @click="handleLoad">重置</el-button>
        </div>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { competitorApi } from '@/api/competitor'

const props = withDefaults(defineProps<{
  marketplace?: string
}>(), {
  marketplace: 'UK'
})

interface InitialFilterConfig {
  priceMin: number
  priceMax: number
  reviewMax: number
}

interface FilterConfig {
  priceMin: number
  priceMax: number
  listingDaysMax: number
  bsrMax: number
  salesMin: number
  salesMax: number
  weightMax: number
  deadDays: number
  mode2SalesMin: number
  mode2BsrMax: number
}

const activeCollapse = ref<string[]>([])

// 初筛配置
const initialConfig = reactive<InitialFilterConfig>({
  priceMin: 4.99,
  priceMax: 19.99,
  reviewMax: 5,
})
const savingInitial = ref(false)

const handleLoadInitial = async () => {
  try {
    const res = await competitorApi.getInitialFilterConfig(props.marketplace)
    if (res.code === 200 && res.data) {
      Object.assign(initialConfig, res.data)
    }
  } catch (e) {
    ElMessage.error('加载初筛配置失败')
  }
}

const handleSaveInitial = async () => {
  savingInitial.value = true
  try {
    const res = await competitorApi.updateInitialFilterConfig({ ...initialConfig }, props.marketplace)
    if (res.code === 200) {
      ElMessage.success('初筛配置已保存')
      if (res.data) Object.assign(initialConfig, res.data)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存初筛配置失败')
  } finally {
    savingInitial.value = false
  }
}

// 精筛配置
const config = reactive<FilterConfig>({
  priceMin: 4.99,
  priceMax: 30.0,
  listingDaysMax: 90,
  bsrMax: 50000,
  salesMin: 5,
  salesMax: 200,
  weightMax: 300,
  deadDays: 30,
  mode2SalesMin: 50,
  mode2BsrMax: 20000,
})
const saving = ref(false)

const handleLoad = async () => {
  try {
    const res = await competitorApi.getFilterConfig(props.marketplace)
    if (res.code === 200 && res.data) {
      Object.assign(config, res.data)
    }
  } catch (e) {
    ElMessage.error('加载精筛配置失败')
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const res = await competitorApi.updateFilterConfig({ ...config }, props.marketplace)
    if (res.code === 200) {
      ElMessage.success('精筛配置已保存')
      if (res.data) Object.assign(config, res.data)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存精筛配置失败')
  } finally {
    saving.value = false
  }
}

const savingReapplying = ref(false)

const handleReapply = async () => {
  savingReapplying.value = true
  try {
    const res = await competitorApi.reapplyFilter(props.marketplace)
    if (res.code === 200) {
      ElMessage.success('重新筛选完成')
    } else {
      ElMessage.error(res.message || '重新筛选失败')
    }
  } catch (e) {
    ElMessage.error('重新筛选失败')
  } finally {
    savingReapplying.value = false
  }
}

// 当 marketplace 变化时，重新加载配置
watch(() => props.marketplace, () => {
  handleLoadInitial()
  handleLoad()
})

onMounted(() => {
  handleLoadInitial()
  handleLoad()
})
</script>

<style scoped lang="scss">
.filter-config-panel {
  margin-bottom: 16px;
}

.panel-title {
  display: flex;
  align-items: center;
  font-weight: 500;

  .panel-hint {
    margin-left: auto;
    font-size: 12px;
    color: #909399;
    font-weight: 400;
  }
}

.filter-config-body {
  padding: 8px 0;
}

.section-divider {
  margin: 12px 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #dcdfe6;
  span {
    font-size: 12px;
    color: #909399;
  }
}

.config-item {
  label {
    display: block;
    font-size: 13px;
    color: #606266;
    margin-bottom: 4px;
  }

  .config-hint {
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #e2e8f0;
}
</style>
