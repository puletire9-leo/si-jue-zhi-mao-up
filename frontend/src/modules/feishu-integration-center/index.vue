<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Connection, EditPen, Refresh } from '@element-plus/icons-vue'
import {
  feishuIntegrationApi,
  type FeishuConfigStatus,
  type FeishuResource
} from '@/api/feishuIntegration'

const loading = ref(false)
const checking = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const resourceDialogVisible = ref(false)
const resourceLoading = ref(false)
const status = ref<FeishuConfigStatus | null>(null)
const resources = ref<FeishuResource[]>([])
const selectedResource = ref<FeishuResource | null>(null)
const discoveredTables = ref<Array<{ table_id?: string; name?: string }>>([])
const form = reactive({ appId: '', appSecret: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [configStatus, resourceRows] = await Promise.all([
      feishuIntegrationApi.status(), feishuIntegrationApi.resources()
    ])
    status.value = configStatus
    resources.value = resourceRows
  } finally { loading.value = false }
}

async function selfCheck(): Promise<void> {
  checking.value = true
  try {
    const result = await feishuIntegrationApi.selfCheck()
    ElMessage.success(result.message || '飞书连接正常')
  } finally { checking.value = false }
}

function openCredentials(): void {
  form.appId = ''
  form.appSecret = ''
  dialogVisible.value = true
}

async function saveCredentials(): Promise<void> {
  if (!form.appId.trim() && !form.appSecret.trim()) {
    ElMessage.warning('至少填写一项凭证')
    return
  }
  saving.value = true
  try {
    await feishuIntegrationApi.saveCredentials({
      appId: form.appId.trim() || undefined,
      appSecret: form.appSecret.trim() || undefined
    })
    ElMessage.success('飞书凭证已保存，明文不会回显')
    dialogVisible.value = false
    await load()
  } finally { saving.value = false }
}

async function inspectResource(value: unknown): Promise<void> {
  const resource = value as FeishuResource
  selectedResource.value = resource
  discoveredTables.value = []
  resourceDialogVisible.value = true
  resourceLoading.value = true
  try {
    const response = await feishuIntegrationApi.checkResource(resource.code)
    const data = response.data as { items?: Array<{ table_id?: string; name?: string }> } | undefined
    discoveredTables.value = data?.items || []
    ElMessage.success(`资源可访问，共 ${discoveredTables.value.length} 张数据表`)
  } finally { resourceLoading.value = false }
}

onMounted(load)
</script>

