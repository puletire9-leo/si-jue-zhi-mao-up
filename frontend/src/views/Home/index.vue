<template>
  <div class="dashboard-page">
    <div class="welcome-section">
      <div class="welcome-text">
        欢迎回来，<span class="highlight">Admin</span>
      </div>
      <div class="welcome-sub">您有 {{ pendingCount }} 条待处理消息 · {{ currentDate }}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card" @click="navigateTo('/products')">
        <div class="stat-icon purple">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">1,284</div>
          <div class="stat-label">产品总数</div>
        </div>
        <div class="stat-trend up">+12.5%</div>
      </div>

      <div class="stat-card" @click="navigateTo('/all-selection')">
        <div class="stat-icon orange">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">456</div>
          <div class="stat-label">选品数量</div>
        </div>
        <div class="stat-trend up">+8.2%</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon green">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">¥89.2K</div>
          <div class="stat-label">本月销售额</div>
        </div>
        <div class="stat-trend up">+23.1%</div>
      </div>

      <div class="stat-card" @click="navigateTo('/resource-collection')">
        <div class="stat-icon blue">
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        </div>
        <div class="stat-content">
          <div class="stat-value">3,847</div>
          <div class="stat-label">图片素材</div>
        </div>
        <div class="stat-trend down">-3.2%</div>
      </div>
    </div>

    <div class="features-section">
      <h2 class="section-title">快捷功能</h2>
      <div class="features-grid">
        <div class="feature-card" @click="navigateTo('/products')">
          <div class="feature-icon purple">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">产品管理</div>
            <div class="feature-desc">管理产品信息、查询、编辑</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <div class="feature-card" @click="navigateTo('/all-selection')">
          <div class="feature-icon orange">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">选品中心</div>
            <div class="feature-desc">总选品管理、新品榜</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <div class="feature-card" @click="navigateTo('/final-draft')">
          <div class="feature-icon green">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">定稿管理</div>
            <div class="feature-desc">定稿创建、素材库</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <div class="feature-card" @click="navigateTo('/product-data')">
          <div class="feature-icon blue">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">数据看板</div>
            <div class="feature-desc">产品分析、销售趋势</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <div class="feature-card" @click="navigateTo('/resource-collection')">
          <div class="feature-icon pink">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">图片管理</div>
            <div class="feature-desc">图片上传、以图搜图</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>

        <div class="feature-card" @click="navigateTo('/prompt-library')">
          <div class="feature-icon cyan">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <div class="feature-content">
            <div class="feature-title">资料中心</div>
            <div class="feature-desc">提示词库、资料库</div>
          </div>
          <div class="feature-arrow">→</div>
        </div>
      </div>
    </div>

    <div class="bottom-section">
      <div class="activity-card">
        <div class="card-header">
          <span class="card-title">最近动态</span>
          <span class="view-all">查看全部</span>
        </div>
        <div class="activity-list">
          <div class="activity-item">
            <div class="activity-icon purple">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            </div>
            <div class="activity-content">
              <div class="activity-text">新增产品 "智能手环 Pro"</div>
              <div class="activity-time">5分钟前</div>
            </div>
            <span class="activity-status success">完成</span>
          </div>

          <div class="activity-item">
            <div class="activity-icon orange">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <div class="activity-content">
              <div class="activity-text">上传图片素材 24 张</div>
              <div class="activity-time">15分钟前</div>
            </div>
            <span class="activity-status success">完成</span>
          </div>

          <div class="activity-item">
            <div class="activity-icon green">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <div class="activity-content">
              <div class="activity-text">选品待审核：蓝牙耳机 X3</div>
              <div class="activity-time">1小时前</div>
            </div>
            <span class="activity-status pending">待处理</span>
          </div>

          <div class="activity-item">
            <div class="activity-icon blue">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div class="activity-content">
              <div class="activity-text">定稿审核通过</div>
              <div class="activity-time">2小时前</div>
            </div>
            <span class="activity-status info">已通过</span>
          </div>
        </div>
      </div>

      <div class="quick-card">
        <div class="card-header">
          <span class="card-title">快捷操作</span>
        </div>
        <div class="quick-list">
          <div class="quick-item" @click="navigateTo('/products')">
            <div class="quick-icon purple">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
            </div>
            <span>导入产品</span>
          </div>
          <div class="quick-item" @click="navigateTo('/resource-collection')">
            <div class="quick-icon orange">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
            <span>上传图片</span>
          </div>
          <div class="quick-item">
            <div class="quick-icon green">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <span>导出数据</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'Dashboard' })
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const pendingCount = 5

const currentDate = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  return `${year}年${month}月${day}日`
})

const navigateTo = (path: string) => {
  router.push(path)
}
</script>

<style scoped lang="scss">
.dashboard-page {
  max-width: 1400px;
  margin: 0 auto;
}

