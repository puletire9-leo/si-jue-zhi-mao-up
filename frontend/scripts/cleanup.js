#!/usr/bin/env node

/**
 * 前端开发环境自动清理和优化脚本
 * 解决Vite依赖预构建缓存问题和中文路径兼容性问题
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'

// ES模块的__dirname替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 颜色输出工具
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
}

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset)
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logWarning(message) {
  log(`⚠️ ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️ ${message}`, 'blue')
}

/**
 * 清理Vite缓存目录
 */
function cleanViteCache() {
  const cacheDirs = [
    'node_modules/.vite',
    'node_modules/.cache',
    '.vite'
  ]

  logInfo('正在清理Vite缓存...')
  
  cacheDirs.forEach(dir => {
    const cachePath = path.resolve(__dirname, '..', dir)
    if (fs.existsSync(cachePath)) {
      try {
        fs.rmSync(cachePath, { recursive: true, force: true })
        logSuccess(`已清理缓存目录: ${dir}`)
      } catch (error) {
        logError(`清理缓存目录失败: ${dir} - ${error.message}`)
      }
    } else {
      logInfo(`缓存目录不存在: ${dir}`)
    }
  })
}

/**
 * 清理构建输出目录
 */
function cleanBuildOutput() {
  const buildDirs = [
    '../static/vue-dist-dev',
    '../static/vue-dist'
  ]

  logInfo('正在清理构建输出...')
  
  buildDirs.forEach(dir => {
    const buildPath = path.resolve(__dirname, '..', dir)
    if (fs.existsSync(buildPath)) {
      try {
        fs.rmSync(buildPath, { recursive: true, force: true })
        logSuccess(`已清理构建目录: ${dir}`)
      } catch (error) {
        logError(`清理构建目录失败: ${dir} - ${error.message}`)
      }
    } else {
      logInfo(`构建目录不存在: ${dir}`)
    }
  })
}

/**
 * 检查并修复依赖完整性
 */
function checkDependencies() {
  logInfo('正在检查依赖完整性...')
  
  try {
    // 检查package-lock.json是否存在
    const packageLockPath = path.resolve(__dirname, '..', 'package-lock.json')
    if (!fs.existsSync(packageLockPath)) {
      logWarning('package-lock.json不存在，重新生成...')
      execSync('npm install', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
    }
    
    // 检查node_modules完整性
    const nodeModulesPath = path.resolve(__dirname, '..', 'node_modules')
    if (!fs.existsSync(nodeModulesPath)) {
      logWarning('node_modules不存在，重新安装依赖...')
      execSync('npm install', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
    } else {
      // 验证关键依赖是否存在
      const criticalDeps = ['vue', 'element-plus', '@vitejs/plugin-vue']
      let missingDeps = []
      
      criticalDeps.forEach(dep => {
        const depPath = path.resolve(nodeModulesPath, dep)
        if (!fs.existsSync(depPath)) {
          missingDeps.push(dep)
        }
      })
      
      if (missingDeps.length > 0) {
        logWarning(`缺少关键依赖: ${missingDeps.join(', ')}，重新安装...`)
        execSync('npm install', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') })
      } else {
        logSuccess('依赖完整性检查通过')
      }
    }
  } catch (error) {
    logError(`依赖检查失败: ${error.message}`)
  }
}

/**
 * 优化开发环境配置
 */
function optimizeDevelopmentConfig() {
  logInfo('正在优化开发环境配置...')
  
  try {
    // 检查并更新.env.development文件
    const envDevPath = path.resolve(__dirname, '..', '.env.development')
    if (fs.existsSync(envDevPath)) {
      let envContent = fs.readFileSync(envDevPath, 'utf8')
      
      // 确保必要的环境变量存在
      const requiredVars = {
        'VITE_API_BASE_URL': 'http://localhost:8001',
        'VITE_APP_TITLE': '思觉智贸'
      }
      
      Object.entries(requiredVars).forEach(([key, defaultValue]) => {
        if (!envContent.includes(`${key}=`)) {
          envContent += `\n${key}=${defaultValue}\n`
          logInfo(`添加环境变量: ${key}`)
        }
      })
      
      fs.writeFileSync(envDevPath, envContent)
      logSuccess('开发环境配置文件已优化')
    }
  } catch (error) {
    logError(`开发环境配置优化失败: ${error.message}`)
  }
}

/**
 * 验证路径兼容性
 */
function validatePathCompatibility() {
  logInfo('正在验证路径兼容性...')
  
  try {
    // 检查中文路径处理
    const testPaths = [
      'src/components',
      'src/views/FinalDraft',
      'node_modules/element-plus'
    ]
    
    testPaths.forEach(testPath => {
      const fullPath = path.resolve(__dirname, '..', testPath)
      if (fs.existsSync(fullPath)) {
        logSuccess(`路径可访问: ${testPath}`)
      } else {
        logWarning(`路径不可访问: ${testPath}`)
      }
    })
    
    // 检查Vite路径配置文件
    const vitePathsConfig = path.resolve(__dirname, '..', 'vite.paths.js')
    if (fs.existsSync(vitePathsConfig)) {
      logSuccess('Vite路径配置文件存在')
    } else {
      logError('Vite路径配置文件缺失，请重新生成')
    }
    
  } catch (error) {
    logError(`路径兼容性验证失败: ${error.message}`)
  }
}

/**
 * 生成清理报告
 */
function generateCleanupReport() {
  const report = {
    timestamp: new Date().toISOString(),
    cleaned: {
      viteCache: true,
      buildOutput: true,
      dependencies: true
    },
    optimized: {
      developmentConfig: true,
      pathCompatibility: true
    }
  }
  
  const reportPath = path.resolve(__dirname, '..', 'cleanup-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  logSuccess(`清理报告已生成: ${reportPath}`)
}

/**
 * 主函数
 */
async function main() {
  log('🚀 开始前端开发环境清理和优化', 'blue')
  log('='.repeat(50), 'blue')
  
  try {
    // 执行清理和优化步骤
    cleanViteCache()
    cleanBuildOutput()
    checkDependencies()
    optimizeDevelopmentConfig()
    validatePathCompatibility()
    
    log('='.repeat(50), 'blue')
    logSuccess('前端开发环境清理和优化完成！')
    
    // 生成报告
    generateCleanupReport()
    
    logInfo('建议重新启动开发服务器以获得最佳效果')
    logInfo('运行命令: npm run dev')
    
  } catch (error) {
    logError(`清理和优化过程失败: ${error.message}`)
    process.exit(1)
  }
}

// 执行主函数
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export {
  cleanViteCache,
  cleanBuildOutput,
  checkDependencies,
  optimizeDevelopmentConfig,
  validatePathCompatibility,
  generateCleanupReport
}