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
        '^/api': {
          target: mode === 'development' 
            ? `http://localhost:${env.VITE_BACKEND_PORT || '8003'}`
            : (env.VITE_API_BASE_URL || 'http://localhost:8003'),     
          changeOrigin: true,
          secure: false,
          timeout: 300000,
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
        usePolling: false,
        interval: 500,
        binaryInterval: 1000,
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
            'jszip': ['jszip'],
            'file-saver': ['file-saver']
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
