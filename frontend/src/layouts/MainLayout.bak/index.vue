<template>
  <div class="main-layout">
    <div 
      v-if="appStore.sidebarCollapsed" 
      class="sidebar-mask"
      @click="appStore.toggleSidebar"
    ></div>
    
    <div 
      class="sidebar-container"
      :class="{ 'sidebar-collapsed': appStore.sidebarCollapsed }"
    >
      <el-aside width="260px" class="sidebar">
        <div class="logo">
          <div class="logo-icon">思</div>
          <span class="logo-text">思觉智贸</span>
        </div>
        
        <el-menu
          :default-active="route.path"
          class="sidebar-menu"
          router
          :collapse-transition="false"
        >
          <el-menu-item index="/dashboard">
            <el-icon><Odometer /></el-icon>
            <template #title>首页</template>
          </el-menu-item>
          
          <el-menu-item index="/products">
            <el-icon><Box /></el-icon>
            <template #title>产品管理</template>
          </el-menu-item>
          
          <el-sub-menu index="selection">
            <template #title>
              <el-icon><Star /></el-icon>
              <span>选品中心</span>
            </template>
            <el-menu-item index="/all-selection">总选品管理</el-menu-item>
            <el-menu-item index="/new-products">新品榜</el-menu-item>
            <el-menu-item index="/reference-products">竞品店铺</el-menu-item>
            <el-menu-item index="/zheng-products">郑总店铺上新</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="resources">
            <template #title>
              <el-icon><Picture /></el-icon>
              <span>资料集</span>
            </template>
            <el-menu-item index="/prompt-library">提示词库</el-menu-item>
            <el-menu-item index="/resource-library">资料库</el-menu-item>
            <el-menu-item index="/resource-collection">图片管理</el-menu-item>
          </el-sub-menu>
          
          <el-sub-menu index="customization">
            <template #title>
              <el-icon><Brush /></el-icon>
              <span>微定制</span>
            </template>
            <el-menu-item index="/final-draft">定稿管理</el-menu-item>
            <el-menu-item index="/material-library">素材库</el-menu-item>
            <el-menu-item index="/carrier-library">载体库</el-menu-item>
          </el-sub-menu>

          <el-sub-menu index="lingxing">
            <template #title>
              <el-icon><Upload /></el-icon>
              <span>领星</span>
            </template>
            <el-menu-item index="/lingxing/import">导入领星</el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/product-data">
            <el-icon><TrendCharts /></el-icon>
            <template #title>产品数据看板</template>
          </el-menu-item>

          <el-menu-item index="/download-manager">
            <el-icon><Download /></el-icon>
            <template #title>下载管理</template>
          </el-menu-item>

          <el-menu-item index="/users">
            <el-icon><User /></el-icon>
            <template #title>用户管理</template>
          </el-menu-item>

          <el-menu-item index="/settings">
            <el-icon><Setting /></el-icon>
            <template #title>系统设置</template>
          </el-menu-item>
        </el-menu>
      </el-aside>
    </div>

    <div class="main-container">
      <el-header class="header">
        <div class="header-left">
          <el-button
            :icon="Fold"
            circle
            @click="appStore.toggleSidebar"
            class="sidebar-toggle-btn"
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
        
        <div class="tags-nav">
          <el-scrollbar>
            <div class="tags-list">
              <el-tag
                v-for="tag in appStore.tags"
                :key="tag.path"
                :type="appStore.activeTag === tag.path ? 'primary' : 'info'"
                :closable="tag.path !== '/dashboard'"
                class="tag-item"
                @close="handleTagClose(tag.path)"
                @click="handleTagClick(tag.path)"
              >
                {{ tag.title }}
              </el-tag>
            </div>
          </el-scrollbar>
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
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
                  <el-icon><User /></el-icon>个人信息
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
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </div>
  </div>
</template>

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
  Star,
  Picture,
  Brush,
  TrendCharts,
  Download,
  Upload,
  Odometer,
  Box
} from '@element-plus/icons-vue'

interface MenuRoute {
  path: string
  meta: {
    title: string
  }
}

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()

