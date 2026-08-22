<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  rdsManagementApi,
  type PythonRdsStatus,
  type RdsLivePool,
  type RdsOverview
} from '@/api/rdsManagement'

const loading = ref(false)
const overview = ref<RdsOverview | null>(null)
const python = ref<PythonRdsStatus | null>(null)

const livePools = computed<RdsLivePool[]>(() => {
  const javaPools = overview.value?.livePools || []
  const pythonPools = python.value?.livePools || []
  const byId = new Map<string, RdsLivePool>()
  javaPools.forEach((pool) => byId.set(pool.id, pool))
  pythonPools.forEach((pool) => byId.set(pool.id, pool))
  return [...byId.values()]
})

const routeRows = computed(() => {
  const rows: Array<{ poolId: string; database: string; route: string }> = []
  for (const binding of overview.value?.apiBindings || []) {
    for (const route of binding.routes) {
      rows.push({ poolId: binding.poolId, database: binding.database, route })
    }
  }
  return rows
})

function pingType(ok?: boolean): 'success' | 'danger' | 'info' {
  if (ok === true) return 'success'
  if (ok === false) return 'danger'
  return 'info'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [javaOverview, pythonStatus] = await Promise.all([
      rdsManagementApi.overview(),
      rdsManagementApi.pythonStatus().catch(() => null)
    ])
    overview.value = javaOverview
    python.value = pythonStatus
    if (!pythonStatus) {
      ElMessage.warning('Java 连接清单已加载，Python 实况暂不可用')
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="rds-page">
    <header class="page-header">
      <div>
        <h2>RDS 管理中心</h2>
        <p>连接参数集中在 config/public 与 config/secrets；本页只展示当前进程实际连上的库，以及哪些接口走哪套池。密码不回显。</p>
      </div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </header>

    <section class="summary-band">
      <div>
        <span>配置登记处</span>
        <strong>{{ overview?.connectionRegistry || '加载中' }}</strong>
      </div>
      <div>
        <span>Java 主库</span>
        <el-tag :type="overview?.primaryOnRemote ? 'success' : 'warning'">
          {{ overview?.primaryOnRemote ? '已连远程' : '本地/Docker' }}
        </el-tag>
      </div>
      <div>
        <span>领星/财务池</span>
        <el-tag :type="overview?.rdsPoolOnRemote ? 'success' : 'warning'">
          {{ overview?.rdsPoolOnRemote ? '已连远程' : '本地/Docker' }}
        </el-tag>
      </div>
      <div>
        <span>Python 业务库</span>
        <el-tag :type="python?.rdsOverrideActive ? 'success' : 'warning'">
          {{ python?.rdsOverrideActive ? '已连远程' : python ? '本地/Docker' : '未知' }}
        </el-tag>
      </div>
    </section>

    <p class="hint">{{ overview?.sameInstanceHint }}</p>

    <section class="card">
      <h3>当前连接实况</h3>
      <el-table v-loading="loading" :data="livePools" stripe>
        <el-table-column prop="id" label="连接池" min-width="180" />
        <el-table-column prop="host" label="主机" min-width="200" show-overflow-tooltip />
        <el-table-column prop="port" label="端口" width="80" />
        <el-table-column prop="database" label="库" min-width="120" />
        <el-table-column prop="username" label="账号" min-width="140" />
        <el-table-column label="位置" width="110">
          <template #default="{ row }">
            <el-tag :type="row.remote ? 'success' : 'info'" effect="plain">
              {{ row.remote ? 'RDS 远程' : '本地' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="探测" min-width="200">
          <template #default="{ row }">
            <el-tag :type="pingType(row.ping?.ok)">{{ row.ping?.ok ? '通' : '失败' }}</el-tag>
            <span class="ping-msg">{{ row.ping?.message }}</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card">
      <h3>连接登记（环境变量）</h3>
      <el-table :data="overview?.declaredPools || []" stripe>
        <el-table-column prop="id" label="登记 ID" min-width="180" />
        <el-table-column prop="owner" label="服务" min-width="140" />
        <el-table-column prop="database" label="库" width="120" />
        <el-table-column prop="envKeys" label="环境变量" min-width="200" />
        <el-table-column prop="configFile" label="配置文件" min-width="140" />
        <el-table-column prop="purpose" label="用途" min-width="280" show-overflow-tooltip />
      </el-table>
    </section>

    <section class="card">
      <h3>数据接口绑定</h3>
      <p>下列路径在对应连接池上读写业务数据。网关路由与此清单对应。</p>
      <el-table :data="routeRows" stripe max-height="480">
        <el-table-column prop="poolId" label="连接池" min-width="180" />
        <el-table-column prop="database" label="库" width="120" />
        <el-table-column prop="route" label="接口 / 写入入口" min-width="420" show-overflow-tooltip />
      </el-table>
    </section>
  </div>
</template>

<style scoped lang="scss">
.rds-page { padding: 20px; color: #1f2937; }
.page-header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
h2, h3 { margin: 0; }
h2 { font-size: 24px; }
h3 { font-size: 16px; margin-bottom: 12px; }
p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.hint { margin: 0 0 14px; }
.summary-band {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
  padding: 16px;
  color: #fff;
  background: #303133;
}
.summary-band span, .summary-band strong { display: block; }
.summary-band span { color: #c8c9cc; font-size: 12px; }
.summary-band strong { margin-top: 6px; font-size: 13px; font-weight: 500; }
.card { margin-bottom: 14px; padding: 16px; border: 1px solid #e5e7eb; background: #fff; }
.ping-msg { margin-left: 8px; color: #6b7280; font-size: 12px; }
@media (max-width: 900px) {
  .summary-band { grid-template-columns: 1fr 1fr; }
}
</style>
