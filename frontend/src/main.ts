import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import '@styles/index.scss'

// 导入内存监控工具
import { startMemoryMonitoring, memoryMonitor } from './utils/memoryMonitor'

const app = createApp(App)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

// 启动内存监控
startMemoryMonitoring({
  onUpdate: (stats) => {
    console.log('内存使用更新:', {
      used: ((stats.usedJSHeapSize / 1024 / 1024).toFixed(2)) + ' MB',
      percentage: stats.usagePercentage.toFixed(2) + '%',
      limit: ((stats.jsHeapSizeLimit / 1024 / 1024).toFixed(2)) + ' MB'
    })
  },
  onWarning: (stats) => {
    console.warn('⚠️ 内存使用警告:', {
      used: ((stats.usedJSHeapSize / 1024 / 1024).toFixed(2)) + ' MB',
      percentage: stats.usagePercentage.toFixed(2) + '%'
    })
  },
  onCritical: (stats) => {
    console.error('🚨 内存使用严重警告:', {
      used: ((stats.usedJSHeapSize / 1024 / 1024).toFixed(2)) + ' MB',
      percentage: stats.usagePercentage.toFixed(2) + '%'
    })
  }
})

// 定时检测内存泄漏
setInterval(async () => {
  if (import.meta.env.PROD) {
    const result = await memoryMonitor.detectMemoryLeak(10000, 1000)
    if (result.hasLeak) {
      console.error('内存泄漏检测:', result.evidence)
    }
  }
}, 60000) // 每分钟检测一次

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default'
})

app.mount('#app')
