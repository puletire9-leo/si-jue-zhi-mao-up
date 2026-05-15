<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Odometer,
  Box,
  Star,
  Picture,
  Brush,
  Upload,
  TrendCharts,
  Download,
  User,
  Setting
} from '@element-plus/icons-vue'

interface MenuItem {
  index: string
  title: string
  icon: any
  children?: MenuItem[]
  external?: boolean
}

const props = defineProps<{
  collapsed: boolean
}>()

const route = useRoute()
const router = useRouter()

const menuItems: MenuItem[] = [
  { index: '/dashboard', title: '首页', icon: Odometer },
  { index: '/products', title: '产品管理', icon: Box },
  {
    index: 'selection',
    title: '选品中心',
    icon: Star,
    children: [
      { index: '/all-selection', title: '总选品管理', icon: Star },
      { index: '/new-products', title: '新品榜', icon: Star },
      { index: '/reference-products', title: '竞品店铺', icon: Star },
      { index: '/zheng-products', title: '郑总店铺上新', icon: Star }
    ]
  },
  {
    index: 'resources',
    title: '资料集',
    icon: Picture,
    children: [
      { index: '/prompt-library', title: '提示词库', icon: Picture },
      { index: '/resource-library', title: '资料库', icon: Picture },
      { index: '/resource-collection', title: '图片管理', icon: Picture }
    ]
  },
  {
    index: 'customization',
    title: '微定制',
    icon: Brush,
    children: [
      { index: '/final-draft', title: '定稿管理', icon: Brush },
      { index: '/material-library', title: '素材库', icon: Brush },
      { index: '/carrier-library', title: '载体库', icon: Brush }
    ]
  },
  {
    index: 'lingxing',
    title: '领星',
    icon: Upload,
    children: [
      { index: '/lingxing/import', title: '导入领星', icon: Upload }
    ]
  },
  {
    index: 'dashboards',
    title: '数据看板',
    icon: TrendCharts,
    children: [
      { index: '/product-data', title: '产品数据看板', icon: TrendCharts },
      { index: '/dashboards/product_sales_dashboard_v2.html', title: '销量追踪', icon: TrendCharts, external: true },
      { index: '/dashboards/product_comparison_dashboard.html', title: '双周期对比', icon: TrendCharts, external: true },
      { index: '/dashboards/product_decline_analysis.html', title: '销量下滑分析', icon: TrendCharts, external: true }
    ]
  },
  { index: '/download-manager', title: '下载管理', icon: Download },
  { index: '/users', title: '用户管理', icon: User },
    { index: '/account-settings', title: '账号设置', icon: User },
    { index: '/settings', title: '系统设置', icon: Setting }
]

const activeIndex = computed(() => route.path)

const findItem = (items: MenuItem[], index: string): MenuItem | undefined => {
  for (const item of items) {
    if (item.index === index) return item
    if (item.children) {
      const found = findItem(item.children, index)
      if (found) return found
    }
  }
  return undefined
}

const handleSelect = (index: string) => {
  if (!index.startsWith('/')) return
  const item = findItem(menuItems, index)
  if (item?.external) {
    window.open(index, '_blank')
    return
  }
  router.push(index)
}
</script>

<template>
  <div class="lay-sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">思</div>
      <span v-show="!collapsed" class="logo-text">思觉智贸</span>
    </div>

    <el-scrollbar wrap-class="scrollbar-wrapper">
      <el-menu
        :default-active="activeIndex"
        class="sidebar-menu"
        mode="vertical"
        :collapse="collapsed"
        :collapse-transition="false"
        unique-opened
        @select="handleSelect"
      >
        <template v-for="item in menuItems" :key="item.index">
          <el-sub-menu v-if="item.children" :index="item.index">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <el-menu-item
              v-for="child in item.children"
              :key="child.index"
              :index="child.index"
            >
              {{ child.title }}
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-else :index="item.index">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped lang="scss">
.lay-sidebar {
  width: 100%;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 20px;
    background: linear-gradient(135deg, #FFFBF7, #F8F4FF);
    border-bottom: 1px solid #F0EBE6;
    flex-shrink: 0;

    .logo-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
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
      white-space: nowrap;
    }
  }

  .scrollbar-wrapper {
    flex: 1;
    overflow: hidden;

    :deep(.el-scrollbar__bar.is-horizontal) {
      display: none;
    }
  }

  .sidebar-menu {
    width: 100%;
    border-right: none;
    background: transparent;
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

// 深色主题
:deep(html.dark) {
  .lay-sidebar {
    background: #1A1A2E;

    .sidebar-logo {
      background: linear-gradient(135deg, #16162A, #1A1A2E);
      border-bottom-color: #2D2D44;

      .logo-text {
        color: #E4E4E7;
      }
    }

    .sidebar-menu {
      :deep(.el-menu-item) {
        color: #A1A1AA;

        &:hover {
          background: #252540;
          color: #9F85E0;
        }

        &.is-active {
          background: linear-gradient(135deg, #7C61D4, #9F85E0);
          color: white;
        }
      }

      :deep(.el-sub-menu) {
        .el-sub-menu__title {
          color: #A1A1AA;

          &:hover {
            background: #252540;
            color: #9F85E0;
          }
        }

        :deep(.el-menu) {
          .el-menu-item {
            &.is-active {
              background: rgba(124, 97, 212, 0.2);
              color: #9F85E0;
            }
          }
        }
      }
    }
  }
}
</style>
