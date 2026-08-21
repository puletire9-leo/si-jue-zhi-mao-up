<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  deleteRoster,
  getRosterList,
  saveRoster,
  updateRoster,
  type PersonRoster
} from '@/api/roster'

type RosterForm = Omit<PersonRoster, 'id'> & { id?: number }

const roleOptions = [
  { value: 'developer', label: '开发人员' },
  { value: 'operator', label: '运营人员' },
  { value: 'product_manager', label: '产品负责人' },
  { value: 'purchaser', label: '采购人员' }
]

const activeRole = ref('developer')
const loading = ref(false)
const saving = ref(false)
const rows = ref<PersonRoster[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive<RosterForm>(emptyForm())

const activeRoleLabel = computed(() =>
  roleOptions.find(item => item.value === activeRole.value)?.label ?? '人员'
)

const rules: FormRules<RosterForm> = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  roleType: [{ required: true, message: '请选择职能', trigger: 'change' }]
}

function emptyForm(): RosterForm {
  return {
    name: '',
    roleType: activeRole.value || 'developer',
    sortOrder: 0,
    enabled: 1,
    effectiveFrom: undefined,
    effectiveTo: undefined,
    remark: ''
  }
}

async function loadRows(): Promise<void> {
  loading.value = true
  try {
    rows.value = await getRosterList(activeRole.value, true)
  } finally {
    loading.value = false
  }
}

async function changeRole(role: string | number): Promise<void> {
  activeRole.value = String(role)
  await loadRows()
}

function openCreate(): void {
  Object.assign(form, emptyForm(), { roleType: activeRole.value })
  dialogVisible.value = true
}

function openEdit(value: unknown): void {
  const row = value as PersonRoster
  Object.assign(form, {
    id: row.id,
    name: row.name,
    roleType: row.roleType,
    sortOrder: row.sortOrder ?? 0,
    enabled: row.enabled ?? 1,
    effectiveFrom: row.effectiveFrom || undefined,
    effectiveTo: row.effectiveTo || undefined,
    remark: row.remark || ''
  })
  dialogVisible.value = true
}

async function submit(): Promise<void> {
  await formRef.value?.validate()
  if (form.effectiveFrom && form.effectiveTo && form.effectiveTo < form.effectiveFrom) {
    ElMessage.warning('失效日期不能早于生效日期')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      roleType: form.roleType,
      sortOrder: form.sortOrder,
      enabled: form.enabled,
      effectiveFrom: form.effectiveFrom || null,
      effectiveTo: form.effectiveTo || null,
      remark: form.remark?.trim() || null
    }
    if (form.id) await updateRoster(form.id, payload)
    else await saveRoster(payload)
    ElMessage.success('人员配置已保存')
    dialogVisible.value = false
    await loadRows()
  } finally {
    saving.value = false
  }
}

async function toggleEnabled(rowValue: unknown, value: boolean | string | number): Promise<void> {
  const row = rowValue as PersonRoster
  const enabled = Boolean(value)
  try {
    await updateRoster(row.id, { ...row, enabled: enabled ? 1 : 0 })
    ElMessage.success(enabled ? '已启用' : '已停用')
    await loadRows()
  } catch {
    row.enabled = enabled ? 0 : 1
  }
}

async function disableRow(value: unknown): Promise<void> {
  const row = value as PersonRoster
  await ElMessageBox.confirm(
    `停用“${row.name}”后，新生成且日期处于停用范围外的日报不再展示该人员；历史日报不受影响。`,
    '确认停用',
    { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' }
  )
  await deleteRoster(row.id)
  ElMessage.success('已停用')
  await loadRows()
}

onMounted(loadRows)
</script>

<template>
  <div class="roster-page">
    <div class="page-header">
      <div>
        <h2>人员维度配置</h2>
        <p>财务日报按报表日期读取开发与运营名单；修改配置不会改变已生成的历史日报。</p>
      </div>
      <el-button type="primary" @click="openCreate">新增{{ activeRoleLabel }}</el-button>
    </div>

    <el-alert
      title="生效日期和失效日期均包含当天；留空表示不限制。人员离岗请优先设置失效日期，避免破坏历史口径。"
      type="info"
      :closable="false"
      show-icon
    />

    <el-card shadow="never" class="roster-card">
      <el-tabs :model-value="activeRole" @tab-change="changeRole">
        <el-tab-pane
          v-for="role in roleOptions"
          :key="role.value"
          :name="role.value"
          :label="role.label"
        />
      </el-tabs>

      <el-table v-loading="loading" :data="rows" stripe>
        <el-table-column prop="name" label="姓名" min-width="120" />
        <el-table-column prop="sortOrder" label="排序" width="90" />
        <el-table-column label="生效日期" width="130">
          <template #default="{ row }">{{ row.effectiveFrom || '不限' }}</template>
        </el-table-column>
        <el-table-column label="失效日期" width="130">
          <template #default="{ row }">{{ row.effectiveTo || '长期' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled === 1"
              @change="value => toggleEnabled(row, value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.enabled === 1" link type="danger" @click="disableRow(row)">停用</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无{{ activeRoleLabel }}配置</template>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑人员' : '新增人员'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="请输入真实姓名" />
        </el-form-item>
        <el-form-item label="职能" prop="roleType">
          <el-select v-model="form.roleType" style="width: 100%">
            <el-option v-for="role in roleOptions" :key="role.value" :label="role.label" :value="role.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="有效区间">
          <div class="date-range">
            <el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" placeholder="生效日期" />
            <span>至</span>
            <el-date-picker v-model="form.effectiveTo" type="date" value-format="YYYY-MM-DD" placeholder="失效日期" />
          </div>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.enabled">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.roster-page {
  padding: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;

  h2 { margin: 0 0 8px; color: #1f2937; }
  p { margin: 0; color: #6b7280; }
}

.roster-card { margin-top: 16px; }

.date-range {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;

  :deep(.el-date-editor) { flex: 1; }
}

@media (max-width: 760px) {
  .roster-page { padding: 14px; }
  .page-header { flex-direction: column; }
  .date-range { align-items: stretch; flex-direction: column; }
}
</style>
