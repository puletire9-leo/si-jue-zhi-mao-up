<template>
  <div class="test-button">
    <el-button type="warning" @click="handleClick">
      测试按钮
    </el-button>
  </div>
</template>

<script setup lang="ts">
const handleClick = () => {
  console.log('测试按钮被点击')
}
</script>
