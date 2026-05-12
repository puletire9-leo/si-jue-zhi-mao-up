<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { emitter } from '@/utils/emitter';
import { Close } from '@element-plus/icons-vue';

const show = ref(false);

const handleClose = () => {
  show.value = false;
};

onMounted(() => {
  emitter.on('openPanel', () => {
    show.value = true;
  });
});

onUnmounted(() => {
  emitter.off('openPanel');
});
</script>

<template>
  <div :class="{ show }">
    <div class="right-panel-background" @click="handleClose" />
    <div class="right-panel">
      <div class="panel-header">
        <h4>系统配置</h4>
        <span class="close-icon" @click="handleClose">
          <el-icon :size="18"><Close /></el-icon>
        </span>
      </div>
      <el-scrollbar class="panel-scrollbar">
        <slot />
      </el-scrollbar>

    </div>
  </div>
</template>

<style scoped lang="scss">
.right-panel-background {
  position: fixed;
  top: 0;
  left: 0;
  z-index: -1;
  background: rgb(0 0 0 / 20%);
  opacity: 0;
  transition: opacity 0.3s cubic-bezier(0.7, 0.3, 0.1, 1);
}

.right-panel {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 40000;
  width: 100%;
  max-width: 320px;
  height: 100%;
  background: white;
  box-shadow: 0 0 15px 0 rgb(0 0 0 / 5%);
  transform: translate(100%);
  transition: all 0.25s cubic-bezier(0.7, 0.3, 0.1, 1);
  display: flex;
  flex-direction: column;
}

.show {
  .right-panel-background {
    z-index: 20000;
    width: 100%;
    height: 100%;
    opacity: 1;
  }

  .right-panel {
    transform: translate(0);
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #F0EBE6;

  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #2F281D;
  }

  .close-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    cursor: pointer;
    color: #6B5E52;
    transition: all 0.2s;

    &:hover {
      background: #F8F4FF;
      color: #7C61D4;
    }
  }
}

.panel-scrollbar {
  flex: 1;
  overflow-y: auto;
  z-index: 1;
  position: relative;
}

.panel-footer {
  padding: 12px 20px;
  border-top: 1px solid #F0EBE6;
  display: flex;
  justify-content: flex-end;
}

// 深色主题
:deep(html.dark) {
  .right-panel {
    background: #1A1A2E;
    box-shadow: 0 0 15px 0 rgba(0, 0, 0, 0.3);
  }

  .panel-header {
    border-bottom-color: #2D2D44;

    h4 {
      color: #E4E4E7;
    }

    .close-icon {
      color: #A1A1AA;

      &:hover {
        background: #252540;
        color: #9F85E0;
      }
    }
  }

  .panel-footer {
    border-top-color: #2D2D44;
  }
}
</style>
