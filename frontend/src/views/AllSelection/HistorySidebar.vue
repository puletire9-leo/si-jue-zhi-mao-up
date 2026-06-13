<template>
  <el-drawer
    v-model="visible"
    title="导入历史"
    direction="rtl"
    size="420px"
    :close-on-click-modal="true"
  >
    <div class="history-sidebar">
      <!-- 剩余配额 -->
      <div class="quota-bar">
        <span class="quota-label">本月 API 配额</span>
        <el-progress
          :percentage="quotaPercent"
          :color="quotaColor"
          :stroke-width="18"
        >
          <span class="quota-text">已用 {{ quotaUsed }} / {{ quotaMax }}</span>
        </el-progress>
      </div>

      <!-- 历史列表 -->
      <div class="history-list">
        <SkeletonWrapper :loading="loading" variant="list" :count="8" :rows="2">
          <template v-if="groupedHistory.length === 0">
            <el-empty description="暂无导入记录" />
          </template>

          <div v-for="group in groupedHistory" :key="group.label" class="history-group">
          <div class="group-label">{{ group.label }}</div>

          <div
            v-for="item in group.items"
            :key="item.id"
            class="history-card"
            :class="{ 'is-expanded': expandedId === item.id }"
            @click="toggleExpand(item.id)"
          >
            <div class="card-header">
              <div class="card-title">
                <el-tag
                  :type="statusTag(item.status)"
                  size="small"
                  effect="dark"
                >
                  {{ statusText(item.status) }}
                </el-tag>
                <span class="card-marketplace">{{ item.marketplace }}</span>
                <span class="card-time">{{ formatTime(item.createdAt) }}</span>
              </div>
              <div class="card-summary">
                <span>上传 {{ item.totalCount }}</span>
                <span class="sep">|</span>
                <span class="pass">通过 {{ item.passCount }}</span>
                <span class="sep">|</span>
                <span>入库 {{ item.apiSuccess }}</span>
                <span v-if="item.apiFail > 0" class="sep">|</span>
                <span v-if="item.apiFail > 0" class="fail">失败 {{ item.apiFail }}</span>
              </div>
            </div>

            <!-- 展开详情 -->
            <div v-if="expandedId === item.id" class="card-detail">
              <el-divider style="margin: 8px 0" />
              <el-row :gutter="8">
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">价格淘汰</span>
                    <span class="detail-value warning">{{ item.priceFailCount }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">评论淘汰</span>
                    <span class="detail-value warning">{{ item.reviewFailCount }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">主表跳过</span>
                    <span class="detail-value info">{{ item.skipCount }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">批次</span>
                    <span class="detail-value">{{ item.batchTotal }} 批</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">API 请求次数</span>
                    <span class="detail-value primary">{{ item.apiRequestsUsed || item.batchTotal }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">父 ASIN</span>
                    <span class="detail-value">{{ item.parentAsinCount || '-' }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">变体 ASIN</span>
                    <span class="detail-value">{{ item.variantAsinCount || '-' }}</span>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="detail-item">
                    <span class="detail-label">完成时间</span>
                    <span class="detail-value">{{ formatTime(item.completedAt) }}</span>
                  </div>
                </el-col>
              </el-row>
              <!-- 重试按钮：仅非完成状态或有失败 ASIN 时显示 -->
              <div v-if="item.status === 'ERROR' || item.apiFail > 0 || item.priceFailCount > 0 || item.reviewFailCount > 0 || item.skipCount > 0" class="retry-section">
                <el-button
                  type="primary"
                  size="small"
                  :loading="retryingId === item.id"
                  @click.stop="handleRetry(item)"
                >
                  继续请求失败 ASIN
                </el-button>
              </div>
            </div>
          </div>
        </SkeletonWrapper>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { asinImportApi, type HistoryItem } from '@/api/asinImport'
import { competitorApi } from '@/api/competitor'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue', 'retry-created'])
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const loading = ref(false)
const items = ref<HistoryItem[]>([])
const expandedId = ref<number | null>(null)
const quotaUsed = ref(0)
const quotaMax = ref(200)

function statusTag(s: string) { return s === 'DONE' ? 'success' : s === 'ERROR' ? 'danger' : s === 'RUNNING' ? 'warning' : 'info' }
function statusText(s: string) { return ({ DONE: '完成', ERROR: '失败', RUNNING: '进行中', READY: '就绪', REJECTED: '已拒绝', PAUSED: '暂停', CANCELLED: '取消' } as any)[s] || s }

function formatTime(t: string | null) {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function monthLabel(m: string) {
  if (!m) return '未知月份'
  return m.substring(0, 4) + '-' + m.substring(4, 6)
}
const groupedHistory = computed(() => {
  const groups: Record<string, HistoryItem[]> = {}
  for (const item of items.value) {
    const m = item.dataMonth || (item.createdAt ? new Date(item.createdAt).toISOString().substring(0,7).replace('-','') : '000000')
    if (!groups[m]) groups[m] = []
    groups[m].push(item)
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([m, items]) => ({ label: monthLabel(m), items }))
})

const quotaPercent = computed(() => quotaMax.value > 0 ? Math.round(quotaUsed.value / quotaMax.value * 100) : 0)
const quotaColor = computed(() => quotaPercent.value > 80 ? '#F56C6C' : quotaPercent.value > 50 ? '#E6A23C' : '#67C23A')

const retryingId = ref<number | null>(null)

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handleRetry(item: HistoryItem) {
  retryingId.value = item.id
  try {
    const res = await asinImportApi.retryFailed(item.id)
    ElMessage.success(`已创建新任务 #${res.newTaskId}：${res.total} 个 ASIN（去重 ${res.duplicatesRemoved} 个），${res.batches} 批`)
    // 自动执行新任务
    await asinImportApi.execute(res.newTaskId)
    ElMessage.success(`任务 #${res.newTaskId} 已开始执行`)
    emit('retry-created', res.newTaskId)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.message || '重试失败')
  }
  retryingId.value = null
}

async function loadData() {
  loading.value = true
  try {
    const [histRes, quotaRes] = await Promise.all([
      asinImportApi.history(),
      competitorApi.getQuota()
    ])
    if (histRes?.data) items.value = histRes.data
    if (quotaRes?.data) {
      quotaUsed.value = quotaRes.data.monthUsed || 0
      quotaMax.value = quotaRes.data.maxPerMonth || 200
    }
  } catch (e) { /* ignore */ }
  loading.value = false
}

watch(visible, (v) => { if (v) loadData() })
</script>

<style scoped lang="scss">
.quota-bar {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  .quota-label { font-size: 13px; color: #606266; display: block; margin-bottom: 8px; }
  .quota-text { font-size: 12px; }
}

.history-group {
  margin-bottom: 16px;
  .group-label {
    font-size: 12px; color: #909399; margin-bottom: 8px;
    padding-left: 4px; font-weight: 600;
  }
}

.history-card {
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color .2s;
  &:hover { border-color: #409EFF; }
  &.is-expanded { border-color: #409EFF; background: #f0f5ff; }

  .card-header {
    .card-title {
      display: flex; align-items: center; gap: 8px;
      .card-marketplace { font-weight: 600; font-size: 14px; }
      .card-time { font-size: 12px; color: #909399; margin-left: auto; }
    }
    .card-summary {
      margin-top: 6px; font-size: 12px; color: #606266;
      .sep { margin: 0 4px; color: #dcdfe6; }
      .pass { color: #67C23A; }
      .fail { color: #F56C6C; }
    }
  }

  .card-detail {
    .detail-item {
      display: flex; justify-content: space-between;
      padding: 4px 0; font-size: 12px;
      .detail-label { color: #909399; }
      .detail-value { font-weight: 600; color: #303133; text-align: right; }
      .warning { color: #E6A23C; }
      .info { color: #909399; }
      .primary { color: #409EFF; }
    }
  }
}
</style>
