<template>
  <el-dialog
    :model-value="modelValue"
    :title="`基线成员 — ${baseline?.baselineName || baselineCode}`"
    width="820px"
    @update:model-value="(v) => emit('update:modelValue', v)"
    @open="onOpen"
  >
    <div class="member-toolbar">
      <el-select v-model="filterMarket" placeholder="全部市场" size="small" clearable style="width: 130px" @change="loadMembers">
        <el-option v-for="m in MARKETPLACES" :key="m" :label="m" :value="m" />
      </el-select>
      <div class="spacer" />
      <el-button size="small" :loading="loading" @click="loadMembers">刷新</el-button>
    </div>

    <!-- 新增成员表单 -->
    <el-form :model="form" :rules="rules" ref="formRef" inline class="member-form" size="small">
      <el-form-item label="市场" prop="marketplace">
        <el-select v-model="form.marketplace" style="width: 90px">
          <el-option v-for="m in MARKETPLACES" :key="m" :label="m" :value="m" />
        </el-select>
      </el-form-item>
      <el-form-item label="店铺名" prop="sellerName">
        <el-input v-model="form.sellerName" placeholder="sellerName" style="width: 180px" />
      </el-form-item>
      <el-form-item label="sellerId">
        <el-input v-model="form.sellerId" placeholder="可空" style="width: 130px" />
      </el-form-item>
      <el-form-item label="权重">
        <el-input-number v-model="form.weight" :min="0" :step="0.5" :controls="false" style="width: 80px" />
      </el-form-item>
      <el-form-item label="来源">
        <el-input v-model="form.sourceReason" placeholder="sourceReason" style="width: 150px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="adding" @click="handleAdd">添加成员</el-button>
      </el-form-item>
    </el-form>

    <el-table :data="members" v-loading="loading" border stripe size="small" max-height="360">
      <el-table-column label="市场" width="70">
        <template #default="{ row }">
          <span class="badge-market" :style="marketBadgeStyle(row.marketplace)">{{ row.marketplace }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="sellerName" label="店铺名" min-width="160" show-overflow-tooltip />
      <el-table-column prop="sellerId" label="sellerId" width="130" show-overflow-tooltip>
        <template #default="{ row }"><span class="mono">{{ row.sellerId || '—' }}</span></template>
      </el-table-column>
      <el-table-column prop="weight" label="权重" width="80" align="right" />
      <el-table-column prop="sourceReason" label="来源" min-width="120" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">{{ row.status || 'ACTIVE' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无成员，请先在上方添加" :image-size="60" />
      </template>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { shopProfileBaselineApi } from '@/api/shopProfile'
import type { Marketplace, ShopProfileBaseline, ShopProfileBaselineMember } from '@/types/shopProfile'
import { MARKETPLACES, marketColor } from '../utils'

const props = defineProps<{
  modelValue: boolean
  baselineCode: string
  baseline?: ShopProfileBaseline | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'changed'): void
}>()

const loading = ref(false)
const adding = ref(false)
const members = ref<ShopProfileBaselineMember[]>([])
const filterMarket = ref<Marketplace | ''>('')

const formRef = ref<FormInstance>()
const form = reactive<ShopProfileBaselineMember>({
  marketplace: 'UK',
  sellerName: '',
  sellerId: '',
  sourceReason: '',
  weight: 1,
  status: 'ACTIVE'
})

const rules: FormRules = {
  marketplace: [{ required: true, message: '选择市场', trigger: 'change' }],
  sellerName: [{ required: true, message: '填写店铺名', trigger: 'blur' }]
}

function marketBadgeStyle(m: string) {
  const c = marketColor(m)
  return { background: c.bg, color: c.fg }
}

function onOpen() {
  loadMembers()
}

async function loadMembers() {
  if (!props.baselineCode) return
  loading.value = true
  try {
    members.value = await shopProfileBaselineApi.members(props.baselineCode, {
      marketplace: filterMarket.value || undefined
    })
  } catch (e: any) {
    ElMessage.error(e?.message || '加载成员失败')
  } finally {
    loading.value = false
  }
}

async function handleAdd() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    adding.value = true
    try {
      await shopProfileBaselineApi.addMember(props.baselineCode, {
        marketplace: form.marketplace,
        sellerName: form.sellerName.trim(),
        sellerId: form.sellerId || undefined,
        sourceReason: form.sourceReason || undefined,
        weight: form.weight ?? 1,
        status: 'ACTIVE'
      })
      ElMessage.success('已添加成员')
      form.sellerName = ''
      form.sellerId = ''
      form.sourceReason = ''
      form.weight = 1
      await loadMembers()
      emit('changed')
    } catch (e: any) {
      ElMessage.error(e?.message || '添加失败')
    } finally {
      adding.value = false
    }
  })
}

async function handleDelete(row: ShopProfileBaselineMember) {
  try {
    await ElMessageBox.confirm(
      `确认从基线移除成员「${row.sellerName}」（${row.marketplace}）？`,
      '删除基线成员',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await shopProfileBaselineApi.deleteMember(row.id as number)
    ElMessage.success('已删除')
    await loadMembers()
    emit('changed')
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}
</script>

<style scoped lang="scss">
.member-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  .spacer {
    flex: 1;
  }
}
.member-form {
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
  margin-bottom: 12px;
}
.badge-market {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
</style>