const breadcrumbs = computed<MenuRoute[]>(() => {
  if (!route.matched || !Array.isArray(route.matched)) return []
  
  const matched = route.matched.filter((item: any) => {
    return item && item.path && item.meta && item.meta.title
  })
  
  return matched.map((item: any): MenuRoute => ({
    path: item.path,
    meta: { title: item.meta.title }
  }))
})

const handleCommand = async (command: string): Promise<void> => {
  switch (command) {
    case 'profile':
      ElMessageBox.alert('个人信息功能开发中...', '提示')
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

const handleTagClick = (path: string): void => {
  router.push(path)
  appStore.setActiveTag(path)
}

const handleTagClose = (path: string): void => {
  const currentPath = route.path
  appStore.removeTag(path)
  
  if (currentPath === path) {
    const activePath = appStore.activeTag
    if (activePath) {
      router.push(activePath)
    }
  }
}
</script>

<style scoped lang="scss">
.main-layout {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.sidebar-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 998;
}

.sidebar-container {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 260px;
  background: white;
  z-index: 999;
  transition: transform 0.25s ease;
  box-shadow: 2px 0 12px rgba(124, 97, 212, 0.08);
  
  &.sidebar-collapsed {
    transform: translateX(-100%);
  }
}

.sidebar {
  background: white;
  height: 100%;
  width: 100%;
  overflow: hidden;

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 20px;
    background: linear-gradient(135deg, #FFFBF7, #F8F4FF);
    border-bottom: 1px solid #F0EBE6;

    .logo-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #7C61D4, #9F85E0);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(124, 97, 212, 0.3);
    }

    .logo-text {
      font-size: 17px;
      font-weight: 600;
      color: #2F281D;
    }
  }

  .el-menu {
    border-right: none;
    background: transparent;
    height: calc(100% - 64px);
    overflow-y: auto;
    padding: 12px 8px;

    :deep(.el-menu-item) {
      height: 44px;
      line-height: 44px;
      margin-bottom: 4px;
      border-radius: 10px;
      color: #6B5E52;
      transition: all 0.2s ease;

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

    :deep(.el-sub-menu) {
      .el-sub-menu__title {
        height: 44px;
        line-height: 44px;
        margin-bottom: 4px;
        border-radius: 10px;
        color: #6B5E52;
        transition: all 0.2s ease;

        &:hover {
          background: #F8F4FF;
          color: #7C61D4;
        }
      }

      :deep(.el-menu) {
        background: transparent !important;

        .el-menu-item {
          padding-left: 48px !important;
          font-size: 13px;

          &.is-active {
            background: rgba(124, 97, 212, 0.15);
            color: #7C61D4;
            box-shadow: none;
          }
        }
      }
    }
  }
}

.main-container {
  position: fixed;
  top: 0;
  left: 260px;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: #FFFBF7;
  transition: left 0.25s ease;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  border-bottom: 1px solid #F0EBE6;
  padding: 0 20px;
  height: 64px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .sidebar-toggle-btn {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #F8F4FF;
      color: #7C61D4;

      &:hover {
        background: #7C61D4;
        color: white;
      }
    }
  }

  .tags-nav {
    flex: 1;
    margin: 0 20px;
    height: 40px;
    display: flex;
    align-items: center;
    background: #F8F4FF;
    border-radius: 10px;
    padding: 0 8px;

    .tags-list {
      display: flex;
      gap: 6px;
    }

    .tag-item {
      cursor: pointer;
      height: 32px;
      padding: 5px 14px;
      font-size: 13px;
      border-radius: 8px;
      background: white;
      color: #6B5E52;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-1px);
      }

      &.el-tag--info {
        background: linear-gradient(135deg, #7C61D4, #9F85E0);
        color: white;
      }
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 8px 14px;
      border-radius: 12px;

      &:hover {
        background: #F8F4FF;
      }

      .username {
        font-size: 14px;
        font-weight: 500;
        color: #2F281D;
      }

      .user-avatar {
        background: linear-gradient(135deg, #7C61D4, #EAAE87);
        color: white;
      }
    }
  }
}

.main-content {
  flex: 1;
  background: #FFFBF7;
  padding: 20px;
  overflow-y: auto;
}
</style>
