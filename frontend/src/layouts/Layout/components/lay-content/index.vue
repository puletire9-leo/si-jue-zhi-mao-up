<script setup lang="ts">
defineProps<{
  padding?: number
}>()
</script>

<template>
  <div class="lay-content">
    <router-view v-slot="{ Component, route }">
      <!-- 只缓存显式标记 meta.keepAlive 的页面（如品线选品/店铺画像）。 -->
      <!-- 店铺选品等图片密集的重页面切走即销毁、释放内存，避免整个标签页因缓存堆积变卡。 -->
      <transition name="fade-transform" mode="out-in">
        <keep-alive :max="10">
          <component
            v-if="route.meta.keepAlive"
            :is="Component"
            :key="route.path"
          />
        </keep-alive>
      </transition>
      <transition name="fade-transform" mode="out-in">
        <component
          v-if="!route.meta.keepAlive"
          :is="Component"
          :key="route.path"
        />
      </transition>
    </router-view>
  </div>
</template>

<style scoped lang="scss">
.lay-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #faf8f5;
  overflow-y: auto;
}

.lay-content > :deep(*) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
