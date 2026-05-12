<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElDialog, ElForm, ElFormItem, ElInput, ElButton } from 'element-plus'

const accountItems = ref([
  {
    title: '账户密码',
    description: '当前密码强度：强',
    button: '修改',
    action: 'password'
  },
  {
    title: '密保手机',
    description: '已绑定手机：158****6789',
    button: '修改',
    action: 'phone'
  },
  {
    title: '密保问题',
    description: '未设置密保问题，密保问题可有效保护账户安全',
    button: '设置',
    action: 'question'
  },
  {
    title: '备用邮箱',
    description: '已绑定邮箱：admin***@example.com',
    button: '修改',
    action: 'email'
  }
])

const dialogVisible = ref(false)
const currentAction = ref('')
const formData = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
  phone: '',
  email: ''
})

const handleAction = (action: string) => {
  currentAction.value = action
  dialogVisible.value = true
}

const handleSubmit = () => {
  dialogVisible.value = false
  const actionMap: Record<string, string> = {
    password: '密码修改成功',
    phone: '手机修改成功',
    question: '密保问题设置成功',
    email: '邮箱修改成功'
  }
  ElMessage.success(actionMap[currentAction.value] || '操作成功')
}

const getDialogTitle = () => {
  const titleMap: Record<string, string> = {
    password: '修改密码',
    phone: '修改密保手机',
    question: '设置密保问题',
    email: '修改备用邮箱'
  }
  return titleMap[currentAction.value] || '设置'
}
</script>

<template>
  <div class="account-management-container">
    <h3 class="page-title">账户管理</h3>
    
    <div class="management-list">
      <div 
        v-for="(item, index) in accountItems" 
        :key="index"
        class="management-item"
      >
        <div class="management-content">
          <h4 class="management-title">{{ item.title }}</h4>
          <p class="management-description">{{ item.description }}</p>
        </div>
        <el-button 
          type="primary" 
          text
          class="management-button"
          @click="handleAction(item.action)"
        >
          {{ item.button }}
        </el-button>
      </div>
    </div>

    <ElDialog 
      v-model="dialogVisible" 
      :title="getDialogTitle()"
      width="450px"
    >
      <ElForm :model="formData" label-width="100px">
        <template v-if="currentAction === 'password'">
          <ElFormItem label="当前密码">
            <ElInput 
              v-model="formData.oldPassword" 
              type="password"
              placeholder="请输入当前密码"
            />
          </ElFormItem>
          <ElFormItem label="新密码">
            <ElInput 
              v-model="formData.newPassword" 
              type="password"
              placeholder="请输入新密码"
            />
          </ElFormItem>
          <ElFormItem label="确认密码">
            <ElInput 
              v-model="formData.confirmPassword" 
              type="password"
              placeholder="请再次输入新密码"
            />
          </ElFormItem>
        </template>

        <template v-else-if="currentAction === 'phone'">
          <ElFormItem label="新手机号码">
            <ElInput 
              v-model="formData.phone" 
              placeholder="请输入新手机号码"
            />
          </ElFormItem>
          <ElFormItem label="验证码">
            <ElInput placeholder="请输入验证码">
              <template #append>
                <ElButton text>获取验证码</ElButton>
              </template>
            </ElInput>
          </ElFormItem>
        </template>

        <template v-else-if="currentAction === 'question'">
          <ElFormItem label="密保问题">
            <ElInput placeholder="请输入密保问题" />
          </ElFormItem>
          <ElFormItem label="答案">
            <ElInput 
              type="password"
              placeholder="请输入答案"
            />
          </ElFormItem>
        </template>

        <template v-else-if="currentAction === 'email'">
          <ElFormItem label="新邮箱地址">
            <ElInput 
              v-model="formData.email" 
              placeholder="请输入新邮箱地址"
            />
          </ElFormItem>
        </template>
      </ElForm>

      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" @click="handleSubmit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<style scoped lang="scss">
.account-management-container {
  max-width: 600px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #2F281D;
}

.management-list {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(124, 97, 212, 0.08);
  overflow: hidden;
}

.management-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #F0EBE6;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #FFFBF7;
  }
}

.management-content {
  flex: 1;

  .management-title {
    font-weight: 600;
    color: #2F281D;
    margin-bottom: 4px;
  }

  .management-description {
    font-size: 13px;
    color: #9CA3AF;
  }
}

.management-button {
  color: #7C61D4;
  border-color: #7C61D4;

  &:hover {
    background: #7C61D4;
    color: white;
  }
}
</style>
