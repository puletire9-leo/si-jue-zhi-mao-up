<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { ElMessageBox } from 'element-plus'
import {
  Fold,
  ArrowDown,
  User,
  Setting,
  SwitchButton,
  FullScreen,
  Refresh
} from '@element-plus/icons-vue'
import GlobalSearch from '@/components/GlobalSearch/index.vue'
import { emitter } from '@/utils/emitter'

const emit = defineEmits<{
  toggleSidebar: []
}>()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const breadcrumbs = computed(() => {
  if (!route.matched || !Array.isArray(route.matched)) return []
  
  return route.matched.filter((item: any) => {
    return item && item.path && item.meta && item.meta.title
  }).map((item: any) => ({
    path: item.path,
    meta: { title: item.meta.title }
  }))
})

const handleCommand = async (command: string): Promise<void> => {
  switch (command) {
    case 'profile':
      router.push('/account-settings')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      try {
        await ElMessageBox.confirm('确定要退出登录吗？', '确认退出', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        })
        userStore.logout()
        router.push('/login')
      } catch {
        // 用户取消
      }
      break
  }
}

const handleFullScreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleRefresh = () => {
  window.location.reload()
}

const openSettingPanel = () => {
  emitter.emit('openPanel')
}
</script>

<template>
  <div class="lay-navbar">
    <div class="navbar-left">
      <el-button
        :icon="Fold"
        circle
        @click="emit('toggleSidebar')"
        class="toggle-btn"
      />
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="item in breadcrumbs"
          :key="item.path"
          :to="item.path"
        >
          {{ item.meta.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="navbar-right">
      <el-tooltip content="刷新页面" placement="bottom">
        <el-button :icon="Refresh" circle @click="handleRefresh" class="icon-btn" />
      </el-tooltip>
      <GlobalSearch />
      <el-tooltip content="全屏" placement="bottom">
        <el-button :icon="FullScreen" circle @click="handleFullScreen" class="icon-btn" />
      </el-tooltip>
      <el-tooltip content="系统配置" placement="bottom">
        <el-button :icon="Setting" circle @click="openSettingPanel" class="icon-btn" />
      </el-tooltip>

      <el-dropdown @command="handleCommand" trigger="click">
        <div class="user-info">
          <el-avatar :size="32" class="user-avatar">
            {{ userStore.userInfo?.username?.charAt(0)?.toUpperCase() }}
          </el-avatar>
          <span class="username">{{ userStore.userInfo?.username }}</span>
          <el-icon><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile">
              <el-icon><User /></el-icon>用户配置
            </el-dropdown-item>
            <el-dropdown-item command="settings">
              <el-icon><Setting /></el-icon>系统设置
            </el-dropdown-item>
            <el-dropdown-item divided command="logout">
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lay-navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 16px;

  .navbar-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .toggle-btn {
      width: 36px;
      height: 36px;
      background: #f5f0eb;
      color: #b45309;
      border: none;

      &:hover {
        background: #b45309;
        color: white;
      }
    }
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .icon-btn {
      width: 36px;
      height: 36px;
      background: transparent;
      color: #6b7280;
      border: none;

      &:hover {
        background: #f5f0eb;
        color: #b45309;
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 12px;
      margin-left: 8px;
      transition: background 0.2s;

      &:hover {
        background: #f5f0eb;
      }

      .username {
        font-size: 14px;
        font-weight: 500;
        color: #1a1a1a;
      }

      .user-avatar {
        background: linear-gradient(135deg, #b45309, #EAAE87);
        color: white;
      }
    }
  }
}

// 深色主题
:deep(html.dark) {
  .lay-navbar {
    .navbar-left {
      .toggle-btn {
        background: #252540;
        color: #d97706;

        &:hover {
          background: #b45309;
          color: white;
        }
      }
    }

    .navbar-right {
      .icon-btn {
        color: #A1A1AA;

        &:hover {
          background: #252540;
          color: #d97706;
        }
      }

      .user-info {
        &:hover {
          background: #252540;
        }

        .username {
          color: #E4E4E7;
        }
      }
    }
  }
}
</style>
