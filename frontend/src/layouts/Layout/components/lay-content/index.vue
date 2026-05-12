<script setup lang="ts">
defineProps<{
  padding?: number
}>()
</script>

<template>
  <div class="lay-content">
    <router-view v-slot="{ Component, route }">
      <transition name="fade-transform" mode="out-in">
        <component :is="Component" :key="route.path" />
      </transition>
    </router-view>
  </div>
</template>

<style scoped lang="scss">
.lay-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #FFFBF7;
  overflow: hidden;
}

.lay-content > :deep(*) {
  flex: 1;
  min-height: 0;
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
