<template>
  <div class="announcement-wrapper">
    <el-button
      size="default"
      :type="announcement.content ? 'warning' : 'default'"
      :plain="!announcement.content"
      :icon="BellFilled"
      @click="handleView"
    >
      {{ announcement.content ? '公告' : '添加公告' }}
    </el-button>

    <el-dialog
      v-model="viewDialogVisible"
      title="📢 系统公告"
      width="520px"
      :close-on-click-modal="false"
    >
      <div v-if="announcement.content" class="announcement-display">
        <div class="announcement-content">{{ announcement.content }}</div>
        <div class="announcement-meta">
          <span>发布人：{{ announcement.updatedBy || '系统' }}</span>
          <span>{{ announcement.updatedAt ? formatTime(announcement.updatedAt) : '' }}</span>
        </div>
      </div>
      <div v-else class="no-announcement">
        <el-empty description="暂无公告" :image-size="80" />
      </div>

      <template #footer>
        <el-button @click="viewDialogVisible = false">关闭</el-button>
        <el-button v-if="isAdmin" type="primary" @click="switchToEdit">
          编辑公告
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑公告"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-input
        v-model="editContent"
        type="textarea"
        :rows="4"
        placeholder="请输入公告内容..."
        maxlength="500"
        show-word-limit
      />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { BellFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import request from '@/utils/request'

const userStore = useUserStore()
const announcement = ref({ content: '', updatedBy: '', updatedAt: '' })
const viewDialogVisible = ref(false)
const editDialogVisible = ref(false)
const editContent = ref('')
const saving = ref(false)

const isAdmin = computed(() => {
  return userStore.userInfo && userStore.userInfo.role === '管理员'
})

function formatTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function fetchAnnouncement() {
  try {
    const res = await request.get('/api/v1/announcement') as any
    if (res.code === 200 && res.data) {
      announcement.value = res.data
    }
  } catch {
    // ignore
  }
}

function handleView() {
  viewDialogVisible.value = true
}

function switchToEdit() {
  viewDialogVisible.value = false
  editContent.value = announcement.value.content
  editDialogVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const res = await request.put('/api/v1/announcement', { content: editContent.value }) as any
    if (res.code === 200) {
      ElMessage.success('公告已更新')
      announcement.value.content = editContent.value
      editDialogVisible.value = false
    }
  } catch {
    ElMessage.error('更新公告失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  fetchAnnouncement()
})
</script>

<style scoped>
.announcement-display {
  padding: 8px 0;
}
.announcement-content {
  font-size: 15px;
  line-height: 1.8;
  color: #2f281d;
  white-space: pre-wrap;
  padding: 16px;
  background: #fdf6ec;
  border-radius: 8px;
  border: 1px solid #faecd8;
}
.announcement-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
}
.no-announcement {
  padding: 20px 0;
}
</style>
