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

// 仅在开发环境启动内存监控
if (import.meta.env.DEV) {
  startMemoryMonitoring({
    onWarning: (stats) => {
      console.warn('内存使用警告:', {
        used: ((stats.usedJSHeapSize / 1024 / 1024).toFixed(2)) + ' MB',
        percentage: stats.usagePercentage.toFixed(2) + '%'
      })
    },
    onCritical: (stats) => {
      console.error('内存使用严重警告:', {
        used: ((stats.usedJSHeapSize / 1024 / 1024).toFixed(2)) + ' MB',
        percentage: stats.usagePercentage.toFixed(2) + '%'
      })
    }
  })
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default'
})

app.mount('#app')