.welcome-section {
  margin-bottom: 28px;
}

.welcome-text {
  font-size: 26px;
  font-weight: 600;
  color: #2F281D;
  margin-bottom: 6px;

  .highlight {
    background: linear-gradient(135deg, #7C61D4, #6347C0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.welcome-sub {
  font-size: 14px;
  color: #6B5E52;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #F0EBE6;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(124, 97, 212, 0.1);
  }
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.purple {
    background: linear-gradient(135deg, rgba(124, 97, 212, 0.12), rgba(159, 133, 224, 0.08));
    color: #7C61D4;
  }

  &.orange {
    background: linear-gradient(135deg, rgba(234, 174, 135, 0.2), rgba(240, 201, 176, 0.15));
    color: #D97706;
  }

  &.green {
    background: linear-gradient(135deg, rgba(22, 163, 74, 0.1), rgba(74, 222, 128, 0.08));
    color: #16A34A;
  }

  &.blue {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(96, 165, 250, 0.08));
    color: #3B82F6;
  }
}

.stat-content {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #2F281D;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
  color: #6B5E52;
  margin-top: 2px;
}

.stat-trend {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 20px;
  flex-shrink: 0;

  &.up {
    background: rgba(22, 163, 74, 0.1);
    color: #16A34A;
  }

  &.down {
    background: rgba(220, 38, 38, 0.1);
    color: #DC2626;
  }
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #2F281D;
  margin-bottom: 16px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.feature-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid #F0EBE6;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: linear-gradient(90deg, #7C61D4, #EAAE87);
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.25s ease;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(124, 97, 212, 0.1);

    &::before {
      transform: scaleX(1);
    }

    .feature-arrow {
      transform: translateX(4px);
    }
  }
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.purple {
    background: linear-gradient(135deg, #7C61D4, #9F85E0);
    color: white;
  }

  &.orange {
    background: linear-gradient(135deg, #EAAE87, #F0C9B0);
    color: white;
  }

  &.green {
    background: linear-gradient(135deg, #16A34A, #4ADE80);
    color: white;
  }

  &.blue {
    background: linear-gradient(135deg, #3B82F6, #60A5FA);
    color: white;
  }

  &.pink {
    background: linear-gradient(135deg, #EC4899, #F472B6);
    color: white;
  }

  &.cyan {
    background: linear-gradient(135deg, #06B6D4, #22D3EE);
    color: white;
  }
}

.feature-content {
  flex: 1;
  min-width: 0;
}

.feature-title {
  font-size: 15px;
  font-weight: 600;
  color: #2F281D;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 12px;
  color: #6B5E52;
}

.feature-arrow {
  font-size: 18px;
  color: #7C61D4;
  transition: transform 0.25s ease;
}

.bottom-section {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
}

.activity-card,
.quick-card {
  background: white;
  border-radius: 16px;
  border: 1px solid #F0EBE6;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #F0EBE6;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #2F281D;
}

.view-all {
  font-size: 13px;
  color: #7C61D4;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.activity-list {
  padding: 8px 0;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  transition: background 0.15s ease;

  &:hover {
    background: #F8F4FF;
  }
}

.activity-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.purple {
    background: rgba(124, 97, 212, 0.1);
    color: #7C61D4;
  }

  &.orange {
    background: rgba(234, 174, 135, 0.2);
    color: #D97706;
  }

  &.green {
    background: rgba(22, 163, 74, 0.1);
    color: #16A34A;
  }

  &.blue {
    background: rgba(59, 130, 246, 0.1);
    color: #3B82F6;
  }
}

.activity-content {
  flex: 1;
  min-width: 0;
}

.activity-text {
  font-size: 13px;
  font-weight: 500;
  color: #2F281D;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-time {
  font-size: 11px;
  color: #A89F96;
  margin-top: 2px;
}

.activity-status {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 20px;
  flex-shrink: 0;

  &.success {
    background: rgba(22, 163, 74, 0.1);
    color: #16A34A;
  }

  &.pending {
    background: rgba(234, 174, 135, 0.2);
    color: #D97706;
  }

  &.info {
    background: rgba(124, 97, 212, 0.1);
    color: #7C61D4;
  }
}

.quick-list {
  padding: 12px;
}

.quick-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #F8F4FF;
  }

  span {
    font-size: 14px;
    font-weight: 500;
    color: #2F281D;
  }
}

.quick-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.purple {
    background: linear-gradient(135deg, #7C61D4, #9F85E0);
    color: white;
  }

  &.orange {
    background: linear-gradient(135deg, #EAAE87, #F0C9B0);
    color: white;
  }

  &.green {
    background: linear-gradient(135deg, #16A34A, #4ADE80);
    color: white;
  }
}

@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bottom-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .stats-grid,
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
