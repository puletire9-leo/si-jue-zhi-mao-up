<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const preferences = ref([
  {
    title: '账户密码',
    description: '其他用户的消息将以站内信的形式通知',
    checked: true
  },
  {
    title: '系统消息',
    description: '系统消息将以站内信的形式通知',
    checked: true
  },
  {
    title: '待办任务',
    description: '待办任务将以站内信的形式通知',
    checked: true
  },
  {
    title: '邮件通知',
    description: '重要通知将发送到您的邮箱',
    checked: false
  },
  {
    title: '短信通知',
    description: '紧急通知将发送到您的手机',
    checked: false
  }
])

const handleToggle = (item: { title: string }) => {
  ElMessage.success(`${item.title}设置成功`)
}
</script>

<template>
  <div class="preferences-container">
    <h3 class="page-title">偏好设置</h3>
    
    <div class="preferences-list">
      <div 
        v-for="(item, index) in preferences" 
        :key="index"
        class="preference-item"
      >
        <div class="preference-content">
          <h4 class="preference-title">{{ item.title }}</h4>
          <p class="preference-description">{{ item.description }}</p>
        </div>
        <el-switch 
          v-model="item.checked"
          inline-prompt
          active-text="是"
          inactive-text="否"
          @change="handleToggle(item)"
          class="preference-switch"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.preferences-container {
  max-width: 600px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #2F281D;
}

.preferences-list {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(124, 97, 212, 0.08);
  overflow: hidden;
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #F0EBE6;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #FFFBF7;
  }
}

.preference-content {
  flex: 1;

  .preference-title {
    font-weight: 600;
    color: #2F281D;
    margin-bottom: 4px;
  }

  .preference-description {
    font-size: 13px;
    color: #9CA3AF;
  }
}

.preference-switch {
  :deep(.el-switch__core) {
    background: #E5E7EB;

    &.is-active {
      background: linear-gradient(135deg, #7C61D4, #9F85E0);
    }
  }
}
</style>
