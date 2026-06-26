<template>
  <div id="app-root">
    <!-- 正常内容 -->
    <router-view v-if="!fatalError" />

    <!-- 全局错误兜底 -->
    <div v-else class="app-error">
      <div class="app-error-inner">
        <div class="app-error-icon">⚠</div>
        <h2>页面加载异常</h2>
        <p>渲染过程中出现未预期的错误，请刷新页面重试。</p>
        <pre v-if="fatalErrorMsg" class="app-error-detail">{{ fatalErrorMsg }}</pre>
        <button class="app-error-btn" @click="handleReload">刷新页面</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const fatalError = ref(false)
const fatalErrorMsg = ref('')

onErrorCaptured((err) => {
  console.error('[App] 全局捕获错误:', err)
  fatalError.value = true
  fatalErrorMsg.value = err instanceof Error ? err.message : String(err)
  return false // 阻止错误继续向上传播
})

function handleReload() {
  window.location.reload()
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

#app-root {
  width: 100%;
  height: 100vh;
}

.app-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f5f0eb;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.app-error-inner {
  text-align: center;
  max-width: 480px;
  padding: 40px;
}

.app-error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.app-error h2 {
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 8px;
}

.app-error p {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 16px;
  line-height: 1.6;
}

.app-error-detail {
  font-size: 11px;
  color: #9ca3af;
  background: #faf8f5;
  border: 1px solid #e5e1da;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
  text-align: left;
  max-height: 120px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.app-error-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: #b45309;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.app-error-btn:hover {
  background: #92400e;
}

/* 暗黑模式 */
html.dark .app-error {
  background: #16162A;
  color: #f0ece6;
}

html.dark .app-error p {
  color: #a09888;
}

html.dark .app-error-detail {
  background: #1A1A2E;
  border-color: #2D2D44;
  color: #706860;
}
</style>
