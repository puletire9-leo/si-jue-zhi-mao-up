<script setup lang="ts">
import { ref } from 'vue'
import { Clock, MapLocation, Monitor } from '@element-plus/icons-vue'

const logs = ref([
  {
    id: 1,
    time: '2026-01-30 14:30:25',
    type: '登录',
    ip: '192.168.1.100',
    location: '本地网络',
    device: 'Chrome (Windows 10)'
  },
  {
    id: 2,
    time: '2026-01-29 09:15:42',
    type: '登录',
    ip: '10.0.0.55',
    location: '公司网络',
    device: 'Safari (Mac OS)'
  },
  {
    id: 3,
    time: '2026-01-28 16:45:10',
    type: '密码修改',
    ip: '192.168.1.100',
    location: '本地网络',
    device: 'Chrome (Windows 10)'
  },
  {
    id: 4,
    time: '2026-01-27 11:20:33',
    type: '登录',
    ip: '203.0.113.45',
    location: '北京',
    device: 'Firefox (Linux)'
  },
  {
    id: 5,
    time: '2026-01-26 18:55:08',
    type: '登录失败',
    ip: '192.168.1.100',
    location: '本地网络',
    device: 'Chrome (Windows 10)'
  }
])

const getTypeClass = (type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' => {
  const classes: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    '登录': 'success',
    '登录失败': 'danger',
    '密码修改': 'warning',
    '权限变更': 'info'
  }
  return classes[type] || 'info'
}
</script>

<template>
  <div class="security-log-container">
    <h3 class="page-title">安全日志</h3>
    
    <div class="log-list">
      <div 
        v-for="log in logs" 
        :key="log.id"
        class="log-item"
      >
        <div class="log-header">
          <span class="log-time">
            <el-icon><Clock /></el-icon>
            {{ log.time }}
          </span>
          <el-tag :type="getTypeClass(log.type)" class="log-type">
            {{ log.type }}
          </el-tag>
        </div>
        <div class="log-details">
          <div class="detail-item">
            <el-icon><MapLocation /></el-icon>
            <span>{{ log.location }}</span>
            <span class="detail-label">IP:</span>
            <span>{{ log.ip }}</span>
          </div>
          <div class="detail-item">
            <el-icon><Monitor /></el-icon>
            <span>{{ log.device }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.security-log-container {
  max-width: 700px;
}

.page-title {
  margin-bottom: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #2F281D;
}

.log-list {
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(124, 97, 212, 0.08);
  overflow: hidden;
}

.log-item {
  padding: 20px 24px;
  border-bottom: 1px solid #F0EBE6;

  &:last-child {
    border-bottom: none;
  }
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .log-time {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #6B5E52;
    font-size: 14px;
  }

  .log-type {
    font-size: 12px;
  }
}

.log-details {
  background: #FFFBF7;
  padding: 12px 16px;
  border-radius: 10px;

  .detail-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #6B5E52;

    .detail-label {
      color: #9CA3AF;
      margin-left: 12px;
    }
  }
}
</style>
