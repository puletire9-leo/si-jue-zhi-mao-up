<template>
  <el-drawer
    :model-value="visible"
    :title="title"
    direction="rtl"
    :size="size"
    :append-to-body="true"
    class="filter-drawer"
    @update:model-value="(v: boolean) => emit('update:visible', v)"
    @close="emit('update:visible', false)"
  >
    <div class="filter-drawer__body">
      <slot />
    </div>

    <template #footer>
      <div class="filter-drawer__footer">
        <el-button class="fd-reset" @click="emit('reset')">重置</el-button>
        <el-button type="primary" class="fd-confirm" @click="emit('confirm')">
          确认筛选
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
/**
 * 统一筛选抽屉外壳
 * @description 右侧抽屉，内容由父组件通过默认插槽注入，底部固定 [重置][确认筛选]
 */
withDefaults(
  defineProps<{
    visible: boolean;
    title?: string;
    size?: string | number;
  }>(),
  {
    title: "筛选条件",
    size: 420,
  },
);

const emit = defineEmits<{
  (e: "update:visible", v: boolean): void;
  (e: "reset"): void;
  (e: "confirm"): void;
}>();
</script>

<style scoped lang="scss">
.filter-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 8px;
}

.filter-drawer__footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .fd-confirm {
    min-width: 120px;
  }
}
</style>
