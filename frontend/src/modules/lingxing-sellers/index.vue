<template>
  <div class="lingxing-sellers">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <span class="title">领星店铺</span>
            <span class="summary-text">
              同步领星已授权的亚马逊店铺（sid 来源）。产品表现、利润统计等按店铺维度取数依赖此表
            </span>
          </div>
          <div class="header-actions">
            <el-select
              v-model="statusFilter"
              placeholder="全部状态"
              clearable
              size="small"
              style="width: 130px"
              @change="fetchList"
            >
              <el-option label="正常" :value="1" />
              <el-option label="停止同步" :value="0" />
              <el-option label="授权异常" :value="2" />
              <el-option label="欠费停服" :value="3" />
            </el-select>
            <el-button
              type="primary"
              size="small"
              :loading="syncing"
              @click="handleSync"
            >
              同步店铺
            </el-button>
            <el-button size="small" :loading="loading" @click="fetchList">刷新</el-button>
          </div>
        </div>
      </template>

      <el-table :data="rows" v-loading="loading" border stripe size="small">
        <el-table-column prop="sid" label="sid" width="90" />
        <el-table-column prop="name" label="店铺名" min-width="160" show-overflow-tooltip />
        <el-table-column prop="country" label="国家" width="100" />
        <el-table-column prop="region" label="站点" width="80" />
        <el-table-column prop="sellerId" label="亚马逊店铺 ID" width="150" show-overflow-tooltip />
        <el-table-column prop="accountName" label="账户名" width="130" show-overflow-tooltip />
        <el-table-column label="广告授权" width="90">
          <template #default="{ row }">
            <el-tag :type="row.hasAdsSetting === 1 ? 'success' : 'info'" size="small">
              {{ row.hasAdsSetting === 1 ? '已授权' : '未授权' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="syncedAt" label="同步时间" width="170" />
      </el-table>

      <el-empty v-if="!loading && rows.length === 0" description="暂无数据，点右上角「同步店铺」" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { lingxingProductApi, type LingxingSeller } from '@/api/lingxingProduct'

const loading = ref(false)
const syncing = ref(false)
const rows = ref<LingxingSeller[]>([])
const statusFilter = ref<number | undefined>(undefined)

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

/** 店铺状态：0-停止同步 1-正常 2-授权异常 3-欠费停服 */
function statusLabel(status: number | null): string {
  const map: Record<number, string> = { 0: '停止同步', 1: '正常', 2: '授权异常', 3: '欠费停服' }
  return status == null ? '—' : map[status] ?? String(status)
}

function statusTagType(status: number | null): TagType {
  const map: Record<number, TagType> = { 0: 'info', 1: 'success', 2: 'danger', 3: 'danger' }
  return status == null ? 'info' : map[status] ?? 'info'
}

async function fetchList() {
  loading.value = true
  try {
    rows.value = await lingxingProductApi.listSellers(statusFilter.value)
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleSync() {
  syncing.value = true
  try {
    const r = await lingxingProductApi.syncSellers()
    ElMessage.success(`同步完成：拉取 ${r.fetched} 个店铺 / 落库 ${r.upserted} 个`)
    await fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

onMounted(fetchList)
</script>

<style scoped lang="scss">
.lingxing-sellers {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    .title {
      font-size: 16px;
      font-weight: 600;
    }
    .summary-text {
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }
  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
}
</style>
