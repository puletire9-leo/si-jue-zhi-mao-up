@echo off
chcp 65001 > nul
echo ========================================
echo   部署前端到生产环境
echo ========================================
echo.

cd /d "%~dp0"

echo [1/6] 检查源代码...
if not exist "frontend" (
    echo [错误] frontend 目录不存在
    pause
    exit /b 1
)

echo [2/6] 构建生产版本...
cd frontend
call npm run build
if errorlevel 1 (
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo [3/6] 检查构建产物...
if not exist "dist" (
    echo [错误] dist 目录不存在
    pause
    exit /b 1
)

echo [4/6] 备份生产环境...
if exist "production\frontend\dist" (
    set timestamp=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
    move "production\frontend\dist" "production\frontend\dist_backup_%timestamp%"
    echo [完成] 已备份旧的构建产物
)

echo [5/6] 复制构建产物到生产环境...
robocopy dist "production\frontend\dist" /E /NFL /NDL /NJH /XO
if errorlevel 1 (
    echo [错误] 复制失败
    pause
    exit /b 1
)
echo [完成] 已复制构建产物

echo [6/6] 验证部署...
if exist "production\frontend\dist\index.html" (
    echo [成功] 部署验证通过
) else (
    echo [警告] 部署验证失败
)

echo.
echo ========================================
echo   部署完成
echo ========================================
echo.
echo 生产环境前端现在包含：
echo   - dist/ (新的构建产物）
echo   - .env.production (生产配置）
echo.
echo 下一步：
echo   1. 启动生产环境：
echo      scripts\startup\start_production.bat
echo.
echo   2. 或手动启动前端预览：
echo      cd production\frontend
echo      npm run preview
echo.
pause