<template>
  <div class="filter-preset-bar">
    <span class="bar-label">我的筛选：</span>

    <el-radio-group
      v-model="activePresetId"
      size="small"
      @change="onPresetChange"
    >
      <el-radio-button
        v-for="p in presets"
        :key="p.id"
        :value="p.id"
      >
        <el-icon v-if="p.isDefault"><StarFilled /></el-icon>
        {{ p.presetName }}
      </el-radio-button>
    </el-radio-group>

    <el-popover
      v-model:visible="savePopVisible"
      placement="bottom"
      :width="280"
      trigger="click"
    >
      <template #reference>
        <el-button size="small" :type="activePresetId ? 'warning' : 'primary'" plain>
          <el-icon><Plus /></el-icon>
          {{ activePresetId ? '更新' : '保存当前筛选' }}
        </el-button>
      </template>
      <el-input v-model="saveName" placeholder="预设名称" size="small" maxlength="20" />
      <el-select v-model="saveIndex" placeholder="选择槽位" size="small" style="width: 100%; margin-top: 8px">
        <el-option
          v-for="i in 9"
          :key="i"
          :label="`槽位${i}` + (getPresetAtSlot(i) ? ` (覆盖: ${getPresetAtSlot(i)!.presetName})` : ' (空)')"
          :value="i"
        />
      </el-select>
      <div style="text-align: right; margin-top: 12px">
        <el-button size="small" @click="savePopVisible = false">取消</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="doSave">保存</el-button>
      </div>
    </el-popover>

    <el-dropdown v-if="activePresetId" trigger="click">
      <el-button size="small" circle>
        <el-icon><MoreFilled /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="setAsDefault">
            <el-icon><StarFilled /></el-icon> 设为默认
          </el-dropdown-item>
          <el-dropdown-item @click="showRename = true">
            <el-icon><Edit /></el-icon> 重命名
          </el-dropdown-item>
          <el-dropdown-item divided @click="deletePreset">
            <el-icon><Delete /></el-icon> 删除
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-dialog v-model="showRename" title="重命名" width="300px" append-to-body>
      <el-input v-model="renameText" maxlength="20" />
      <template #footer>
        <el-button @click="showRename = false">取消</el-button>
        <el-button type="primary" @click="doRename">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, MoreFilled, Edit, Delete, StarFilled } from '@element-plus/icons-vue'
import { filterPresetApi, type FilterPreset } from '@/api/filterPreset'

const props = defineProps<{
  currentConfig: () => Record<string, any>
}>()

const emit = defineEmits<{
  (e: 'apply', config: Record<string, any>): void
}>()

const presets = ref<FilterPreset[]>([])
const activePresetId = ref<number | null>(null)
const savePopVisible = ref(false)
const saveName = ref('')
const saveIndex = ref(1)
const saving = ref(false)
const showRename = ref(false)
const renameText = ref('')

function getPresetAtSlot(idx: number) {
  return presets.value.find(p => p.presetIndex === idx)
}

async function loadPresets() {
  try {
    const res = await filterPresetApi.list()
    if (res.code === 200 && res.data) {
      presets.value = res.data.map((p: FilterPreset) => ({
        ...p,
        // API returns filterConfig as JSON string, parse it
        filterConfig: typeof p.filterConfig === 'string'
          ? JSON.parse(p.filterConfig)
          : p.filterConfig
      }))
      const dp = presets.value.find(p => p.isDefault)
      if (dp) {
        activePresetId.value = dp.id!
        if (dp.filterConfig && typeof dp.filterConfig === 'object') {
          emit('apply', dp.filterConfig)
        }
      }
    }
  } catch (e) {
    console.error('加载预设失败', e)
  }
}

function onPresetChange(id: number) {
  const p = presets.value.find(x => x.id === id)
  if (!p) return
  let cfg = p.filterConfig
  if (typeof cfg === 'string') cfg = JSON.parse(cfg)
  if (cfg && typeof cfg === 'object') {
    emit('apply', cfg)
  }
}

async function doSave() {
  if (!saveName.value.trim()) return ElMessage.warning('请输入名称')
  saving.value = true
  try {
    const cfg = props.currentConfig()
    await filterPresetApi.save(saveName.value.trim(), saveIndex.value, cfg)
    ElMessage.success('已保存')
    savePopVisible.value = false
    saveName.value = ''
    await loadPresets()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function setAsDefault() {
  if (!activePresetId.value) return
  try {
    await filterPresetApi.setDefault(activePresetId.value)
    ElMessage.success('已设为默认')
    await loadPresets()
  } catch (e: any) {
    ElMessage.error(e?.message || '失败')
  }
}

async function doRename() {
  if (!activePresetId.value) return
  try {
    await filterPresetApi.update(activePresetId.value, renameText.value.trim(), {} as any)
    ElMessage.success('已重命名')
    showRename.value = false
    await loadPresets()
  } catch (e: any) {
    ElMessage.error(e?.message || '失败')
  }
}

async function deletePreset() {
  if (!activePresetId.value) return
  try { await ElMessageBox.confirm('确定删除？', '提示', { type: 'warning' }) } catch { return }
  try {
    await filterPresetApi.delete(activePresetId.value)
    ElMessage.success('已删除')
    activePresetId.value = null
    await loadPresets()
  } catch (e: any) {
    ElMessage.error(e?.message || '失败')
  }
}

// 选中预设时，筛选条件变化自动同步到预设
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
watch(() => props.currentConfig?.(), (newCfg) => {
  if (!activePresetId.value || !newCfg) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(async () => {
    try {
      await filterPresetApi.update(activePresetId.value!, '', newCfg)
    } catch (e) { /* 静默保存 */ }
  }, 1500)
}, { deep: true })

onMounted(() => loadPresets())
</script>

<style scoped lang="scss">
.filter-preset-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.bar-label {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
  margin-right: 4px;
}
</style>
