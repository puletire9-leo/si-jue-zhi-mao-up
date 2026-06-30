<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button
            v-if="userStore.isAdmin"
            type="primary"
            :icon="Plus"
            @click="handleAdd"
          >
            添加用户
          </el-button>
        </div>
      </template>

      <SkeletonWrapper :loading="loading && !hasLoaded" variant="table">
      <el-table
        v-loading="refreshing"
        :data="userList"
        style="width: 100%"
      >
        <el-table-column
          prop="id"
          label="ID"
          width="80"
        />
        <el-table-column
          prop="username"
          label="用户名"
        />
        <el-table-column
          prop="role"
          label="角色"
          width="120"
        >
          <template #default="{ row }">
            <el-tag
              v-for="r in (row.role||'').split(',').filter(Boolean)"
              :key="r"
              :type="getRoleType(r.trim())"
              size="small"
              style="margin-right: 4px"
            >
              {{ r.trim() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="状态"
          width="100"
        >
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="createdAt"
          label="创建时间"
          width="180"
        >
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="180"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              v-if="userStore.isAdmin"
              type="primary"
              link
              :icon="Edit"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="userStore.isAdmin"
              type="danger"
              link
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
            <span v-else class="no-permission">无权限</span>
          </template>
        </el-table-column>
      </el-table>
      </SkeletonWrapper>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑用户' : '添加用户'"
      width="500px"
    >
      <el-form
        :model="formData"
        label-width="100px"
      >
        <el-form-item
          label="用户名"
          required
        >
          <el-input
            v-model="formData.username"
            placeholder="请输入用户名"
          />
        </el-form-item>
        <el-form-item
          label="密码"
          :required="!isEdit"
        >
          <el-input
            v-model="formData.password"
            type="password"
            :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
          />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-checkbox-group v-model="roleSelection">
            <el-checkbox label="管理员" :disabled="roleSelection.includes('开发')||roleSelection.includes('美术')||roleSelection.includes('仓库')||roleSelection.includes('运营')||roleSelection.includes('采购员')" />
            <el-checkbox label="开发" :disabled="roleSelection.includes('管理员')" />
            <el-checkbox label="美术" :disabled="roleSelection.includes('管理员')" />
            <el-checkbox label="仓库" :disabled="roleSelection.includes('管理员')" />
            <el-checkbox label="运营" :disabled="roleSelection.includes('管理员')" />
            <el-checkbox label="采购员" :disabled="roleSelection.includes('管理员')" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="是否可登录" v-if="!roleSelection.includes('管理员')">
          <el-switch
            v-model="formData.status"
            :active-value="1"
            :inactive-value="0"
            active-text="可登录"
            inactive-text="禁用登录"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          @click="handleSave"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Users' })
import { ref, reactive, computed, onMounted } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi } from '@/api/user'
import { useUserStore } from '@/stores/user'
import SkeletonWrapper from '@/components/SkeletonWrapper/index.vue'

// 用户状态管理
const userStore = useUserStore()

const userList = ref([])
const dialogVisible = ref(false)
const loading = ref(true)
const hasLoaded = ref(false)
const refreshing = computed(() => loading.value && hasLoaded.value)
const isEdit = ref(false)

const formData = reactive({
  id: null,
  username: '',
  password: '',
  role: '开发',     // 提交时的逗号分隔字符串
  status: 1          // 1=启用(可登录), 0=禁用(不可登录)
})

// 多选角色（checkbox 组用数组，提交时转逗号串）
const roleOptions = ['管理员', '开发', '美术', '仓库', '运营', '采购员']
const roleSelection = ref<string[]>(['开发'])

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await userApi.getList({ page: 1, size: 20 })
    // 添加字段映射，将后端返回的下划线命名转换为驼峰命名
    const users = response.data?.list || []
    userList.value = users.map(user => ({
      ...user,
      createdAt: user.createdAt || (user as any).created_at
    }))
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    hasLoaded.value = true
    loading.value = false
  }
}

const handleAdd = () => {
  if (!userStore.isAdmin) {
    ElMessage.warning('只有管理员可以添加用户')
    return
  }
  
  isEdit.value = false
  formData.id = null
  formData.username = ''
  formData.password = ''
  formData.role = '开发'
  formData.status = 1
  roleSelection.value = ['开发']
  dialogVisible.value = true
}

const handleEdit = (row) => {
  if (!userStore.isAdmin) {
    ElMessage.warning('只有管理员可以编辑用户')
    return
  }

  isEdit.value = true
  formData.id = row.id
  formData.username = row.username
  formData.password = ''
  formData.role = row.role
  formData.status = row.status ?? 1
  // 从逗号分隔还原为数组
  roleSelection.value = (row.role || '').split(',').filter(Boolean).map((s: string) => s.trim())
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!userStore.isAdmin) {
    ElMessage.warning('只有管理员可以保存用户信息')
    return
  }

  if (roleSelection.value.length === 0) {
    ElMessage.warning('请至少选择一个角色')
    return
  }

  try {
    formData.role = roleSelection.value.join(',')
    if (isEdit.value) {
      await userApi.update(formData.id, formData)
    } else {
      await userApi.create(formData)
    }

    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    dialogVisible.value = false
    loadUsers()
  } catch (error) {
    const errorMessage = error?.response?.data?.message || error?.message || '保存失败'
    ElMessage.error(errorMessage)
  }
}

const handleDelete = async (row) => {
  if (!userStore.isAdmin) {
    ElMessage.warning('只有管理员可以删除用户')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 "${row.username}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await userApi.delete(row.id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

const getRoleType = (role) => {
  const roleTypes = {
    '管理员': 'danger',
    '开发': 'primary',
    '美术': 'warning',
    '仓库': 'success',
    '运营': 'info'
  }
  return roleTypes[role] || ''
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped lang="scss">
.user-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.no-permission {
  color: #909399;
  font-size: 14px;
  margin-left: 10px;
}

:deep(html.dark) {
  .user-management {
    background: var(--el-bg-color);
  }

  .card-header {
    color: var(--el-text-color-primary);
  }
}
</style>