<template>
  <div class="feishu-page">
    <header class="page-header">
      <div><h2>飞书对接中心</h2><p>统一维护飞书应用身份、权限、业务资源和连通性；流程编排由自动化任务中心负责。</p></div>
      <el-button :icon="Refresh" :loading="loading" @click="load">刷新</el-button>
    </header>

    <section class="identity-band">
      <div class="identity-main">
        <div class="identity-icon"><el-icon><Link /></el-icon></div>
        <div><span>飞书自建应用</span><strong>{{ status?.appIdMasked || '未配置 App ID' }}</strong><small>{{ status?.baseUrl || 'https://open.feishu.cn' }}</small></div>
      </div>
      <div class="identity-state">
        <el-tag :type="status?.configured ? 'success' : 'danger'" size="large">{{ status?.configured ? '凭证已配置' : '凭证不完整' }}</el-tag>
        <span>App Secret：{{ status?.appSecretConfigured ? '已配置' : '未配置' }}</span>
      </div>
      <div class="identity-actions">
        <el-button :icon="EditPen" @click="openCredentials">维护凭证</el-button>
        <el-button type="primary" :icon="Connection" :loading="checking" :disabled="!status?.configured" @click="selfCheck">连接测试</el-button>
      </div>
    </section>

    <section class="permissions-section">
      <div class="section-heading"><div><h3>权限检查清单</h3><p>连接测试验证应用身份；业务资源检查验证多维表格访问能力。</p></div></div>
      <div class="permission-list">
        <div v-for="permission in status?.requiredPermissions || []" :key="permission" class="permission-row">
          <el-icon color="#67c23a"><CircleCheckFilled /></el-icon><code>{{ permission }}</code>
          <span>{{ permission === 'tenant_access_token' ? '应用身份' : '多维表格能力' }}</span>
        </div>
      </div>
    </section>

    <section class="resources-section">
      <div class="section-heading"><div><h3>业务资源</h3><p>资源目标来自后端环境配置，页面不回显 App Token 或 App Secret 明文。</p></div></div>
      <el-table v-loading="loading" :data="resources" stripe>
        <el-table-column prop="name" label="功能" min-width="180" />
        <el-table-column prop="code" label="任务编码" min-width="250" show-overflow-tooltip />
        <el-table-column label="App Token" min-width="150"><template #default="{ row }">{{ row.appTokenMasked || '未配置' }}</template></el-table-column>
        <el-table-column label="数据表" min-width="300">
          <template #default="{ row }"><div class="table-tags"><el-tag v-for="table in row.tables" :key="table.name" :type="table.configured ? 'success' : 'danger'" effect="plain">{{ table.name }} · {{ table.configured ? table.tableId : '未配置' }}</el-tag></div></template>
        </el-table-column>
        <el-table-column label="状态" width="110"><template #default="{ row }"><el-tag :type="row.configured ? 'success' : 'warning'">{{ row.configured ? '配置完整' : '待补配置' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="110" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="inspectResource(row)">检查资源</el-button></template></el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="dialogVisible" title="维护飞书应用凭证" width="520px">
      <el-alert type="warning" :closable="false" title="仅填写需要更新的字段；留空会保留当前值。保存后页面只显示掩码。" />
      <el-form :model="form" label-width="100px" class="credential-form">
        <el-form-item label="App ID"><el-input v-model="form.appId" autocomplete="off" placeholder="cli_..." /></el-form-item>
        <el-form-item label="App Secret"><el-input v-model="form.appSecret" type="password" show-password autocomplete="new-password" placeholder="留空则不修改" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" :loading="saving" @click="saveCredentials">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="resourceDialogVisible" :title="`检查资源 · ${selectedResource?.name || ''}`" width="640px">
      <div v-loading="resourceLoading">
        <el-table v-if="discoveredTables.length" :data="discoveredTables" stripe>
          <el-table-column prop="name" label="数据表名称" min-width="220" />
          <el-table-column prop="table_id" label="Table ID" min-width="240" />
        </el-table>
        <el-empty v-else :image-size="64" description="输入 App Token 后读取可访问的数据表" />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.feishu-page { padding: 20px; color: #1f2937; }
.page-header, .section-heading, .identity-band { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-header { margin-bottom: 18px; }
h2, h3 { margin: 0; letter-spacing: 0; } h2 { font-size: 24px; } h3 { font-size: 16px; }
p { margin: 6px 0 0; color: #6b7280; font-size: 13px; }
.identity-band { align-items: center; padding: 18px; color: #fff; background: #303133; }
.identity-main, .identity-state, .identity-actions { display: flex; align-items: center; gap: 12px; }
.identity-icon { display: grid; width: 44px; height: 44px; place-items: center; color: #303133; background: #fff; border-radius: 6px; font-size: 22px; }
.identity-main span, .identity-main strong, .identity-main small { display: block; }.identity-main span, .identity-main small, .identity-state span { color: #c8c9cc; font-size: 12px; }.identity-main strong { margin: 3px 0; font-size: 17px; }
.identity-state { flex-direction: column; align-items: flex-start; }
.permissions-section, .resources-section { margin-top: 14px; padding: 16px; border: 1px solid #e5e7eb; background: #fff; }.section-heading { margin-bottom: 14px; }
.permission-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid #e5e7eb; }
.permission-row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 8px; padding: 11px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }.permission-row code { overflow: hidden; text-overflow: ellipsis; }.permission-row span { grid-column: 2; color: #909399; font-size: 11px; }
.table-tags { display: flex; flex-wrap: wrap; gap: 6px; }.credential-form { margin-top: 18px; }
@media (max-width: 900px) { .identity-band { align-items: flex-start; flex-direction: column; } .permission-list { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 620px) { .feishu-page { padding: 12px; } .page-header { flex-direction: column; } .identity-actions { flex-wrap: wrap; } .permission-list { grid-template-columns: 1fr; } }
</style>
