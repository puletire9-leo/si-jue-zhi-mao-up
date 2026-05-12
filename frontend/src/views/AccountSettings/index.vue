<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Profile from './components/Profile.vue'
import Preferences from './components/Preferences.vue'
import SecurityLog from './components/SecurityLog.vue'
import AccountManagement from './components/AccountManagement.vue'
import { useUserStore } from '@/stores/user'
import {
  ArrowLeft,
  User,
  Setting,
  Monitor,
  UserFilled as ProfileIcon
} from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const userInfo = ref({
  avatar: '',
  username: '',
  nickname: ''
})

const panes = [
  {
    key: 'profile',
    label: '个人信息',
    icon: User,
    component: Profile
  },
  {
    key: 'preferences',
    label: '偏好设置',
    icon: Setting,
    component: Preferences
  },
  {
    key: 'securityLog',
    label: '安全日志',
    icon: Monitor,
    component: SecurityLog
  },
  {
    key: 'accountManagement',
    label: '账户管理',
    icon: ProfileIcon,
    component: AccountManagement
  }
]

const activePane = ref('profile')

onMounted(() => {
  const user = userStore.userInfo
  if (user) {
    userInfo.value = {
      avatar: user.avatar || '',
      username: user.username || '',
      nickname: user.nickname || user.username || ''
    }
  }
})
</script>

<template>
  <div class="account-settings">
    <el-container class="account-container">
      <el-aside class="account-sidebar">
        <el-menu :default-active="activePane" class="account-menu">
          <div 
            class="back-btn"
            @click="router.go(-1)"
          >
            <el-icon><ArrowLeft /></el-icon>
            <span>返回</span>
          </div>
          
          <div class="user-info">
            <el-avatar :size="48" :src="userInfo.avatar">
              {{ userInfo.nickname?.charAt(0)?.toUpperCase() }}
            </el-avatar>
            <div class="user-detail">
              <div class="nickname">{{ userInfo.nickname }}</div>
              <div class="username">{{ userInfo.username }}</div>
            </div>
          </div>

          <el-menu-item
            v-for="item in panes"
            :key="item.key"
            :index="item.key"
            @click="activePane = item.key"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main class="account-content">
        <component 
          :is="panes.find(item => item.key === activePane)?.component" 
        />
      </el-main>
    </el-container>
  </div>
</template>

<style scoped lang="scss">
.account-settings {
  width: 100%;
  height: 100%;
  padding: 20px;
}

.account-container {
  height: calc(100% - 40px);
}

.account-sidebar {
  width: 240px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(124, 97, 212, 0.08);
}

.account-menu {
  border: none;
  background: transparent;
  padding: 16px;

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    margin-bottom: 24px;
    color: #6B5E52;
    cursor: pointer;
    border-radius: 10px;
    transition: all 0.2s;

    &:hover {
      background: #F8F4FF;
      color: #7C61D4;
    }
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 12px;
    background: linear-gradient(135deg, #FFFBF7, #F8F4FF);

    .user-detail {
      display: flex;
      flex-direction: column;

      .nickname {
        font-weight: 600;
        color: #2F281D;
      }

      .username {
        font-size: 13px;
        color: #9CA3AF;
      }
    }
  }

  :deep(.el-menu-item) {
    height: 44px;
    line-height: 44px;
    margin-bottom: 4px;
    border-radius: 10px;
    color: #6B5E52;
    transition: all 0.2s;

    &:hover {
      background: #F8F4FF;
      color: #7C61D4;
    }

    &.is-active {
      background: linear-gradient(135deg, #7C61D4, #9F85E0);
      color: white;
      box-shadow: 0 4px 12px rgba(124, 97, 212, 0.3);
    }
  }
}

.account-content {
  padding: 24px;
  background: transparent;
}
</style>
