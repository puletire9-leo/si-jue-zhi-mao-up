<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import LayNavbar from './components/lay-navbar/index.vue'
import LaySidebar from './components/lay-sidebar/index.vue'
import LayTags from './components/lay-tags/index.vue'
import LayContent from './components/lay-content/index.vue'
import LayPanel from './components/lay-panel/index.vue'
import LaySetting from './components/lay-setting/index.vue'

const appStore = useAppStore()

const sidebarCollapsed = computed(() => appStore.sidebarCollapsed)
const sidebarWidth = computed(() => sidebarCollapsed.value ? '64px' : '260px')

const handleToggleSidebar = () => {
  appStore.toggleSidebar()
}
</script>

<template>
  <div class="layout-container">
    <aside class="sidebar" :style="{ width: sidebarWidth }">
      <LaySidebar :collapsed="sidebarCollapsed" />
    </aside>

    <main class="main-content">
      <header class="header">
        <LayNavbar @toggle-sidebar="handleToggleSidebar" />
      </header>

      <div class="tags-bar">
        <LayTags />
      </div>

      <div class="content">
        <LayContent />
      </div>
    </main>

    <LayPanel>
      <LaySetting />
    </LayPanel>
  </div>
</template>

<style scoped lang="scss">
.layout-container {
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  flex-shrink: 0;
  height: 100%;
  background: white;
  box-shadow: 2px 0 12px rgba(124, 97, 212, 0.08);
  transition: width 0.25s ease;
  z-index: 100;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #FFFBF7;
  overflow: hidden;
}

.header {
  height: 64px;
  background: white;
  border-bottom: 1px solid #F0EBE6;
  flex-shrink: 0;
}

.tags-bar {
  height: 48px;
  flex-shrink: 0;
  padding: 0 16px;
  display: flex;
  align-items: center;
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

// 深色主题
:deep(html.dark) {
  .sidebar {
    background: #1A1A2E;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.3);
  }

  .main-content {
    background: #16162A;
  }

  .header {
    background: #1A1A2E;
    border-bottom-color: #2D2D44;
  }

  .tags-bar {
    background: #16162A;
  }
}
</style>
