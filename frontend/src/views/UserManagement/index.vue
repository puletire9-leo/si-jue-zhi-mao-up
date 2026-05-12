<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button
            v-if="isAdmin"
            type="primary"
            :icon="Plus"
            @click="handleAdd"
          >
            添加用户
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
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
            <el-tag :type="getRoleType(row.role)">
              {{ row.role }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="email"
          label="邮箱"
          width="200"
        >
          <template #default="{ row }">
            {{ row.email || '-' }}
          </template>
        </el-table-column>
        <el-table-column
          prop="developer"
          label="关联开发人"
          width="150"
        >
          <template #default="{ row }">
            {{ row.developer || '-' }}
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
              v-if="isAdmin"
              type="primary"
              link
              :icon="Edit"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button
              v-if="isAdmin"
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
        <el-form-item
          label="邮箱"
          required
        >
          <el-input
            v-model="formData.email"
            placeholder="请输入邮箱"
          />
        </el-form-item>
        <el-form-item
          label="角色"
          required
        >
          <el-select
            v-model="formData.role"
            placeholder="请选择角色"
            style="width: 100%"
          >
            <el-option
              label="管理员"
              value="管理员"
            />
            <el-option
              label="开发"
              value="开发"
            />
            <el-option
              label="美术"
              value="美术"
            />
            <el-option
              label="仓库"
              value="仓库"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="formData.role === '开发'"
          label="关联开发人"
          required
        >
          <el-select
            v-model="formData.developer"
            placeholder="请选择开发人"
            style="width: 100%"
          >
            <el-option
              v-for="developer in developerList"
              :key="developer"
              :label="developer"
              :value="developer"
            />
          </el-select>
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
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi } from '@/api/user'
import { systemConfigApi } from '@/api/systemConfig'
import { useUserStore } from '@/stores/user'

// 用户状态管理
const userStore = useUserStore()

// 计算属性：检查用户是否为管理员
const isAdmin = computed(() => {
  return userStore.userInfo && (userStore.userInfo.role === '管理员' || userStore.userInfo.role === 'admin')
})

const userList = ref([])
const dialogVisible = ref(false)
const loading = ref(false)
const isEdit = ref(false)
const developerList = ref([])

const formData = reactive({
  id: null,
  username: '',
  password: '',
  email: '',
  role: '开发',
  developer: ''
})

const loadDeveloperList = async () => {
  try {
    const response = await systemConfigApi.getDeveloperList()
    developerList.value = response.data?.developerList || []
  } catch (error) {
    console.error('获取开发人列表失败:', error)
    developerList.value = []
  }
}

const loadUsers = async () => {
  loading.value = true
  try {
    const response = await userApi.getList({ page: 1, size: 20 })
    // 添加字段映射，将后端返回的下划线命名转换为驼峰命名
    const users = response.data?.list || []
    userList.value = users.map(user => ({
      ...user,
      createdAt: user.createdAt || (user as any).created_at,
      developer: (user as any).developer
    }))
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以添加用户')
    return
  }
  
  isEdit.value = false
  formData.id = null
  formData.username = ''
  formData.password = ''
  formData.email = ''
  formData.role = '开发'
  formData.developer = ''
  // 确保开发人列表已加载
  loadDeveloperList()
  dialogVisible.value = true
}

const handleEdit = (row) => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以编辑用户')
    return
  }
  
  isEdit.value = true
  formData.id = row.id
  formData.username = row.username
  formData.password = ''
  formData.email = row.email || ''
  formData.role = row.role
  formData.developer = row.developer || ''
  // 确保开发人列表已加载
  loadDeveloperList()
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以保存用户信息')
    return
  }
  
  try {
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
  if (!isAdmin.value) {
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
    '仓库': 'success'
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
</style>
