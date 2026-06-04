<template>
  <el-collapse v-model="activeCollapse">
    <el-collapse-item name="scoring">
      <template #title>
        <div class="panel-title">
          <span>评分配置</span>
          <el-tag v-if="gradeStats.length > 0" type="info" size="small" style="margin-left: 12px;">
            共 {{ totalScored }} 个商品已评分
          </el-tag>
        </div>
      </template>

      <div class="scoring-config-panel">
        <!-- 等级统计 -->
        <div class="grade-stats" v-if="gradeStats.length > 0">
          <div
            v-for="stat in gradeStats"
            :key="stat.grade"
            class="grade-stat-item"
            :style="{ borderColor: stat.color }"
          >
            <span class="grade-badge" :style="{ background: stat.color }">{{ stat.grade }}</span>
            <span class="grade-count">{{ stat.count }}</span>
          </div>
        </div>

        <!-- 维度权重配置 -->
        <div class="section">
          <div class="section-title">维度权重 <span class="weight-total" :class="{ valid: weightTotal === 100 }">总和: {{ weightTotal }}%</span></div>
          <div class="weight-grid">
            <div v-for="dim in dimensions" :key="dim.dimensionKey" class="weight-item">
              <div class="weight-label">{{ dim.displayName }}</div>
              <el-slider
                v-model="dim.weight"
                :min="0"
                :max="100"
                :step="1"
                show-input
                input-size="small"
                @change="onWeightChange"
              />
            </div>
          </div>
        </div>

        <!-- 等级阈值配置 -->
        <div class="section">
          <div class="section-title">等级阈值</div>
          <el-table :data="gradeThresholds" border size="small" style="width: 100%">
            <el-table-column label="等级" width="80" align="center">
              <template #default="{ row }">
                <span class="grade-badge" :style="{ background: row.color }">{{ row.grade }}</span>
              </template>
            </el-table-column>
            <el-table-column label="最低分" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.minScore" :min="0" :max="100" size="small" controls-position="right" />
              </template>
            </el-table-column>
            <el-table-column label="最高分" width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.maxScore" :min="0" :max="100" size="small" controls-position="right" />
              </template>
            </el-table-column>
            <el-table-column label="颜色" width="100">
              <template #default="{ row }">
                <el-color-picker v-model="row.color" size="small" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 操作按钮 -->
        <div class="actions">
          <el-button type="primary" @click="handleSave" :loading="saving">保存配置</el-button>
          <el-button type="success" @click="handleRecalculate('all')" :loading="recalculating">重新评分全部</el-button>
          <el-button type="warning" @click="handleScoreCurrentWeek" :loading="scoringCurrentWeek">评分本周数据</el-button>
          <el-button @click="handleLoadConfig">重新加载</el-button>
        </div>
      </div>
    </el-collapse-item>
  </el-collapse>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { selectionApi } from '@/api/selection'

interface DimensionConfig {
  id?: number
  dimensionKey: string
  displayName: string
  weight: number
  thresholds: any[]
  isActive: boolean
}

interface GradeThreshold {
  id?: number
  grade: string
  minScore: number
  maxScore: number
  color: string
}

interface GradeStat {
  grade: string
  count: number
  color: string
}

const activeCollapse = ref<string[]>(['scoring'])
const dimensions = ref<DimensionConfig[]>([])
const gradeThresholds = ref<GradeThreshold[]>([])
const gradeStats = ref<GradeStat[]>([])
const saving = ref(false)
const recalculating = ref(false)
const scoringCurrentWeek = ref(false)

const weightTotal = computed(() => {
  return Math.round(dimensions.value.reduce((sum, d) => sum + d.weight, 0))
})

const totalScored = computed(() => {
  return gradeStats.value.reduce((sum, s) => sum + s.count, 0)
})

const onWeightChange = () => {
  // 触发响应式更新
}

const handleLoadConfig = async () => {
  try {
    const res = await selectionApi.getScoringConfig()
    if (res.code === 200 && res.data) {
      dimensions.value = res.data.dimensions || []
      gradeThresholds.value = res.data.gradeThresholds || []
    }
  } catch (e) {
    ElMessage.error('加载评分配置失败')
  }

  try {
    const statsRes = await selectionApi.getGradeStats()
    if (statsRes.code === 200 && statsRes.data) {
      gradeStats.value = statsRes.data.gradeStats || []
    }
  } catch (e) {
    // ignore
  }
}

const handleSave = async () => {
  if (weightTotal.value !== 100) {
    ElMessage.warning('维度权重总和必须为100%')
    return
  }

  saving.value = true
  try {
    const res = await selectionApi.updateScoringConfig({
      dimensions: dimensions.value,
      gradeThresholds: gradeThresholds.value
    })
    if (res.code === 200) {
      ElMessage.success('评分配置保存成功')
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (e) {
    ElMessage.error('保存评分配置失败')
  } finally {
    saving.value = false
  }
}

const handleRecalculate = async (scope: string) => {
  recalculating.value = true
  try {
    const res = await selectionApi.recalculateScores(scope)
    if (res.code === 200 && res.data) {
      ElMessage.success(`重新评分完成，共评分 ${res.data.totalScored} 个商品`)
      gradeStats.value = res.data.gradeStats || []
    } else {
      ElMessage.error(res.message || '重新评分失败')
    }
  } catch (e) {
    ElMessage.error('重新评分失败')
  } finally {
    recalculating.value = false
  }
}

const handleScoreCurrentWeek = async () => {
  scoringCurrentWeek.value = true
  try {
    const res = await selectionApi.scoreCurrentWeek()
    if (res.code === 200 && res.data) {
      ElMessage.success(`评分完成，共评分 ${res.data.totalScored} 个商品`)
      gradeStats.value = res.data.gradeStats || []
    } else {
      ElMessage.error(res.message || '评分失败')
    }
  } catch (e) {
    ElMessage.error('评分本周数据失败')
  } finally {
    scoringCurrentWeek.value = false
  }
}

onMounted(() => {
  handleLoadConfig()
})
</script>

<style scoped lang="scss">
.scoring-config-panel {
  padding: 8px 0;
}

.panel-title {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.grade-stats {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;

  .grade-stat-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border: 2px solid;
    border-radius: 8px;
    background: #fafafa;

    .grade-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 14px;
    }

    .grade-count {
      font-size: 18px;
      font-weight: 600;
      color: #303133;
    }
  }
}

.section {
  margin-bottom: 24px;

  .section-title {
    font-weight: 600;
    font-size: 15px;
    color: #303133;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;

    .weight-total {
      font-size: 13px;
      font-weight: 400;
      color: #F56C6C;

      &.valid {
        color: #67C23A;
      }
    }
  }
}

.weight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;

  .weight-item {
    .weight-label {
      font-size: 13px;
      color: #606266;
      margin-bottom: 4px;
    }
  }
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}
</style>
