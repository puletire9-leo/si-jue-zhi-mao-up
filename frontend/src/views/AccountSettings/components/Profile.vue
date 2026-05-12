<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { Upload } from '@element-plus/icons-vue'

const userStore = useUserStore()

const userInfos = reactive({
  avatar: '',
  nickname: '',
  email: '',
  phone: '',
  description: ''
})

const emailSuggestions = ref([
  '@qq.com',
  '@126.com',
  '@163.com',
  '@gmail.com',
  '@outlook.com'
])

const showEmailDropdown = ref(false)
const filteredEmails = ref<string[]>([])

const queryEmail = (queryString: string) => {
  if (!queryString.includes('@')) {
    filteredEmails.value = emailSuggestions.value.map(suffix => queryString + suffix)
  } else {
    const prefix = queryString.split('@')[0]
    filteredEmails.value = emailSuggestions.value
      .filter(suffix => suffix.includes(queryString.split('@')[1] || ''))
      .map(suffix => prefix + suffix)
  }
}

const selectEmail = (email: string) => {
  userInfos.email = email
  showEmailDropdown.value = false
}

const handleEmailInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  queryEmail(target.value)
}

const handleSubmit = () => {
  ElMessage.success('更新个人信息成功')
}

const handleAvatarUpload = () => {
  ElMessage.info('头像上传功能开发中...')
}

onMounted(() => {
  const user = userStore.userInfo
  if (user) {
    userInfos.avatar = user.avatar || ''
    userInfos.nickname = user.nickname || user.username || ''
    userInfos.email = user.email || ''
    userInfos.phone = user.phone || ''
    userInfos.description = user.description || ''
  }
})
</script>

<template>
  <div class="profile-container">
    <h3 class="page-title">个人信息</h3>
    
    <el-form :model="userInfos" label-position="top" class="profile-form">
      <el-form-item label="头像">
        <div class="avatar-upload">
          <el-avatar :size="80" :src="userInfos.avatar">
            {{ userInfos.nickname?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <el-button 
            plain 
            class="upload-btn"
            @click="handleAvatarUpload"
          >
            <el-icon><Upload /></el-icon>
            <span>更新头像</span>
          </el-button>
        </div>
      </el-form-item>

      <el-form-item label="昵称">
        <el-input 
          v-model="userInfos.nickname" 
          placeholder="请输入昵称"
        />
      </el-form-item>

      <el-form-item label="邮箱">
        <div class="email-input-wrapper" ref="emailWrapper">
          <el-input 
            v-model="userInfos.email" 
            placeholder="请输入邮箱"
            class="email-input"
            @input="handleEmailInput"
            @focus="showEmailDropdown = true"
            @blur="() => { setTimeout(() => { showEmailDropdown = false }, 200) }"
          />
          <div 
            v-if="showEmailDropdown && filteredEmails.length"
            class="email-dropdown"
          >
            <div 
              v-for="email in filteredEmails" 
              :key="email"
              class="dropdown-item"
              @click="selectEmail(email)"
            >
              {{ email }}
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="联系电话">
        <el-input 
          v-model="userInfos.phone" 
          placeholder="请输入联系电话"
          clearable
        />
      </el-form-item>

      <el-form-item label="简介">
        <el-input 
          v-model="userInfos.description" 
          placeholder="请输入简介"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 6 }"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="handleSubmit">
          更新信息
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped lang="scss">
.profile-container {
  max-width: 600px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #2F281D;
}

.profile-form {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(124, 97, 212, 0.08);
}

.avatar-upload {
  display: flex;
  align-items: center;
  gap: 16px;

  .upload-btn {
    background: #F8F4FF;
    color: #7C61D4;
    border-color: #7C61D4;

    &:hover {
      background: #7C61D4;
      color: white;
    }
  }
}

.email-input-wrapper {
  position: relative;
  width: 100%;
}

.email-input {
  width: 100%;
}

.email-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 100;

  .dropdown-item {
    padding: 10px 16px;
    cursor: pointer;
    color: #6B5E52;
    transition: background 0.2s;

    &:hover {
      background: #F8F4FF;
      color: #7C61D4;
    }
  }
}
</style>
