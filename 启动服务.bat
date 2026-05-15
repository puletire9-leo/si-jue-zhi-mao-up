@echo off
chcp 65001 >nul
title 思觉智贸 - 服务控制

:MENU
cls
echo.
echo   ╔════════════════════════════════╗
echo   ║   思觉智贸 - 服务控制面板      ║
echo   ╠════════════════════════════════╣
echo   ║                              ║
echo   ║  1. 启动开发模式              ║
echo   ║     Java :8090 + Vite :5175   ║
echo   ║     数据库: sijuelishi_dev    ║
echo   ║                              ║
echo   ║  2. 停止开发模式              ║
echo   ║                              ║
echo   ║  3. 启动生产模式              ║
echo   ║     Java :8091                ║
echo   ║     数据库: sijuelishi        ║
echo   ║                              ║
echo   ║  4. 停止生产模式              ║
echo   ║                              ║
echo   ║  5. 停止全部                  ║
echo   ║                              ║
echo   ║  0. 退出                      ║
echo   ║                              ║
echo   ╚════════════════════════════════╝
echo.
choice /c 123450 /n /m "请选择 [1-5,0]: "
if errorlevel 6 goto EXIT
if errorlevel 5 goto STOP_ALL
if errorlevel 4 goto STOP_PROD
if errorlevel 3 goto START_PROD
if errorlevel 2 goto STOP_DEV
if errorlevel 1 goto START_DEV

:START_DEV
echo 正在启动开发模式...
start "Java(dev)" cmd /c "cd java-backend && set JAVA_HOME=E:\软件\PyCharm 2025.2.1.1\jbr && set PATH=E:\tool\apache-maven-3.9.9\bin;%JAVA_HOME%\bin;%PATH% && set MYSQL_DATABASE=sijuelishi_dev && mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8090"
timeout /t 5 /nobreak >nul
start "Vite" cmd /c "cd frontend && E:\tool\node-v24.15.0\npm.cmd run dev"
echo 开发模式已启动: Java :8090 + Vite :5175
timeout /t 2 /nobreak >nul
goto MENU

:STOP_DEV
echo 正在停止开发模式...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8090 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
echo 已停止
timeout /t 2 /nobreak >nul
goto MENU

:START_PROD
echo 正在启动生产模式...
start "Java(prod)" cmd /c "cd java-backend && set JAVA_HOME=E:\软件\PyCharm 2025.2.1.1\jbr && set PATH=E:\tool\apache-maven-3.9.9\bin;%JAVA_HOME%\bin;%PATH% && set MYSQL_DATABASE=sijuelishi && mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8091"
echo 生产模式已启动: Java :8091
timeout /t 2 /nobreak >nul
goto MENU

:STOP_PROD
echo 正在停止生产模式...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8091 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
echo 已停止
timeout /t 2 /nobreak >nul
goto MENU

:STOP_ALL
echo 正在停止全部...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8090 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8091 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175 ^| findstr LISTENING') do taskkill /F /T /PID %%a 2>nul
echo 全部已停止
timeout /t 2 /nobreak >nul
goto MENU

:EXIT
exit
