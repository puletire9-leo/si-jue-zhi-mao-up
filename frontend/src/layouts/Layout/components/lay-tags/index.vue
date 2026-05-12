<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { Close, Refresh, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const tagList = computed(() => appStore.tags)
const activeTag = computed(() => appStore.activeTag)

const handleTagClick = (path: string) => {
  router.push(path)
  appStore.setActiveTag(path)
}

const handleTagClose = (path: string, e?: Event) => {
  e?.stopPropagation()
  const currentPath = route.path
  appStore.removeTag(path)
  
  if (currentPath === path) {
    const activePath = appStore.activeTag
    if (activePath) {
      router.push(activePath)
    }
  }
}

const handleCloseOthers = (path: string) => {
  appStore.removeOtherTags(path)
  router.push(path)
}

const handleCloseAll = () => {
  appStore.clearTags()
  router.push('/dashboard')
}
</script>

<template>
  <div class="lay-tags">
    <div class="tags-container">
      <el-scrollbar>
        <div class="tags-list">
          <el-tag
            v-for="tag in tagList"
            :key="tag.path"
            :type="activeTag === tag.path ? 'primary' : 'info'"
            :closable="tag.path !== '/dashboard'"
            class="tag-item"
            effect="plain"
            @click="handleTagClick(tag.path)"
            @close="handleTagClose(tag.path)"
          >
            <span class="tag-text">{{ tag.title }}</span>
            <el-dropdown
              v-if="tagList.length > 1"
              trigger="hover"
              @command="(cmd: string) => cmd === 'close-others' ? handleCloseOthers(tag.path) : handleCloseAll()"
            >
              <span class="tag-actions" @click.stop>
                <el-icon class="more-icon"><Close /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="close-others">关闭其他</el-dropdown-item>
                  <el-dropdown-item command="close-all">关闭全部</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </el-tag>
        </div>
      </el-scrollbar>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lay-tags {
  height: 40px;
  display: flex;
  align-items: center;
  background: #F8F4FF;
  border-radius: 10px;
  margin: 0 16px;
  padding: 0 8px;
  flex: 1;

  .tags-container {
    width: 100%;
    height: 100%;

    :deep(.el-scrollbar) {
      height: 100%;
    }

    :deep(.el-scrollbar__wrap) {
      overflow-x: auto;
      overflow-y: hidden;
    }

    :deep(.el-scrollbar__bar.is-horizontal) {
      height: 0;
    }
  }

  .tags-list {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    padding: 0 4px;
  }

  .tag-item {
    cursor: pointer;
    height: 32px;
    padding: 0 10px;
    font-size: 13px;
    border-radius: 8px;
    background: white;
    color: #6B5E52;
    border: 1px solid transparent;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(124, 97, 212, 0.15);
    }

    &.el-tag--info {
      background: linear-gradient(135deg, #7C61D4, #9F85E0);
      color: white;
      border-color: transparent;
    }

    :deep(.el-tag__close) {
      color: #6B5E52;
      margin-left: 4px;

      &:hover {
        background: rgba(0, 0, 0, 0.1);
      }
    }

    &.el-tag--info :deep(.el-tag__close) {
      color: white;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }
    }

    .tag-text {
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tag-actions {
      display: flex;
      align-items: center;
      margin-left: 2px;

      .more-icon {
        font-size: 12px;
        opacity: 0;
        transition: opacity 0.2s;
      }
    }

    &:hover .more-icon {
      opacity: 1;
    }
  }
}

// 深色主题
:deep(html.dark) {
  .lay-tags {
    background: #252540;

    .tag-item {
      background: #1A1A2E;
      color: #A1A1AA;

      &:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }

      &.el-tag--info {
        background: linear-gradient(135deg, #7C61D4, #9F85E0);
        color: white;
      }

      :deep(.el-tag__close) {
        color: #A1A1AA;

        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      }

      &.el-tag--info :deep(.el-tag__close) {
        color: white;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }
  }
}
</style>
