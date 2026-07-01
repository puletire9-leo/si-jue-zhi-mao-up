import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd())
  // Java 后端代理目标：开发直连 product
  const javaTarget = mode === 'development'
    ? `http://${env.VITE_JAVA_HOST || 'localhost'}:${env.VITE_JAVA_PORT || '8002'}`
    : `http://${env.VITE_JAVA_HOST || 'localhost'}:${env.VITE_JAVA_PORT || '8022'}`
  const javaUserTarget = mode === 'development'
    ? `http://${env.VITE_JAVA_USER_HOST || 'java-user'}:${env.VITE_JAVA_USER_PORT || '8001'}`
    : `http://${env.VITE_JAVA_USER_HOST || 'java-user'}:${env.VITE_JAVA_USER_PORT || '8001'}`

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-import.d.ts'
      }),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts'
      })
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@styles': resolve(__dirname, 'src/styles')
      }
    },
    server: {
      port: 5175,
      host: '0.0.0.0',
      open: false,
      proxy: {
        // Java 微服务（优先匹配）
        '/api/v1/asin-import': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/competitor': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/method-cards': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/product-performance': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/category-baseline': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/category-dislocation': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/seller': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/scoring': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/filter-config': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/filter-presets': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/sellersprite-config': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/click-logs': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 10000,
          logLevel: 'warn'
        },
        '/api/v1/deng-zong-shop': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/modules': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '/api/v1/product-line/aggregated-data': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/product-line/guidance': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/product-line/tree': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        // 选品 Agent（通配 — 放在具体路径之后，确保具体路径优先）
        '/api/v1/product-line': {
          target: javaTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        // 注意：更具体的路径必须放在 /api/v1/auth 之前
        // /auth/members 是 Python 实现（无 RBAC 拦截，供前端按角色拉名单）
        '/api/v1/auth/members': {
          target: mode === 'development'
            ? `http://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || '8090'}`
            : (env.VITE_API_BASE_URL || 'http://localhost:8090'),
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/auth': {
          target: javaUserTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        '/api/v1/users': {
          target: javaUserTarget,
          changeOrigin: true,
          secure: false,
          timeout: 30000,
          logLevel: 'warn'
        },
        // Python 后端（兜底）
        '^/api': {
          target: mode === 'development'
            ? `http://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || '8090'}`
            : (env.VITE_API_BASE_URL || 'http://localhost:8090'),
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '^/uploads': {
          target: mode === 'development'
            ? `http://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || '8090'}`
            : (env.VITE_API_BASE_URL || 'http://localhost:8090'),
          changeOrigin: true,
          secure: false,
          timeout: 300000,
          logLevel: 'warn'
        },
        '^/dashboards': {
          target: mode === 'development'
            ? `http://localhost:${env.VITE_BACKEND_PORT || '8090'}`
            : (env.VITE_API_BASE_URL || 'http://localhost:8090'),
          changeOrigin: true,
          secure: false,
          logLevel: 'warn'
        }
      },
      watch: {
        ignored: [
          '**/node_modules/**', 
          '**/dist/**', 
          '**/static/**',
          '**/*.log',
          '**/logs/**'
        ],
        usePolling: true,  // WSL2 文件系统事件不穿透，必须用轮询
        interval: 1000,
        binaryInterval: 2000,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100
        }
      },
      hmr: {
        overlay: false,
        timeout: 30000
      },
      warmup: {
        include: [
          'src/views/Home/index.vue',
          'src/views/Login/index.vue'
        ]
      }
    },
    build: {
      outDir: mode === 'development' ? '../static/vue-dist-dev' : '../static/vue-dist',
      emptyOutDir: true,
      sourcemap: false,
      minify: mode === 'production' ? 'terser' : false,
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production'
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'element-plus': ['element-plus'],
            'element-icons': ['@element-plus/icons-vue'],
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'axios': ['axios'],
            'echarts': ['echarts'],
            'jszip': ['jszip']
          },
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: '[ext]/[name]-[hash].[ext]'
        },
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false
        }
      },
      chunkSizeWarningLimit: 1000,
      parallel: true,
      cssCodeSplit: true,
      assetsInlineLimit: 4096
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia', 'element-plus', 'axios', 'echarts'],
      // 强制预构建
      force: false,
      // 优化缓存
      esbuildOptions: {
        target: 'es2015'
        // 移除splitting选项，开发模式下不需要
      }
    },
    // 优化CSS处理
    css: {
      devSourcemap: mode === 'development',
      // 优化CSS模块
      modules: {
        localsConvention: 'camelCase'
      },
      // 优化预处理器
      preprocessorOptions: {
        scss: {
          quietDeps: true
        }
      }
    },
    // 优化构建依赖
    define: {
      // 减少Vue警告
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false
    }
  }
})
