@echo off
chcp 65001 > nul
echo ========================================
echo   清理 production/frontend 源代码
echo ========================================
echo.

cd /d "%~dp0"

echo [1/10] 检查 production/frontend...
if not exist "production\frontend" (
    echo [错误] production\frontend 不存在
    pause
    exit /b 1
)

echo [2/10] 备份配置文件...
if exist "production\frontend\.env.production" (
    copy "production\frontend\.env.production" "production\frontend\.env.production.bak"
    echo [完成] 已备份 .env.production
)

echo [3/10] 删除源代码目录...
if exist "production\frontend\src" (
    rmdir /s /q "production\frontend\src"
    echo [完成] 已删除 src/
)

if exist "production\frontend\public" (
    rmdir /s /q "production\frontend\public"
    echo [完成] 已删除 public/
)

if exist "production\frontend\tests" (
    rmdir /s /q "production\frontend\tests"
    echo [完成] 已删除 tests/
)

echo [4/10] 删除配置文件...
if exist "production\frontend\package.json" (
    del /q "production\frontend\package.json"
    echo [完成] 已删除 package.json
)

if exist "production\frontend\package-lock.json" (
    del /q "production\frontend\package-lock.json"
    echo [完成] 已删除 package-lock.json
)

if exist "production\frontend\tsconfig.json" (
    del /q "production\frontend\tsconfig.json"
    echo [完成] 已删除 tsconfig.json
)

if exist "production\frontend\tsconfig.node.json" (
    del /q "production\frontend\tsconfig.node.json"
    echo [完成] 已删除 tsconfig.node.json
)

if exist "production\frontend\vite.config.js" (
    del /q "production\frontend\vite.config.js"
    echo [完成] 已删除 vite.config.js
)

if exist "production\frontend\vite.config.js.timestamp-*" (
    del /q "production\frontend\vite.config.js.timestamp-*"
    echo [完成] 已删除 vite.config.js.timestamp-*
)

if exist "production\frontend\index.html" (
    del /q "production\frontend\index.html"
    echo [完成] 已删除 index.html
)

if exist "production\frontend\nginx.conf" (
    del /q "production\frontend\nginx.conf"
    echo [完成] 已删除 nginx.conf
)

if exist "production\frontend\.env.development" (
    del /q "production\frontend\.env.development"
    echo [完成] 已删除 .env.development
)

if exist "production\frontend\.eslintrc-auto-import.json" (
    del /q "production\frontend\.eslintrc-auto-import.json"
    echo [完成] 已删除 .eslintrc-auto-import.json
)

if exist "production\frontend\.eslintrc.cjs" (
    del /q "production\frontend\.eslintrc.cjs"
    echo [完成] 已删除 .eslintrc.cjs
)

if exist "production\frontend\frontend_consistency_report.json" (
    del /q "production\frontend\frontend_consistency_report.json"
    echo [完成] 已删除 frontend_consistency_report.json
)

if exist "production\frontend\vitest.config.js" (
    del /q "production\frontend\vitest.config.js"
    echo [完成] 已删除 vitest.config.js
)

if exist "production\frontend\vitest.config.ts" (
    del /q "production\frontend\vitest.config.ts"
    echo [完成] 已删除 vitest.config.ts
)

echo [5/10] 删除 node_modules...
if exist "production\frontend\node_modules" (
    rmdir /s /q "production\frontend\node_modules"
    echo [完成] 已删除 node_modules/
)

echo [6/10] 创建 dist 目录...
if not exist "production\frontend\dist" (
    mkdir "production\frontend\dist"
    echo [完成] 已创建 dist/
)

echo [7/10] 检查清理结果...
echo.
echo ========================================
echo   production/frontend 当前内容
echo ========================================
dir /b production\frontend
echo.
echo ========================================
echo   清理完成
echo ========================================
echo.
echo production/frontend 现在只包含：
echo   - dist/ (构建产物目录）
echo   - .env.production (生产配置）
echo.
echo 下一步：
echo   1. 在 frontend/ 目录构建生产版本：
echo      cd frontend
echo      npm run build
echo.
echo   2. 复制构建产物到生产环境：
echo      robocopy dist production\frontend\dist /E
echo.
pause