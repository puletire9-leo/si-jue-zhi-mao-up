<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Odometer } from '@element-plus/icons-vue'
import { getAllModules } from '@/modules'
import { canSeeModule } from '@/utils/permission'
import { useUserStore } from '@/stores/user'

interface MenuItem {
  index: string
  title: string
  icon: any
  children?: MenuItem[]
  external?: boolean
  order?: number
}

defineProps<{
  collapsed: boolean
}>()

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 图标按需加载缓存
const iconCache = new Map<string, any>()
function resolveIcon(name?: string): any {
  if (!name) return undefined
  if (!iconCache.has(name)) {
    iconCache.set(name, defineAsyncComponent(() =>
      import('@element-plus/icons-vue').then(m => (m as any)[name]).catch(() => undefined)
    ))
  }
  return iconCache.get(name)
}

// 从模块清单动态生成菜单
const menuItems = computed<MenuItem[]>(() => {
  const modules = getAllModules()
  const groups = new Map<string, { items: MenuItem[]; order: number }>()
  const topLevel: MenuItem[] = []

  // 首页固定在最前
  topLevel.push({ index: '/dashboard', title: '首页', icon: Odometer, order: 0 })

  for (const mod of modules) {
    // 隐藏项不出现在菜单中
    if (mod.hiddenInMenu) continue

    // 按角色过滤菜单可见性
    if (!canSeeModule(userStore.userInfo?.role, mod.id)) continue

    const item: MenuItem = {
      index: `/${mod.route.path}`,
      title: mod.name,
      icon: resolveIcon(mod.icon),
      order: mod.menuOrder ?? 99,
      external: mod.external
    }
    if (mod.menuGroup) {
      if (!groups.has(mod.menuGroup)) {
        groups.set(mod.menuGroup, { items: [], order: mod.menuOrder ?? 99 })
      }
      const group = groups.get(mod.menuGroup)!
      group.order = Math.min(group.order, mod.menuOrder ?? 99)
      if (mod.menuSection) {
        const sectionIndex = `menu:${mod.menuGroup}:${mod.menuSection}`
        let section = group.items.find(candidate => candidate.index === sectionIndex)
        if (!section) {
          section = {
            index: sectionIndex,
            title: mod.menuSection,
            icon: undefined,
            order: mod.menuSectionOrder ?? mod.menuOrder ?? 99,
            children: []
          }
          group.items.push(section)
        }
        section.children!.push(item)
      } else {
        group.items.push(item)
      }
    } else {
      topLevel.push(item)
    }
  }

  topLevel.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  const groupMenus: MenuItem[] = [...groups.entries()]
    .map(([title, { items, order }]) => ({
      index: title,
      title,
      icon: items.find(item => item.icon)?.icon
        ?? items.find(item => item.children?.some(child => child.icon))?.children?.find(child => child.icon)?.icon,
      order,
      children: items
        .map(item => ({
          ...item,
          children: item.children?.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
        }))
        .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    }))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  // 按 menuOrder 拆分：重要项（<100）放前面，系统管理项（>=100）放最后
  const importantTop = topLevel.filter(i => (i.order ?? 99) < 100)
  const adminTop = topLevel.filter(i => (i.order ?? 99) >= 100)

  return [...importantTop, ...groupMenus, ...adminTop]
})

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
  const item = findItem(menuItems.value, index)
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
        @select="handleSelect"
      >
        <template v-for="item in menuItems" :key="item.index">
          <el-sub-menu v-if="item.children" :index="item.index">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <template v-for="child in item.children" :key="child.index">
              <el-sub-menu v-if="child.children" :index="child.index" class="menu-section">
                <template #title>{{ child.title }}</template>
                <el-menu-item
                  v-for="leaf in child.children"
                  :key="leaf.index"
                  :index="leaf.index"
                >
                  {{ leaf.title }}
                </el-menu-item>
              </el-sub-menu>
              <el-menu-item v-else :index="child.index">
                {{ child.title }}
              </el-menu-item>
            </template>
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
    background: linear-gradient(135deg, #faf8f5, #f5f0eb);
    border-bottom: 1px solid #e5e1da;
    flex-shrink: 0;

    .logo-icon {
      width: 36px;
      height: 36px;
      min-width: 36px;
      background: linear-gradient(135deg, #b45309, #d97706);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 700;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(180, 83, 9, 0.3);
    }

    .logo-text {
      font-size: 17px;
      font-weight: 600;
      color: #1a1a1a;
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
      color: #6b7280;
      transition: all 0.2s ease;

      &:hover {
        background: #f5f0eb;
        color: #b45309;
      }

      &.is-active {
        background: linear-gradient(135deg, #b45309, #d97706);
        color: white;
        box-shadow: 0 4px 12px rgba(180, 83, 9, 0.3);
      }
    }

    :deep(.el-sub-menu) {
      .el-sub-menu__title {
        height: 44px;
        line-height: 44px;
        margin-bottom: 4px;
        border-radius: 10px;
        color: #6b7280;
        transition: all 0.2s ease;

        &:hover {
          background: #f5f0eb;
          color: #b45309;
        }
      }

      :deep(.el-menu) {
        background: transparent !important;

        .el-menu-item {
          padding-left: 48px !important;
          font-size: 13px;

          &.is-active {
            background: rgba(180, 83, 9, 0.15);
            color: #b45309;
            box-shadow: none;
          }
        }

        .menu-section {
          > .el-sub-menu__title {
            height: 40px;
            line-height: 40px;
            padding-left: 42px !important;
            font-size: 13px;
            font-weight: 600;
            color: #4b5563;
          }

          .el-menu-item {
            height: 38px;
            line-height: 38px;
            padding-left: 62px !important;
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
          color: #d97706;
        }

        &.is-active {
          background: linear-gradient(135deg, #b45309, #d97706);
          color: white;
        }
      }

      :deep(.el-sub-menu) {
        .el-sub-menu__title {
          color: #A1A1AA;

          &:hover {
            background: #252540;
            color: #d97706;
          }
        }

        :deep(.el-menu) {
          .el-menu-item {
            &.is-active {
              background: rgba(180, 83, 9, 0.2);
              color: #d97706;
            }
          }
        }
      }
    }
  }
}
</style>
